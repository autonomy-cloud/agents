// Package vpxenc provides a minimal VP8 encoder wrapping libvpx via cgo.
//
// server-sdk-go's LocalTrack publishes already-encoded media.Sample frames
// (see its videotracke2ee/audiotrack examples); it does not itself contain a
// video encoder. This package supplies that missing piece: it converts
// image.RGBA frames captured over RFB into VP8 bitstream frames suitable for
// a webrtc.TrackLocalStaticSample / lksdk.LocalTrack with MimeType
// "video/VP8".
//
// libvpx is BSD-licensed and is dynamically linked via the system package
// (apt "libvpx-dev" in the Dockerfile for this component); no libvpx source
// is vendored, only a small original cgo binding against its public C API
// (vpx_codec_encode / vpx_codec_get_cx_data), analogous to how other Apache/
// BSD/MIT projects (e.g. pion/mediadevices) bind to it.
package vpxenc

/*
#cgo pkg-config: vpx
#include <stdlib.h>
#include <string.h>
#include <vpx/vpx_encoder.h>
#include <vpx/vp8cx.h>

static vpx_codec_iface_t *vp8_iface(void) { return vpx_codec_vp8_cx(); }

// The "frame" member of vpx_codec_cx_pkt_t.data is an anonymous C struct
// inside an anonymous C union, which cgo cannot name from Go. This helper
// extracts the fields we need so Go code never has to reference that type.
static void cx_pkt_frame_data(const vpx_codec_cx_pkt_t *pkt, void **buf, size_t *sz, int *is_key) {
  *buf = pkt->data.frame.buf;
  *sz = pkt->data.frame.sz;
  *is_key = (pkt->data.frame.flags & VPX_FRAME_IS_KEY) ? 1 : 0;
}
*/
import "C"

import (
	"errors"
	"fmt"
	"image"
	"unsafe"
)

// Encoder wraps a libvpx VP8 encoder instance bound to a fixed frame size.
type Encoder struct {
	ctx     C.vpx_codec_ctx_t
	img     C.vpx_image_t
	width   int
	height  int
	frameNo int64

	yPlane []byte
	uPlane []byte
	vPlane []byte
}

// NewEncoder creates a VP8 encoder for width x height frames at the given
// target bitrate (kbit/s) and frame rate (frames/sec).
func NewEncoder(width, height, bitrateKbps, fps int) (*Encoder, error) {
	if width <= 0 || height <= 0 {
		return nil, fmt.Errorf("invalid frame size %dx%d", width, height)
	}

	var cfg C.vpx_codec_enc_cfg_t
	iface := C.vp8_iface()
	if C.vpx_codec_enc_config_default(iface, &cfg, 0) != C.VPX_CODEC_OK {
		return nil, errors.New("vpx_codec_enc_config_default failed")
	}

	cfg.g_w = C.uint(width)
	cfg.g_h = C.uint(height)
	cfg.g_timebase.num = 1
	cfg.g_timebase.den = C.int(fps)
	cfg.rc_target_bitrate = C.uint(bitrateKbps)
	cfg.g_error_resilient = C.VPX_ERROR_RESILIENT_DEFAULT
	cfg.g_lag_in_frames = 0
	cfg.rc_end_usage = C.VPX_CBR
	cfg.g_pass = C.VPX_RC_ONE_PASS
	cfg.kf_mode = C.VPX_KF_AUTO
	cfg.kf_max_dist = C.uint(fps * 2)
	cfg.rc_resize_allowed = 0

	e := &Encoder{width: width, height: height}
	if C.vpx_codec_enc_init_ver(&e.ctx, iface, &cfg, 0, C.VPX_ENCODER_ABI_VERSION) != C.VPX_CODEC_OK {
		return nil, fmt.Errorf("vpx_codec_enc_init failed: %s", C.GoString(C.vpx_codec_error_detail(&e.ctx)))
	}

	if C.vpx_img_alloc(&e.img, C.VPX_IMG_FMT_I420, C.uint(width), C.uint(height), 1) == nil {
		C.vpx_codec_destroy(&e.ctx)
		return nil, errors.New("vpx_img_alloc failed")
	}

	e.yPlane = make([]byte, width*height)
	e.uPlane = make([]byte, (width/2+width%2)*(height/2+height%2))
	e.vPlane = make([]byte, (width/2+width%2)*(height/2+height%2))

	return e, nil
}

// Close releases the underlying libvpx resources.
func (e *Encoder) Close() error {
	C.vpx_img_free(&e.img)
	C.vpx_codec_destroy(&e.ctx)
	return nil
}

// Encode converts rgba to I420 and encodes it as a single VP8 frame,
// returning the encoded bitstream and whether it was a keyframe.
func (e *Encoder) Encode(rgba *image.RGBA) (data []byte, keyframe bool, err error) {
	if rgba.Bounds().Dx() != e.width || rgba.Bounds().Dy() != e.height {
		return nil, false, fmt.Errorf("frame size %dx%d does not match encoder size %dx%d",
			rgba.Bounds().Dx(), rgba.Bounds().Dy(), e.width, e.height)
	}

	rgbaToI420(rgba, e.width, e.height, e.yPlane, e.uPlane, e.vPlane)

	yStride := int(e.img.stride[0])
	uStride := int(e.img.stride[1])
	vStride := int(e.img.stride[2])
	copyPlane(unsafe.Pointer(e.img.planes[0]), yStride, e.yPlane, e.width, e.height)
	cw, ch := (e.width+1)/2, (e.height+1)/2
	copyPlane(unsafe.Pointer(e.img.planes[1]), uStride, e.uPlane, cw, ch)
	copyPlane(unsafe.Pointer(e.img.planes[2]), vStride, e.vPlane, cw, ch)

	flags := C.vpx_enc_frame_flags_t(0)
	deadline := C.ulong(C.VPX_DL_REALTIME)
	if C.vpx_codec_encode(&e.ctx, &e.img, C.vpx_codec_pts_t(e.frameNo), 1, flags, deadline) != C.VPX_CODEC_OK {
		return nil, false, fmt.Errorf("vpx_codec_encode failed: %s", C.GoString(C.vpx_codec_error_detail(&e.ctx)))
	}
	e.frameNo++

	var iter C.vpx_codec_iter_t
	for {
		pkt := C.vpx_codec_get_cx_data(&e.ctx, &iter)
		if pkt == nil {
			break
		}
		if pkt.kind != C.VPX_CODEC_CX_FRAME_PKT {
			continue
		}
		var cbuf unsafe.Pointer
		var csz C.size_t
		var isKey C.int
		C.cx_pkt_frame_data(pkt, &cbuf, &csz, &isKey)
		buf := C.GoBytes(cbuf, C.int(csz))
		data = append(data, buf...)
		keyframe = keyframe || isKey != 0
	}
	return data, keyframe, nil
}

// copyPlane copies a tightly-packed (rowBytes == width) Go byte plane into a
// libvpx image plane, honouring the destination stride.
func copyPlane(dst unsafe.Pointer, dstStride int, src []byte, width, height int) {
	for y := 0; y < height; y++ {
		d := unsafe.Slice((*byte)(unsafe.Add(dst, y*dstStride)), width)
		copy(d, src[y*width:(y+1)*width])
	}
}

// rgbaToI420 converts an image.RGBA frame into planar I420 (YUV 4:2:0)
// using the standard BT.601 studio-swing coefficients, writing into the
// caller-provided, pre-sized y/u/v planes (tightly packed, no stride
// padding).
func rgbaToI420(img *image.RGBA, width, height int, y, u, v []byte) {
	cw := (width + 1) / 2

	for j := 0; j < height; j++ {
		rowOff := img.PixOffset(img.Rect.Min.X, img.Rect.Min.Y+j)
		row := img.Pix[rowOff : rowOff+width*4]
		for i := 0; i < width; i++ {
			r := int32(row[i*4+0])
			g := int32(row[i*4+1])
			b := int32(row[i*4+2])
			y[j*width+i] = clampByte((66*r + 129*g + 25*b + 128) >> 8 + 16)
		}
	}

	for j := 0; j < height; j += 2 {
		rowOff := img.PixOffset(img.Rect.Min.X, img.Rect.Min.Y+j)
		row := img.Pix[rowOff : rowOff+width*4]
		for i := 0; i < width; i += 2 {
			r := int32(row[i*4+0])
			g := int32(row[i*4+1])
			b := int32(row[i*4+2])
			cu := clampByte((-38*r - 74*g + 112*b + 128) >> 8 + 128)
			cv := clampByte((112*r - 94*g - 18*b + 128) >> 8 + 128)
			ci := (j / 2) * cw + (i / 2)
			u[ci] = cu
			v[ci] = cv
		}
	}
}

func clampByte(v int32) byte {
	if v < 0 {
		return 0
	}
	if v > 255 {
		return 255
	}
	return byte(v)
}

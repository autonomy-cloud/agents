// Package rfb implements a minimal RFB (VNC, RFC 6143) client.
//
// This is an original, clean-room implementation written for this
// component. It implements only what is needed to talk to a local Xvnc
// server started with "-SecurityTypes None": the RFB handshake, the
// ClientInit/ServerInit exchange, requesting a fixed 32bpp true-colour
// pixel format, and decoding FramebufferUpdate messages encoded with the
// mandatory Raw encoding (RFC 6143 §7.7.1) into image.RGBA frames.
//
// No third-party VNC client library is used.
package rfb

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"image"
	"io"
	"net"
	"sync"
	"time"
)

// PixelFormat mirrors RFC 6143 §7.4.
type PixelFormat struct {
	BitsPerPixel uint8
	Depth        uint8
	BigEndian    uint8
	TrueColor    uint8
	RedMax       uint16
	GreenMax     uint16
	BlueMax      uint16
	RedShift     uint8
	GreenShift   uint8
	BlueShift    uint8
}

// clientPixelFormat is the fixed 32bpp little-endian BGRX-ish format we
// always request from the server via SetPixelFormat, so decoding never has
// to deal with the server's native (possibly narrower) framebuffer format.
var clientPixelFormat = PixelFormat{
	BitsPerPixel: 32,
	Depth:        24,
	BigEndian:    0,
	TrueColor:    1,
	RedMax:       255,
	GreenMax:     255,
	BlueMax:      255,
	RedShift:     16,
	GreenShift:   8,
	BlueShift:    0,
}

const (
	secTypeNone            = 1
	encodingRaw     int32  = 0
	msgFramebufferUpdate    = 0
	cmdSetPixelFormat       = 0
	cmdSetEncodings         = 2
	cmdFramebufferUpdateReq = 3
)

// Client is a connected RFB session against a single VNC server.
type Client struct {
	conn   net.Conn
	r      *bufio.Reader
	Width  int
	Height int
	Name   string

	mu     sync.Mutex
	frame  *image.RGBA // full composited framebuffer
}

// Dial connects to addr (host:port) and performs the RFB handshake,
// requesting the "None" security type and a fixed 32bpp pixel format.
func Dial(addr string, timeout time.Duration) (*Client, error) {
	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", addr, err)
	}
	c := &Client{conn: conn, r: bufio.NewReaderSize(conn, 64*1024)}
	if err := c.handshake(); err != nil {
		conn.Close()
		return nil, err
	}
	return c, nil
}

// Close closes the underlying connection.
func (c *Client) Close() error { return c.conn.Close() }

func (c *Client) handshake() error {
	// 1. ProtocolVersion handshake (RFC 6143 §7.1.1).
	verBuf := make([]byte, 12)
	if _, err := io.ReadFull(c.r, verBuf); err != nil {
		return fmt.Errorf("read protocol version: %w", err)
	}
	// We always speak 3.8 back; virtually all modern servers, including
	// TigerVNC's Xvnc, support it.
	if _, err := c.conn.Write([]byte("RFB 003.008\n")); err != nil {
		return fmt.Errorf("write protocol version: %w", err)
	}

	// 2. Security handshake (RFC 6143 §7.1.2), version 3.7/3.8 style:
	// a count byte followed by that many security-type bytes.
	nTypes, err := c.readU8()
	if err != nil {
		return fmt.Errorf("read security-type count: %w", err)
	}
	if nTypes == 0 {
		reason, _ := c.readString32()
		return fmt.Errorf("server rejected connection: %s", reason)
	}
	types := make([]byte, nTypes)
	if _, err := io.ReadFull(c.r, types); err != nil {
		return fmt.Errorf("read security types: %w", err)
	}
	found := false
	for _, t := range types {
		if t == secTypeNone {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("server does not offer security type None (offered %v); "+
			"start Xvnc with -SecurityTypes None", types)
	}
	if _, err := c.conn.Write([]byte{secTypeNone}); err != nil {
		return fmt.Errorf("write chosen security type: %w", err)
	}

	// SecurityResult (RFC 6143 §7.1.3).
	result, err := c.readU32()
	if err != nil {
		return fmt.Errorf("read security result: %w", err)
	}
	if result != 0 {
		reason, _ := c.readString32()
		return fmt.Errorf("security handshake failed: %s", reason)
	}

	// 3. ClientInit (RFC 6143 §7.3.1): shared-flag = 1 (non-exclusive).
	if _, err := c.conn.Write([]byte{1}); err != nil {
		return fmt.Errorf("write ClientInit: %w", err)
	}

	// 4. ServerInit (RFC 6143 §7.3.2).
	hdr := make([]byte, 2+2+16+4)
	if _, err := io.ReadFull(c.r, hdr); err != nil {
		return fmt.Errorf("read ServerInit: %w", err)
	}
	c.Width = int(binary.BigEndian.Uint16(hdr[0:2]))
	c.Height = int(binary.BigEndian.Uint16(hdr[2:4]))
	nameLen := binary.BigEndian.Uint32(hdr[20:24])
	nameBuf := make([]byte, nameLen)
	if _, err := io.ReadFull(c.r, nameBuf); err != nil {
		return fmt.Errorf("read desktop name: %w", err)
	}
	c.Name = string(nameBuf)

	c.mu.Lock()
	c.frame = image.NewRGBA(image.Rect(0, 0, c.Width, c.Height))
	c.mu.Unlock()

	// 5. Request our fixed pixel format so decoding is always 32bpp.
	if err := c.setPixelFormat(clientPixelFormat); err != nil {
		return err
	}

	// 6. Advertise that we only understand Raw encoding.
	if err := c.setEncodings([]int32{encodingRaw}); err != nil {
		return err
	}

	return nil
}

func (c *Client) setPixelFormat(pf PixelFormat) error {
	buf := make([]byte, 20)
	buf[0] = cmdSetPixelFormat
	// buf[1:4] padding
	buf[4] = pf.BitsPerPixel
	buf[5] = pf.Depth
	buf[6] = pf.BigEndian
	buf[7] = pf.TrueColor
	binary.BigEndian.PutUint16(buf[8:10], pf.RedMax)
	binary.BigEndian.PutUint16(buf[10:12], pf.GreenMax)
	binary.BigEndian.PutUint16(buf[12:14], pf.BlueMax)
	buf[14] = pf.RedShift
	buf[15] = pf.GreenShift
	buf[16] = pf.BlueShift
	// buf[17:20] padding
	_, err := c.conn.Write(buf)
	return err
}

func (c *Client) setEncodings(encs []int32) error {
	buf := make([]byte, 4+4*len(encs))
	buf[0] = cmdSetEncodings
	binary.BigEndian.PutUint16(buf[2:4], uint16(len(encs)))
	for i, e := range encs {
		binary.BigEndian.PutUint32(buf[4+4*i:8+4*i], uint32(e))
	}
	_, err := c.conn.Write(buf)
	return err
}

// RequestUpdate sends a FramebufferUpdateRequest for the full framebuffer.
// incremental selects incremental (changed-only) vs. full-frame requests.
func (c *Client) RequestUpdate(incremental bool) error {
	buf := make([]byte, 10)
	buf[0] = cmdFramebufferUpdateReq
	if incremental {
		buf[1] = 1
	}
	binary.BigEndian.PutUint16(buf[2:4], 0)
	binary.BigEndian.PutUint16(buf[4:6], 0)
	binary.BigEndian.PutUint16(buf[6:8], uint16(c.Width))
	binary.BigEndian.PutUint16(buf[8:10], uint16(c.Height))
	_, err := c.conn.Write(buf)
	return err
}

// ReadUpdate blocks for the next FramebufferUpdate message, applies its
// rectangles to the internal composited framebuffer, and returns the full,
// current frame. The returned image is owned by the caller until the next
// call to ReadUpdate (it is a fresh copy each time).
func (c *Client) ReadUpdate() (*image.RGBA, error) {
	msgType, err := c.readU8()
	if err != nil {
		return nil, fmt.Errorf("read server message type: %w", err)
	}
	if msgType != msgFramebufferUpdate {
		// We only ever request Raw framebuffer updates and never enable
		// clipboard/bell, but be defensive: skip unknown message types by
		// erroring out clearly rather than desyncing the stream.
		return nil, fmt.Errorf("unexpected server message type %d (expected FramebufferUpdate)", msgType)
	}
	if _, err := c.readU8(); err != nil { // padding
		return nil, err
	}
	nRects, err := c.readU16()
	if err != nil {
		return nil, fmt.Errorf("read rectangle count: %w", err)
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	for i := uint16(0); i < nRects; i++ {
		rectHdr := make([]byte, 12)
		if _, err := io.ReadFull(c.r, rectHdr); err != nil {
			return nil, fmt.Errorf("read rectangle header: %w", err)
		}
		x := int(binary.BigEndian.Uint16(rectHdr[0:2]))
		y := int(binary.BigEndian.Uint16(rectHdr[2:4]))
		w := int(binary.BigEndian.Uint16(rectHdr[4:6]))
		h := int(binary.BigEndian.Uint16(rectHdr[6:8]))
		encoding := int32(binary.BigEndian.Uint32(rectHdr[8:12]))

		if encoding != encodingRaw {
			return nil, fmt.Errorf("unsupported encoding %d (only Raw is implemented)", encoding)
		}

		if err := c.readRawRect(x, y, w, h); err != nil {
			return nil, err
		}
	}

	// Return a copy so the caller can hold onto it while we keep mutating
	// the internal buffer on the next update.
	out := image.NewRGBA(c.frame.Rect)
	copy(out.Pix, c.frame.Pix)
	return out, nil
}

// readRawRect reads w*h pixels in the client's requested 32bpp pixel
// format and writes them into c.frame at (x, y).
func (c *Client) readRawRect(x, y, w, h int) error {
	if w == 0 || h == 0 {
		return nil
	}
	rowBytes := w * 4
	row := make([]byte, rowBytes)
	for j := 0; j < h; j++ {
		if _, err := io.ReadFull(c.r, row); err != nil {
			return fmt.Errorf("read raw rect pixel row: %w", err)
		}
		destY := y + j
		if destY < 0 || destY >= c.Height {
			continue
		}
		for i := 0; i < w; i++ {
			destX := x + i
			if destX < 0 || destX >= c.Width {
				continue
			}
			// clientPixelFormat: byte0=Blue, byte1=Green, byte2=Red, byte3=unused
			// (little-endian 32bpp, red-shift=16, green-shift=8, blue-shift=0).
			b := row[i*4+0]
			g := row[i*4+1]
			r := row[i*4+2]
			off := c.frame.PixOffset(destX, destY)
			c.frame.Pix[off+0] = r
			c.frame.Pix[off+1] = g
			c.frame.Pix[off+2] = b
			c.frame.Pix[off+3] = 0xff
		}
	}
	return nil
}

func (c *Client) readU8() (uint8, error) {
	b, err := c.r.ReadByte()
	return b, err
}

func (c *Client) readU16() (uint16, error) {
	buf := make([]byte, 2)
	if _, err := io.ReadFull(c.r, buf); err != nil {
		return 0, err
	}
	return binary.BigEndian.Uint16(buf), nil
}

func (c *Client) readU32() (uint32, error) {
	buf := make([]byte, 4)
	if _, err := io.ReadFull(c.r, buf); err != nil {
		return 0, err
	}
	return binary.BigEndian.Uint32(buf), nil
}

func (c *Client) readString32() (string, error) {
	n, err := c.readU32()
	if err != nil {
		return "", err
	}
	buf := make([]byte, n)
	if _, err := io.ReadFull(c.r, buf); err != nil {
		return "", err
	}
	return string(buf), nil
}

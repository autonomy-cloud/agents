// Command openagents-workstation runs a real Linux desktop (Xvnc, via an
// absorbed github.com/coder/portabledesktop orchestration library),
// captures its screen over an original RFB (VNC) client, encodes frames as
// VP8, and publishes them as a LiveKit screen-share video track into a
// room on an openagents-server (livekit-server) instance.
package main

import (
	"context"
	"fmt"
	"image"
	"log"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"

	"github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"

	"github.com/autonomy-cloud/openagents-workstation/internal/capture"
	pddesktop "github.com/autonomy-cloud/openagents-workstation/internal/pd/desktop"
	pdruntime "github.com/autonomy-cloud/openagents-workstation/internal/pd/runtime"
	"github.com/autonomy-cloud/openagents-workstation/internal/vpxenc"
)

type config struct {
	openagentsURL string
	apiKey        string
	apiSecret     string
	roomName      string
	identity      string
	runtimeDir    string
	geometry      string
	fps           int
	bitrateKbps   int
}

func loadConfig() config {
	c := config{
		openagentsURL: getenv("OPENAGENTS_URL", "ws://127.0.0.1:7880"),
		apiKey:        getenv("OPENAGENTS_API_KEY", "devkey"),
		apiSecret:     getenv("OPENAGENTS_API_SECRET", "secret"),
		roomName:      getenv("ROOM_NAME", "coworker-standup"),
		// A distinct suffix from openagents-coworker's own default identity
		// (anika-coworker) is deliberate: LiveKit disconnects the earlier
		// connection when a second one joins under the same identity, so
		// the voice agent and this desktop-only participant would fight
		// over the same slot if they shared one. Console/extension UIs key
		// the "AI coworker" badge off an identity *prefix* match, so both
		// still read as the same coworker despite being separate
		// participants.
		identity:    getenv("COWORKER_IDENTITY", "anika-coworker-desktop"),
		runtimeDir:  getenv("PORTABLEDESKTOP_RUNTIME_DIR", "/opt/portabledesktop-runtime"),
		geometry:    getenv("WORKSTATION_GEOMETRY", "1280x800"),
		fps:         getenvInt("WORKSTATION_FPS", 15),
		bitrateKbps: getenvInt("WORKSTATION_BITRATE_KBPS", 2000),
	}
	return c
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getenvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func main() {
	if err := run(); err != nil {
		log.Fatalf("openagents-workstation: %v", err)
	}
}

func run() error {
	cfg := loadConfig()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// 1. Ensure the runtime dir looks sane (bin/Xvnc must exist).
	if err := pdruntime.ValidateRuntimeDir(cfg.runtimeDir); err != nil {
		return fmt.Errorf("runtime dir: %w (set PORTABLEDESKTOP_RUNTIME_DIR to a directory "+
			"containing bin/Xvnc, e.g. the one this component's Dockerfile builds)", err)
	}

	// 2. Start the desktop session (Xvnc, no window manager, no dock —
	// see internal/pd/desktop.Start / NOTICE.md for why).
	desktop, err := pddesktop.Start(cfg.runtimeDir, pddesktop.StartOptions{
		RuntimeDir:      cfg.runtimeDir,
		Geometry:        cfg.geometry,
		DesktopSizeMode: "fixed",
		Openbox:         pddesktop.BoolPtr(false),
		Dock:            pddesktop.BoolPtr(false),
		Detached:        false,
		Background:      &pddesktop.BackgroundOptions{}, // no-op: skip xsetroot/xwallpaper deps
	})
	if err != nil {
		return fmt.Errorf("start desktop: %w", err)
	}
	log.Printf("desktop session up: display=:%d vnc=127.0.0.1:%d session=%s",
		desktop.Display, desktop.VNCPort, desktop.SessionDir)
	defer func() {
		log.Printf("tearing down desktop session")
		if err := desktop.Kill(pddesktop.KillOptions{}); err != nil {
			log.Printf("desktop teardown error: %v", err)
		}
	}()

	// 3. Connect the RFB client to Xvnc's VNC port.
	vncAddr := fmt.Sprintf("127.0.0.1:%d", desktop.VNCPort)
	src, err := capture.Dial(vncAddr, cfg.fps, 15*time.Second)
	if err != nil {
		return fmt.Errorf("connect to VNC at %s: %w", vncAddr, err)
	}
	defer src.Close()
	log.Printf("rfb client connected: %dx%d", src.Width(), src.Height())

	// 4. Set up the VP8 encoder and LiveKit video track.
	enc, err := vpxenc.NewEncoder(src.Width(), src.Height(), cfg.bitrateKbps, cfg.fps)
	if err != nil {
		return fmt.Errorf("create vp8 encoder: %w", err)
	}
	defer enc.Close()

	track, err := lksdk.NewLocalTrack(webrtc.RTPCodecCapability{
		MimeType:  webrtc.MimeTypeVP8,
		ClockRate: 90000,
	})
	if err != nil {
		return fmt.Errorf("create local track: %w", err)
	}

	provider := &frameProvider{
		enc:         enc,
		frameDur:    time.Second / time.Duration(cfg.fps),
		frameCh:     make(chan *image.RGBA, 1),
		initialSize: image.Rect(0, 0, src.Width(), src.Height()),
	}
	track.OnBind(func() {
		if err := track.StartWrite(provider, func() { log.Printf("track write loop stopped") }); err != nil {
			log.Printf("start write failed: %v", err)
		}
	})

	// 5. Connect to the LiveKit room and publish the track as a
	// screen-share source.
	room, err := lksdk.ConnectToRoom(cfg.openagentsURL, lksdk.ConnectInfo{
		APIKey:              cfg.apiKey,
		APISecret:           cfg.apiSecret,
		RoomName:            cfg.roomName,
		ParticipantIdentity: cfg.identity,
	}, &lksdk.RoomCallback{},
		// The SDK's default 5s ICE connect timeout is too tight when this
		// container reaches the server through Docker's host-networking
		// hairpin path (host.docker.internal / TURN relay to the host's own
		// LAN IP) instead of a normal host or STUN candidate pair — that
		// path can complete but needs longer than 5s under load. This is
		// generous, not a workaround for a specific broken path: it just
		// gives slower-but-working candidate checks room to finish.
		lksdk.WithConnectTimeout(20*time.Second),
	)
	if err != nil {
		return fmt.Errorf("connect to room %q at %s: %w", cfg.roomName, cfg.openagentsURL, err)
	}
	log.Printf("connected to room %q at %s as %q", cfg.roomName, cfg.openagentsURL, cfg.identity)
	defer room.Disconnect()

	pub, err := room.LocalParticipant.PublishTrack(track, &lksdk.TrackPublicationOptions{
		Name:        "workstation-screen",
		Source:      livekit.TrackSource_SCREEN_SHARE,
		VideoWidth:  src.Width(),
		VideoHeight: src.Height(),
	})
	if err != nil {
		return fmt.Errorf("publish track: %w", err)
	}
	log.Printf("published screen-share track sid=%s", pub.SID())

	// 6. Pump RFB frames into the encoder/track until shutdown.
	var wg sync.WaitGroup
	captureCtx, cancelCapture := context.WithCancel(ctx)
	wg.Add(1)
	go func() {
		defer wg.Done()
		err := src.Run(captureCtx, func(frame *image.RGBA) {
			select {
			case provider.frameCh <- frame:
			default:
				select {
				case <-provider.frameCh:
				default:
				}
				provider.frameCh <- frame
			}
		})
		if err != nil && captureCtx.Err() == nil {
			log.Printf("capture loop error: %v", err)
			cancelCapture()
		}
	}()

	<-ctx.Done()
	log.Printf("shutting down")
	cancelCapture()
	wg.Wait()

	if err := room.LocalParticipant.UnpublishTrack(pub.SID()); err != nil {
		log.Printf("unpublish track: %v", err)
	}
	return nil
}

// frameProvider implements lksdk.SampleProvider, encoding the most recent
// captured RFB frame as VP8 on every tick requested by the LocalTrack's
// write loop.
type frameProvider struct {
	lksdk.BaseSampleProvider
	enc         *vpxenc.Encoder
	frameDur    time.Duration
	frameCh     chan *image.RGBA
	initialSize image.Rectangle

	mu   sync.Mutex
	last *image.RGBA
}

func (p *frameProvider) NextSample(ctx context.Context) (media.Sample, error) {
	select {
	case f := <-p.frameCh:
		p.mu.Lock()
		p.last = f
		p.mu.Unlock()
	default:
	}

	p.mu.Lock()
	frame := p.last
	p.mu.Unlock()

	if frame == nil {
		frame = image.NewRGBA(p.initialSize)
	}

	data, _, err := p.enc.Encode(frame)
	if err != nil {
		return media.Sample{}, fmt.Errorf("encode frame: %w", err)
	}

	return media.Sample{
		Data:     data,
		Duration: p.frameDur,
	}, nil
}

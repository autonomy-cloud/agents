// Package capture drives the RFB client at a target frame rate and hands
// full framebuffer frames to a callback, so the publisher does not need to
// know anything about the VNC protocol.
package capture

import (
	"context"
	"fmt"
	"image"
	"time"

	"github.com/autonomy-cloud/openagents-workstation/internal/rfb"
)

// Source polls an RFB (VNC) server for framebuffer updates at a fixed rate.
type Source struct {
	client *rfb.Client
	fps    int
}

// Dial connects to the given VNC address (host:port) and returns a Source
// that will poll it at fps frames per second.
func Dial(addr string, fps int, timeout time.Duration) (*Source, error) {
	c, err := rfb.Dial(addr, timeout)
	if err != nil {
		return nil, err
	}
	if fps <= 0 {
		fps = 15
	}
	return &Source{client: c, fps: fps}, nil
}

// Width returns the remote framebuffer width in pixels.
func (s *Source) Width() int { return s.client.Width }

// Height returns the remote framebuffer height in pixels.
func (s *Source) Height() int { return s.client.Height }

// Close closes the underlying RFB connection.
func (s *Source) Close() error { return s.client.Close() }

// Run polls for framebuffer updates at the configured frame rate and
// invokes onFrame for every decoded frame, until ctx is done or an error
// occurs. The first request is a full (non-incremental) update; subsequent
// requests are incremental.
func (s *Source) Run(ctx context.Context, onFrame func(*image.RGBA)) error {
	interval := time.Second / time.Duration(s.fps)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	if err := s.client.RequestUpdate(false); err != nil {
		return fmt.Errorf("initial framebuffer update request: %w", err)
	}

	updates := make(chan *image.RGBA, 1)
	errs := make(chan error, 1)
	go func() {
		for {
			frame, err := s.client.ReadUpdate()
			if err != nil {
				errs <- err
				return
			}
			select {
			case updates <- frame:
			default:
				// Drop the previous unread frame; we only care about the
				// latest one.
				select {
				case <-updates:
				default:
				}
				updates <- frame
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-errs:
			return fmt.Errorf("rfb read: %w", err)
		case frame := <-updates:
			onFrame(frame)
		case <-ticker.C:
			if err := s.client.RequestUpdate(true); err != nil {
				return fmt.Errorf("framebuffer update request: %w", err)
			}
		}
	}
}

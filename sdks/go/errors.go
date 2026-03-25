package seentics

import (
	"fmt"
	"runtime/debug"
	"time"
)

// ErrorEvent is the payload sent to POST /api/v1/observability/errors/ingest.
type ErrorEvent struct {
	Timestamp   time.Time         `json:"timestamp"`
	ProjectID   string            `json:"project_id"`
	Service     string            `json:"service"`
	ErrorType   string            `json:"error_type"`
	Message     string            `json:"message"`
	StackTrace  string            `json:"stack_trace,omitempty"`
	Environment string            `json:"environment,omitempty"`
	Release     string            `json:"release,omitempty"`
	UserID      string            `json:"user_id,omitempty"`
	Attributes  map[string]string `json:"attributes,omitempty"`
}

// ErrorOptions are optional fields for CaptureError.
type ErrorOptions struct {
	// UserID is the end-user associated with the error.
	UserID string
	// Release is the application version/release tag.
	Release string
	// SkipStackTrace disables automatic stack trace capture.
	SkipStackTrace bool
	// Attributes are extra key-value pairs attached to the error group.
	Attributes map[string]string
}

// CaptureError records an error in the Seentics error tracker.
// The stack trace is captured automatically via runtime/debug.Stack().
//
//	defer func() {
//	    if r := recover(); r != nil {
//	        seentics.CaptureError(fmt.Errorf("%v", r))
//	    }
//	}()
func (c *Client) CaptureError(err error, opts ...ErrorOptions) {
	if err == nil {
		return
	}
	e := ErrorEvent{
		Timestamp:   time.Now().UTC(),
		ProjectID:   c.cfg.ProjectID,
		Service:     c.cfg.Service,
		Environment: c.cfg.Environment,
		ErrorType:   errorTypeName(err),
		Message:     err.Error(),
	}
	if len(opts) > 0 {
		o := opts[0]
		e.UserID     = o.UserID
		e.Release    = o.Release
		e.Attributes = o.Attributes
		if !o.SkipStackTrace {
			e.StackTrace = string(debug.Stack())
		}
	} else {
		e.StackTrace = string(debug.Stack())
	}
	if c.errorBuf.add(e) {
		c.triggerFlush()
	}
}

// errorTypeName extracts the type name from an error.
// For errors created via errors.New / fmt.Errorf it returns "*errors.errorString".
// Wrap your errors with a named type to get a more useful group name in the dashboard.
func errorTypeName(err error) string {
	if err == nil {
		return ""
	}
	t := fmt.Sprintf("%T", err)
	return t
}

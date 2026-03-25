// Package seentics provides a Go SDK for sending logs, errors, and traces
// to your Seentics observability instance.
//
// Usage:
//
//	client := seentics.New(seentics.Config{
//	    APIKey:  "sk_proj_...",
//	    Service: "checkout-service",
//	})
//	defer client.Flush()
//
//	log := zerolog.New(client.Writer()).With().Timestamp().Logger()
//	ctx, span := client.StartSpan(ctx, "process-payment")
//	defer span.End()
package seentics

// Config holds the SDK configuration.
type Config struct {
	APIKey      string
	Service     string
	Environment string
	BaseURL     string
}

// Client is the main SDK entry point.
type Client struct {
	// TODO: implement
}

// New creates a new Seentics client.
func New(cfg Config) *Client {
	// TODO: implement
	return &Client{}
}

// Flush flushes any buffered events. Call with defer in main().
func (c *Client) Flush() {
	// TODO: implement
}

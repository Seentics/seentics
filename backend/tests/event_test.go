package tests

import (
	"analytics-app/models"
	"analytics-app/utils"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateEvent(t *testing.T) {
	tests := []struct {
		name    string
		event   models.Event
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid pageview event",
			event: models.Event{
				WebsiteID: "test-site",
				VisitorID: "visitor-123",
				SessionID: "session-456",
				Page:      "https://example.com/page",
				EventType: "pageview",
			},
			wantErr: false,
		},
		{
			name: "missing website_id",
			event: models.Event{
				VisitorID: "visitor-123",
				SessionID: "session-456",
				Page:      "https://example.com/page",
			},
			wantErr: true,
			errMsg:  "website_id is required",
		},
		{
			name: "missing visitor_id",
			event: models.Event{
				WebsiteID: "test-site",
				SessionID: "session-456",
				Page:      "https://example.com/page",
			},
			wantErr: true,
			errMsg:  "visitor_id is required",
		},
		{
			name: "invalid page URL",
			event: models.Event{
				WebsiteID: "test-site",
				VisitorID: "visitor-123",
				SessionID: "session-456",
				Page:      "not-a-url",
			},
			wantErr: true,
			errMsg:  "page must be a valid URL",
		},
		{
			name: "invalid scroll depth",
			event: models.Event{
				WebsiteID:  "test-site",
				VisitorID:  "visitor-123",
				SessionID:  "session-456",
				Page:       "https://example.com/page",
				TimeOnPage: intPtr(150),
			},
			wantErr: true,
			errMsg:  "scroll_depth must be between 0 and 100",
		},
		{
			name: "valid relative URL",
			event: models.Event{
				WebsiteID: "test-site",
				VisitorID: "visitor-123",
				SessionID: "session-456",
				Page:      "/relative/page",
				EventType: "pageview",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := utils.ValidateEvent(&tt.event)

			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestEventProperties(t *testing.T) {
	properties := models.Properties{
		"custom_field": "value",
		"number_field": 42,
		"bool_field":   true,
	}

	// Test JSON marshaling
	value, err := properties.Value()
	require.NoError(t, err)
	assert.NotNil(t, value)

	// Test JSON unmarshaling
	var newProperties models.Properties
	err = newProperties.Scan(value)
	require.NoError(t, err)
	assert.Equal(t, properties, newProperties)
}

func TestEventTimestamp(t *testing.T) {
	event := models.Event{
		WebsiteID: "test-site",
		VisitorID: "visitor-123",
		SessionID: "session-456",
		Page:      "/test",
		Timestamp: time.Now(),
	}

	assert.False(t, event.Timestamp.IsZero())
	assert.True(t, time.Since(event.Timestamp) < time.Second)
}

// Helper functions for tests
func intPtr(i int) *int {
	return &i
}

func stringPtr(s string) *string {
	return &s
}

func float64Ptr(f float64) *float64 {
	return &f
}

func boolPtr(b bool) *bool {
	return &b
}

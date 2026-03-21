package privacy

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ImportPayload represents the JSON structure of an exported data file
type ImportPayload struct {
	WebsiteID string          `json:"website_id"`
	Events    json.RawMessage `json:"events"`
	Sessions  json.RawMessage `json:"sessions"`
	Goals     json.RawMessage `json:"goals"`
	Funnels   json.RawMessage `json:"funnels"`
}

type importEvent struct {
	VisitorID   string                 `json:"visitor_id"`
	SessionID   string                 `json:"session_id"`
	EventType   string                 `json:"event_type"`
	Page        string                 `json:"page"`
	Referrer    *string                `json:"referrer"`
	UserAgent   *string                `json:"user_agent"`
	IPAddress   *string                `json:"ip_address"`
	Country     *string                `json:"country"`
	City        *string                `json:"city"`
	Browser     *string                `json:"browser"`
	Device      *string                `json:"device"`
	OS          *string                `json:"os"`
	UTMSource   *string                `json:"utm_source"`
	UTMMedium   *string                `json:"utm_medium"`
	UTMCampaign *string                `json:"utm_campaign"`
	UTMTerm     *string                `json:"utm_term"`
	UTMContent  *string                `json:"utm_content"`
	TimeOnPage  *int                   `json:"time_on_page"`
	Properties  map[string]interface{} `json:"properties"`
	Timestamp   *time.Time             `json:"timestamp"`
}

type importSession struct {
	VisitorID string     `json:"visitor_id"`
	SessionID string     `json:"session_id"`
	StartTime *time.Time `json:"start_time"`
	EntryTime *time.Time `json:"entry_time"`
	ExitTime  *time.Time `json:"exit_time"`
}

type importGoal struct {
	Name       string   `json:"name"`
	Type       string   `json:"type"`
	Identifier string   `json:"identifier"`
	Selector   *string  `json:"selector"`
	Revenue    *float64 `json:"revenue"`
	Currency   *string  `json:"currency"`
}

type importFunnel struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Steps       json.RawMessage `json:"steps"`
	IsActive    bool            `json:"is_active"`
	UserID      string          `json:"user_id"`
}

// ImportWebsiteData imports analytics data from a JSON export into a website
func (r *PrivacyRepository) ImportWebsiteData(websiteID string, data []byte) (map[string]int, error) {
	ctx := context.Background()
	counts := map[string]int{
		"events":   0,
		"sessions": 0,
		"goals":    0,
		"funnels":  0,
	}

	// Try to parse as full export (has nested structure with data.events[0].data)
	// or as flat structure (events array directly)
	var payload ImportPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("invalid JSON format: %w", err)
	}

	// Import events
	if len(payload.Events) > 0 {
		var rawEvents json.RawMessage
		// Check if events is the nested export format (array of {data: [...]})
		var nested []struct {
			Data json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal(payload.Events, &nested); err == nil && len(nested) > 0 && len(nested[0].Data) > 0 {
			rawEvents = nested[0].Data
		} else {
			rawEvents = payload.Events
		}

		var events []importEvent
		if err := json.Unmarshal(rawEvents, &events); err == nil {
			for _, e := range events {
				if e.EventType == "" || e.Page == "" {
					continue
				}
				ts := time.Now()
				if e.Timestamp != nil {
					ts = *e.Timestamp
				}
				var propsJSON []byte
				if e.Properties != nil {
					propsJSON, _ = json.Marshal(e.Properties)
				}
				visitorID := e.VisitorID
				if visitorID == "" {
					visitorID = uuid.New().String()
				}
				sessionID := e.SessionID
				if sessionID == "" {
					sessionID = uuid.New().String()
				}

				_, err := r.db.Exec(ctx, `
					INSERT INTO events (id, website_id, visitor_id, session_id, event_type, page, referrer,
						user_agent, ip_address, country, city, browser, device, os,
						utm_source, utm_medium, utm_campaign, utm_term, utm_content,
						time_on_page, properties, timestamp, created_at)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
				`, uuid.New(), websiteID, visitorID, sessionID, e.EventType, e.Page, e.Referrer,
					e.UserAgent, e.IPAddress, e.Country, e.City, e.Browser, e.Device, e.OS,
					e.UTMSource, e.UTMMedium, e.UTMCampaign, e.UTMTerm, e.UTMContent,
					e.TimeOnPage, propsJSON, ts, time.Now())
				if err != nil {
					continue // skip individual failures
				}
				counts["events"]++
			}
		}
	}

	// Import sessions
	if len(payload.Sessions) > 0 {
		var rawSessions json.RawMessage
		var nested []struct {
			Data json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal(payload.Sessions, &nested); err == nil && len(nested) > 0 && len(nested[0].Data) > 0 {
			rawSessions = nested[0].Data
		} else {
			rawSessions = payload.Sessions
		}

		var sessions []importSession
		if err := json.Unmarshal(rawSessions, &sessions); err == nil {
			for _, s := range sessions {
				if s.SessionID == "" {
					continue
				}
				now := time.Now()
				st := now
				if s.StartTime != nil {
					st = *s.StartTime
				}
				et := st
				if s.EntryTime != nil {
					et = *s.EntryTime
				}
				xt := st
				if s.ExitTime != nil {
					xt = *s.ExitTime
				}
				visitorID := s.VisitorID
				if visitorID == "" {
					visitorID = uuid.New().String()
				}

				_, err := r.db.Exec(ctx, `
					INSERT INTO sessions (id, website_id, visitor_id, session_id, start_time, entry_time, exit_time, created_at)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
					ON CONFLICT (session_id) DO NOTHING
				`, uuid.New(), websiteID, visitorID, s.SessionID, st, et, xt, now)
				if err != nil {
					continue
				}
				counts["sessions"]++
			}
		}
	}

	// Import goals
	if len(payload.Goals) > 0 {
		var rawGoals json.RawMessage
		var nested []struct {
			Data json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal(payload.Goals, &nested); err == nil && len(nested) > 0 && len(nested[0].Data) > 0 {
			rawGoals = nested[0].Data
		} else {
			rawGoals = payload.Goals
		}

		var goals []importGoal
		if err := json.Unmarshal(rawGoals, &goals); err == nil {
			for _, g := range goals {
				if g.Name == "" || g.Type == "" || g.Identifier == "" {
					continue
				}
				now := time.Now()
				_, err := r.db.Exec(ctx, `
					INSERT INTO goals (id, website_id, name, type, identifier, selector, revenue, currency, created_at, updated_at)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
				`, uuid.New(), websiteID, g.Name, g.Type, g.Identifier, g.Selector, g.Revenue, g.Currency, now, now)
				if err != nil {
					continue
				}
				counts["goals"]++
			}
		}
	}

	// Import funnels
	if len(payload.Funnels) > 0 {
		var rawFunnels json.RawMessage
		var nested []struct {
			Data struct {
				Funnels json.RawMessage `json:"funnels"`
			} `json:"data"`
		}
		if err := json.Unmarshal(payload.Funnels, &nested); err == nil && len(nested) > 0 && len(nested[0].Data.Funnels) > 0 {
			rawFunnels = nested[0].Data.Funnels
		} else {
			rawFunnels = payload.Funnels
		}

		var funnels []importFunnel
		if err := json.Unmarshal(rawFunnels, &funnels); err == nil {
			for _, f := range funnels {
				if f.Name == "" {
					continue
				}
				now := time.Now()
				userID := f.UserID
				if userID == "" {
					userID = uuid.New().String()
				}
				_, err := r.db.Exec(ctx, `
					INSERT INTO funnels (id, name, description, website_id, user_id, steps, is_active, created_at, updated_at)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				`, uuid.New(), f.Name, f.Description, websiteID, userID, f.Steps, f.IsActive, now, now)
				if err != nil {
					continue
				}
				counts["funnels"]++
			}
		}
	}

	r.LogPrivacyOperation("import_data", websiteID, fmt.Sprintf("Imported %d events, %d sessions, %d goals, %d funnels", counts["events"], counts["sessions"], counts["goals"], counts["funnels"]))
	return counts, nil
}

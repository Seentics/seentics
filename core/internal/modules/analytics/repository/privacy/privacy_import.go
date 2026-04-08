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

// ImportWebsiteData imports analytics metadata from a JSON export into a website.
// Note: raw events are stored in ClickHouse and cannot be bulk-imported via this endpoint.
// Only sessions, goals, and funnels (PostgreSQL-backed) are restored here.
func (r *PrivacyRepository) ImportWebsiteData(websiteID string, data []byte) (map[string]int, error) {
	ctx := context.Background()
	counts := map[string]int{
		"sessions": 0,
		"goals":    0,
		"funnels":  0,
	}

	var payload ImportPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("invalid JSON format: %w", err)
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

	r.LogPrivacyOperation("import_data", websiteID, fmt.Sprintf(
		"Imported %d sessions, %d goals, %d funnels (events import skipped — ClickHouse-backed)",
		counts["sessions"], counts["goals"], counts["funnels"],
	))
	return counts, nil
}

package services

import (
	"context"
	"fmt"

	"github.com/Seentics/seentics/internal/modules/replays/models"
	"github.com/Seentics/seentics/internal/modules/replays/repository"
	"github.com/Seentics/seentics/internal/shared/utils"
	"github.com/rs/zerolog"
)

type TrackerEvent struct {
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
	TS   int64                  `json:"ts"`
	URL  string                 `json:"url"`
	SID  string                 `json:"sid"`
	VID  string                 `json:"vid"`
}

type ReplayService struct {
	repo   *repository.ReplayRepository
	logger zerolog.Logger
}

func NewReplayService(repo *repository.ReplayRepository, logger zerolog.Logger) *ReplayService {
	return &ReplayService{repo: repo, logger: logger}
}

// ProcessEvents groups events by session and persists each group as one S3 chunk.
func (s *ReplayService) ProcessEvents(ctx context.Context, websiteID string, events []TrackerEvent, ua, ip string) error {
	// Group by session
	type sessionBatch struct {
		events []map[string]interface{}
		tsMs   int64 // timestamp of first event in batch
		isNew  bool  // session not seen before in this batch
	}
	grouped := make(map[string]*sessionBatch)
	for _, ev := range events {
		if ev.SID == "" {
			continue
		}
		b, exists := grouped[ev.SID]
		if !exists {
			b = &sessionBatch{tsMs: ev.TS, isNew: true}
			grouped[ev.SID] = b
		}
		b.events = append(b.events, map[string]interface{}{
			"type": ev.Type, "ts": ev.TS, "url": ev.URL,
			"sid": ev.SID, "vid": ev.VID, "data": ev.Data,
		})
		if ev.TS < b.tsMs {
			b.tsMs = ev.TS // use earliest ts as S3 key for ordering
		}
	}

	// Resolve metadata once per UA+IP (shared across all sessions in the batch)
	uaInfo := utils.ParseUserAgent(ua)
	locInfo := utils.GetLocationFromIP(ip)

	for sessionID, batch := range grouped {
		var meta *models.SessionMeta
		if batch.isNew {
			entryURL := ""
			if len(batch.events) > 0 {
				if u, ok := batch.events[0]["url"].(string); ok {
					entryURL = u
				}
			}
			meta = &models.SessionMeta{
				Browser:   uaInfo.Browser,
				Device:    uaInfo.Device,
				OS:        uaInfo.OS,
				Country:   locInfo.Country,
				EntryPage: entryURL,
			}
		}
		if err := s.repo.SaveChunk(ctx, websiteID, sessionID, batch.tsMs, batch.events, meta); err != nil {
			s.logger.Warn().Err(err).Str("session_id", sessionID).Msg("replay: save chunk failed")
		}
	}
	return nil
}

func (s *ReplayService) ListSessions(ctx context.Context, websiteID string, limit, offset int) ([]models.Session, error) {
	sessions, err := s.repo.ListSessions(ctx, websiteID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list sessions: %w", err)
	}
	return sessions, nil
}

func (s *ReplayService) GetSession(ctx context.Context, websiteID, sessionID string) ([]models.ReplayChunk, error) {
	return s.repo.GetChunks(ctx, websiteID, sessionID)
}

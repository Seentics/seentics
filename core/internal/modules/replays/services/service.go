package services

import (
	"context"
	"fmt"
	"time"

	"github.com/Seentics/seentics/internal/modules/replays/models"
	"github.com/Seentics/seentics/internal/modules/replays/repository"
	websiteRepo "github.com/Seentics/seentics/internal/modules/websites/repository"
	"github.com/Seentics/seentics/internal/shared/utils"
	"github.com/google/uuid"
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
	repo        *repository.ReplayRepository
	websiteRepo *websiteRepo.WebsiteRepository
	logger      zerolog.Logger
}

func NewReplayService(repo *repository.ReplayRepository, websiteRepo *websiteRepo.WebsiteRepository, logger zerolog.Logger) *ReplayService {
	return &ReplayService{repo: repo, websiteRepo: websiteRepo, logger: logger}
}

// resolveIDs retrieves both the UUID and the SiteID for a given website identification string.
func (s *ReplayService) resolveIDs(ctx context.Context, websiteID string) (string, string, error) {
	uid, err := uuid.Parse(websiteID)
	if err == nil {
		// It's a UUID, look up the SiteID
		w, err := s.websiteRepo.GetByUUIDOnly(ctx, uid)
		if err != nil {
			return "", websiteID, fmt.Errorf("website uuid resolution failed: %w", err)
		}
		return w.SiteID, websiteID, nil
	}

	// Not a UUID, assume it's a SiteID, look up the UUID
	w, err := s.websiteRepo.GetBySiteID(ctx, websiteID)
	if err != nil {
		return websiteID, "", fmt.Errorf("website site_id resolution failed: %w", err)
	}
	return websiteID, w.ID.String(), nil
}

func (s *ReplayService) ProcessEvents(ctx context.Context, websiteID string, events []TrackerEvent, ua, ip string) error {
	type sessionBatch struct {
		events  []map[string]interface{}
		startTs int64
		endTs   int64
	}
	grouped := make(map[string]*sessionBatch)
	for _, ev := range events {
		if ev.SID == "" { continue }
		b, exists := grouped[ev.SID]
		if !exists {
			b = &sessionBatch{startTs: ev.TS, endTs: ev.TS}
			grouped[ev.SID] = b
		}
		b.events = append(b.events, map[string]interface{}{
			"type": ev.Type, "ts": ev.TS, "url": ev.URL,
			"sid": ev.SID, "vid": ev.VID, "data": ev.Data,
		})
		if ev.TS < b.startTs { b.startTs = ev.TS }
		if ev.TS > b.endTs   { b.endTs = ev.TS }
	}

	uaInfo := utils.ParseUserAgent(ua)
	locInfo := utils.GetLocationFromIP(ip)

	for sessionID, batch := range grouped {
		var meta *models.SessionMeta
		pageIncrements := 0

		// A batch is "new" only if it contains a FullSnapshot (rrweb event type 2).
		// This prevents over-counting pages and re-writing metadata on every flush.
		hasFullSnapshot := false
		for _, ev := range events {
			if ev.SID != sessionID || ev.Type != "rrweb" { continue }
			if t, ok := ev.Data["type"].(float64); ok && int(t) == 2 {
				hasFullSnapshot = true
				break
			}
		}

		if hasFullSnapshot {
			pageIncrements = 1
			entryURL := ""
			if len(batch.events) > 0 {
				if u, ok := batch.events[0]["url"].(string); ok { entryURL = u }
			}
			meta = &models.SessionMeta{
				Browser: uaInfo.Browser, Device: uaInfo.Device, OS: uaInfo.OS,
				Country: locInfo.Country, EntryPage: entryURL,
			}
		}

		rageClicks := detectRageClicksFromTrackerEvents(events, sessionID)
		durationInBatch := int((batch.endTs - batch.startTs) / 1000)
		tsToUse := batch.endTs
		if hasFullSnapshot { tsToUse = batch.startTs }

		if err := s.repo.SaveChunk(ctx, websiteID, sessionID, tsToUse, batch.events, meta, pageIncrements, durationInBatch, rageClicks); err != nil {
			s.logger.Warn().Err(err).Str("session_id", sessionID).Msg("replay: save chunk failed")
		}
	}
	return nil
}

type rageClick struct{ ts int64; x, y float64 }

// detectRageClicksFromTrackerEvents checks whether a session's rrweb-envelope events
// contain rage clicks (3+ clicks within 50px and 1s).
func detectRageClicksFromTrackerEvents(events []TrackerEvent, sessionID string) bool {
	var clicks []rageClick
	for _, ev := range events {
		if ev.SID != sessionID || ev.Type != "rrweb" { continue }
		rrwEvType, _ := ev.Data["type"].(float64)
		if int(rrwEvType) != 3 { continue } // IncrementalSnapshot
		inner, _ := ev.Data["data"].(map[string]interface{})
		if inner == nil { continue }
		src, _ := inner["source"].(float64)
		ct, _ := inner["type"].(float64)
		if int(src) != 2 || int(ct) != 2 { continue } // MouseInteraction / Click
		x, _ := inner["x"].(float64)
		y, _ := inner["y"].(float64)
		ts, _ := ev.Data["timestamp"].(float64)
		clicks = append(clicks, rageClick{ts: int64(ts), x: x, y: y})
	}
	return hasRageClickPattern(clicks)
}

// detectRageClicksFromRRWeb checks raw rrweb events (already unwrapped from envelope).
func detectRageClicksFromRRWeb(events []map[string]interface{}) bool {
	var clicks []rageClick
	for _, ev := range events {
		t, _ := ev["type"].(float64)
		if int(t) != 3 { continue }
		inner, _ := ev["data"].(map[string]interface{})
		if inner == nil { continue }
		src, _ := inner["source"].(float64)
		ct, _ := inner["type"].(float64)
		if int(src) != 2 || int(ct) != 2 { continue }
		x, _ := inner["x"].(float64)
		y, _ := inner["y"].(float64)
		ts, _ := ev["timestamp"].(float64)
		clicks = append(clicks, rageClick{ts: int64(ts), x: x, y: y})
	}
	return hasRageClickPattern(clicks)
}

func hasRageClickPattern(clicks []rageClick) bool {
	for i := 0; i < len(clicks); i++ {
		count := 1
		for j := i + 1; j < len(clicks); j++ {
			if clicks[j].ts-clicks[i].ts > 1000 { break }
			dx := clicks[j].x - clicks[i].x
			dy := clicks[j].y - clicks[i].y
			if dx*dx+dy*dy <= 2500 { // 50px radius
				count++
			}
		}
		if count >= 3 { return true }
	}
	return false
}

func (s *ReplayService) ListSessions(ctx context.Context, websiteID string, limit, offset int) ([]models.Session, error) {
	siteID, uuidStr, err := s.resolveIDs(ctx, websiteID)
	if err != nil {
		s.logger.Warn().Err(err).Str("input_id", websiteID).Msg("list sessions: id resolution failed")
		return s.repo.ListSessions(ctx, websiteID, websiteID, limit, offset)
	}

    s.logger.Info().
        Str("input", websiteID).
        Str("resolved_site", siteID).
        Str("resolved_uuid", uuidStr).
        Msg("ListSessions: ID Resolution diagnostic")

	return s.repo.ListSessions(ctx, siteID, uuidStr, limit, offset)
}


func (s *ReplayService) GetSession(ctx context.Context, websiteID, sessionID string) (*models.Session, []models.ReplayChunk, error) {
	siteID, uuidStr, err := s.resolveIDs(ctx, websiteID)
	if err != nil {
		s.logger.Warn().Err(err).Str("input_id", websiteID).Msg("get session: id resolution failed")
		siteID, uuidStr = websiteID, websiteID
	}
	
	meta, err := s.repo.GetSessionMeta(ctx, siteID, uuidStr, sessionID)
	if err != nil { s.logger.Warn().Err(err).Msg("get session: meta fetch failed") }
	
	// For chunks (S3), we use siteID as it's the standard for keys
	chunks, err := s.repo.GetChunks(ctx, siteID, sessionID)
	if err != nil { return meta, nil, fmt.Errorf("get session chunks: %w", err) }
	return meta, chunks, nil
}

func (s *ReplayService) ProcessRRWebChunk(ctx context.Context, websiteID, sessionID, visitorID string, events []map[string]interface{}, ua, ip string) error {
	if len(events) == 0 { return nil }

	var minTs, maxTs int64
	for i, ev := range events {
		if ts, ok := ev["timestamp"].(float64); ok && int64(ts) > 0 {
			if i == 0 || int64(ts) < minTs { minTs = int64(ts) }
			if i == 0 || int64(ts) > maxTs { maxTs = int64(ts) }
		}
	}
	if minTs == 0 { minTs = time.Now().UnixMilli() }
	if maxTs == 0 { maxTs = minTs }

	var meta *models.SessionMeta
	entryURL := ""
	pageIncrements := 0
	hasFullSnapshot := false
	for _, ev := range events {
		t, _ := ev["type"].(float64)
		if int(t) == 4 { // Meta
			if data, ok := ev["data"].(map[string]interface{}); ok {
				if href, ok := data["href"].(string); ok { entryURL = href; pageIncrements++ }
			}
		}
		if int(t) == 2 { hasFullSnapshot = true; if entryURL == "" { pageIncrements++ } }
	}
	if hasFullSnapshot && pageIncrements == 0 { pageIncrements = 1 }

	if hasFullSnapshot {
		uaInfo  := utils.ParseUserAgent(ua); locInfo := utils.GetLocationFromIP(ip)
		meta = &models.SessionMeta{
			Browser: uaInfo.Browser, Device: uaInfo.Device, OS: uaInfo.OS,
			Country: locInfo.Country, EntryPage: entryURL,
		}
	}

	durationInBatch := int((maxTs - minTs) / 1000)
	tsToUse := maxTs
	if meta != nil { tsToUse = minTs }

	rageClicks := detectRageClicksFromRRWeb(events)
	if err := s.repo.SaveChunk(ctx, websiteID, sessionID, tsToUse, events, meta, pageIncrements, durationInBatch, rageClicks); err != nil {
		s.logger.Warn().Err(err).Str("session_id", sessionID).Msg("replay chunk: save failed")
		return err
	}
	return nil
}

func (s *ReplayService) DeleteSessions(ctx context.Context, websiteID string, sessionIDs []string) error {
	siteID, uuidStr, err := s.resolveIDs(ctx, websiteID)
	if err != nil {
		s.logger.Warn().Err(err).Str("input_id", websiteID).Msg("delete sessions: id resolution failed")
		siteID, uuidStr = websiteID, websiteID
	}
	
	for _, id := range sessionIDs {
		// Delete using both potential IDs for safety
		if err := s.repo.DeleteSession(ctx, siteID, id); err != nil {
			s.logger.Error().Err(err).Str("website_id", siteID).Str("session_id", id).Msg("replay: delete by site_id failed")
		}
		if uuidStr != siteID {
			if err := s.repo.DeleteSession(ctx, uuidStr, id); err != nil {
				s.logger.Debug().Err(err).Str("website_id", uuidStr).Str("session_id", id).Msg("replay: delete by uuid skipped (already deleted by site_id)")
			}
		}
	}
	return nil
}

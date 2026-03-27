// Package apikeys manages API key lifecycle and cached validation.
package apikeys

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/Seentics/seentics/internal/shared/cache"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

const (
	cachePrefix = "apikey:"
	cacheTTL    = 5 * time.Minute
)

// KeyRecord is the minimal validated data stored in the cache.
type KeyRecord struct {
	WebsiteID string     `json:"website_id"`
	IsActive  bool       `json:"is_active"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// Service handles API key creation, listing, revocation, and cached validation.
type Service struct {
	db     *pgxpool.Pool
	cache  *cache.Cache
	logger zerolog.Logger
}

func NewService(db *pgxpool.Pool, c *cache.Cache, logger zerolog.Logger) *Service {
	return &Service{db: db, cache: c, logger: logger}
}

// Validate authenticates a raw key. The result is cached in Redis for 5 minutes
// so repeated calls within that window never touch the database.
// On revocation, the cache entry is evicted immediately.
func (s *Service) Validate(ctx context.Context, rawKey string) (*KeyRecord, error) {
	hash := HashKey(rawKey)

	var rec KeyRecord
	if s.cache.Get(cachePrefix+hash, &rec) {
		return &rec, nil
	}

	err := s.db.QueryRow(ctx,
		`SELECT is_active, website_id, expires_at FROM api_keys WHERE key_hash = $1`,
		hash,
	).Scan(&rec.IsActive, &rec.WebsiteID, &rec.ExpiresAt)
	if err != nil {
		return nil, errors.New("invalid API key")
	}

	_ = s.cache.Set(cachePrefix+hash, rec, cacheTTL)

	go func() {
		_, _ = s.db.Exec(context.Background(),
			`UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1`, hash)
	}()

	return &rec, nil
}

// Create generates a new key, persists it, and returns the raw key (shown once).
func (s *Service) Create(ctx context.Context, websiteID, userID, name string, scopes []string, expiresAt *time.Time) (map[string]interface{}, error) {
	if len(scopes) == 0 {
		scopes = []string{"read"}
	}

	rawKey, err := generateKey()
	if err != nil {
		return nil, fmt.Errorf("generate: %w", err)
	}
	hash   := HashKey(rawKey)
	prefix := rawKey[:16]

	var id string
	err = s.db.QueryRow(ctx,
		`INSERT INTO api_keys (website_id, user_id, name, key_hash, key_prefix, scopes, expires_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		websiteID, userID, name, hash, prefix, scopes, expiresAt,
	).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("insert: %w", err)
	}

	return map[string]interface{}{
		"id": id, "key": rawKey, "key_prefix": prefix,
		"name": name, "scopes": scopes,
		"expires_at": expiresAt, "created_at": time.Now(),
	}, nil
}

// List returns non-sensitive metadata for all keys belonging to a website.
func (s *Service) List(ctx context.Context, websiteID string) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at
		 FROM api_keys WHERE website_id = $1 ORDER BY created_at DESC`, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []map[string]interface{}
	for rows.Next() {
		var (
			id, name, prefix string
			scopes           []string
			isActive         bool
			lastUsed, exp    *time.Time
			createdAt        time.Time
		)
		if err := rows.Scan(&id, &name, &prefix, &scopes, &isActive, &lastUsed, &exp, &createdAt); err != nil {
			continue
		}
		out = append(out, map[string]interface{}{
			"id": id, "name": name, "key_prefix": prefix, "scopes": scopes,
			"is_active": isActive, "last_used_at": lastUsed, "expires_at": exp, "created_at": createdAt,
		})
	}
	return out, rows.Err()
}

// Revoke soft-deletes a key and immediately evicts it from the cache.
func (s *Service) Revoke(ctx context.Context, keyID, websiteID string) error {
	var hash string
	err := s.db.QueryRow(ctx,
		`UPDATE api_keys SET is_active = false WHERE id = $1 AND website_id = $2 RETURNING key_hash`,
		keyID, websiteID,
	).Scan(&hash)
	if err != nil {
		return fmt.Errorf("revoke: %w", err)
	}
	s.cache.Delete(cachePrefix + hash)
	return nil
}

// HashKey returns the SHA-256 hex digest of a raw API key.
func HashKey(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

func generateKey() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "snc_live_" + hex.EncodeToString(b), nil
}

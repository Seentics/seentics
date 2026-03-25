package errors

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

type Repository struct {
	conn   driver.Conn
	db     *pgxpool.Pool
	logger zerolog.Logger
}

func NewRepository(conn driver.Conn, db *pgxpool.Pool, logger zerolog.Logger) *Repository {
	return &Repository{conn: conn, db: db, logger: logger}
}

func (r *Repository) CreateSchema(ctx context.Context) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS obs_error_events (
			timestamp   DateTime64(3, 'UTC') CODEC(Delta, ZSTD(1)),
			project_id  String,
			service     LowCardinality(String),
			error_type  LowCardinality(String),
			message     String,
			stack_trace String DEFAULT '',
			fingerprint String,
			environment LowCardinality(String) DEFAULT '',
			release     String DEFAULT '',
			user_id     String DEFAULT '',
			attributes  String DEFAULT '{}'
		) ENGINE = MergeTree()
		PARTITION BY toYYYYMM(timestamp)
		ORDER BY (project_id, fingerprint, timestamp)
		TTL toDate(timestamp) + INTERVAL 90 DAY`,
	}
	for _, q := range queries {
		if err := r.conn.Exec(ctx, q); err != nil {
			if strings.Contains(err.Error(), "already exists") {
				continue
			}
			return fmt.Errorf("obs_error_events schema: %w", err)
		}
	}
	return nil
}

// BatchInsertEvents inserts raw error events into ClickHouse and upserts the
// corresponding error groups in Postgres (one upsert per unique fingerprint).
func (r *Repository) BatchInsertEvents(ctx context.Context, events []ErrorEvent) error {
	if len(events) == 0 {
		return nil
	}

	batch, err := r.conn.PrepareBatch(ctx, "INSERT INTO obs_error_events")
	if err != nil {
		return fmt.Errorf("prepare batch: %w", err)
	}
	for _, e := range events {
		attrs := "{}"
		if len(e.Attributes) > 0 {
			if b, err := json.Marshal(e.Attributes); err == nil {
				attrs = string(b)
			}
		}
		if err := batch.Append(
			e.Timestamp,
			e.ProjectID,
			e.Service,
			e.ErrorType,
			e.Message,
			e.StackTrace,
			e.Fingerprint,
			e.Environment,
			e.Release,
			e.UserID,
			attrs,
		); err != nil {
			return fmt.Errorf("append: %w", err)
		}
	}
	if err := batch.Send(); err != nil {
		return fmt.Errorf("send batch: %w", err)
	}

	// Aggregate per fingerprint to minimise Postgres round-trips.
	type groupState struct {
		event    *ErrorEvent
		count    int64
		lastTime interface{}
	}
	groups := make(map[string]*groupState, len(events))
	for i := range events {
		e := &events[i]
		fp := e.Fingerprint
		if gs, ok := groups[fp]; !ok {
			groups[fp] = &groupState{event: e, count: 1, lastTime: e.Timestamp}
		} else {
			gs.count++
			if e.Timestamp.After(gs.event.Timestamp) {
				gs.lastTime = e.Timestamp
			}
		}
	}

	for fp, gs := range groups {
		e := gs.event
		if _, err := r.db.Exec(ctx, `
			INSERT INTO obs_error_groups
				(fingerprint, project_id, service, error_type, message, status, first_seen, last_seen, count)
			VALUES ($1, $2, $3, $4, $5, 'open', $6, $6, $7)
			ON CONFLICT (fingerprint, project_id) DO UPDATE SET
				last_seen = GREATEST(obs_error_groups.last_seen, EXCLUDED.last_seen),
				count     = obs_error_groups.count + EXCLUDED.count`,
			fp, e.ProjectID, e.Service, e.ErrorType, e.Message, gs.lastTime, gs.count,
		); err != nil {
			r.logger.Warn().Err(err).Str("fingerprint", fp).Msg("Failed to upsert error group")
		}
	}
	return nil
}

func (r *Repository) ListGroups(ctx context.Context, projectID, service, status string, limit, offset int) ([]ErrorGroup, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}

	conds := []string{"project_id = $1"}
	args := []any{projectID}
	n := 2

	if service != "" {
		conds = append(conds, fmt.Sprintf("service = $%d", n))
		args = append(args, service)
		n++
	}
	if status != "" {
		conds = append(conds, fmt.Sprintf("status = $%d", n))
		args = append(args, status)
		n++
	}

	query := fmt.Sprintf(`
		SELECT fingerprint, project_id, service, error_type, message,
		       status, first_seen, last_seen, count
		FROM obs_error_groups
		WHERE %s
		ORDER BY last_seen DESC
		LIMIT $%d OFFSET $%d`,
		strings.Join(conds, " AND "), n, n+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []ErrorGroup
	for rows.Next() {
		var g ErrorGroup
		if err := rows.Scan(
			&g.Fingerprint, &g.ProjectID, &g.Service, &g.ErrorType, &g.Message,
			&g.Status, &g.FirstSeen, &g.LastSeen, &g.Count,
		); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	return groups, rows.Err()
}

func (r *Repository) UpdateGroupStatus(ctx context.Context, fingerprint, projectID, status string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE obs_error_groups SET status = $1 WHERE fingerprint = $2 AND project_id = $3`,
		status, fingerprint, projectID,
	)
	return err
}

func (r *Repository) ListEvents(ctx context.Context, fingerprint, projectID string, limit int) ([]ErrorEvent, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	rows, err := r.conn.Query(ctx, `
		SELECT timestamp, project_id, service, error_type, message, stack_trace,
		       fingerprint, environment, release, user_id, attributes
		FROM obs_error_events
		WHERE project_id = ? AND fingerprint = ?
		ORDER BY timestamp DESC
		LIMIT ?`,
		projectID, fingerprint, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []ErrorEvent
	for rows.Next() {
		var e ErrorEvent
		var attrsJSON string
		if err := rows.Scan(
			&e.Timestamp, &e.ProjectID, &e.Service, &e.ErrorType, &e.Message, &e.StackTrace,
			&e.Fingerprint, &e.Environment, &e.Release, &e.UserID, &attrsJSON,
		); err != nil {
			return nil, err
		}
		if attrsJSON != "" && attrsJSON != "{}" {
			_ = json.Unmarshal([]byte(attrsJSON), &e.Attributes)
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

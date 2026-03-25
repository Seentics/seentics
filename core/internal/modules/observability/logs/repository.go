package logs

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/rs/zerolog"
)

type Repository struct {
	conn   driver.Conn
	logger zerolog.Logger
}

func NewRepository(conn driver.Conn, logger zerolog.Logger) *Repository {
	return &Repository{conn: conn, logger: logger}
}

func (r *Repository) CreateSchema(ctx context.Context) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS obs_logs (
			timestamp   DateTime64(3, 'UTC') CODEC(Delta, ZSTD(1)),
			project_id  String,
			service     LowCardinality(String),
			level       LowCardinality(String),
			message     String,
			trace_id    String DEFAULT '',
			span_id     String DEFAULT '',
			host        LowCardinality(String) DEFAULT '',
			environment LowCardinality(String) DEFAULT '',
			attributes  String DEFAULT '{}'
		) ENGINE = MergeTree()
		PARTITION BY toYYYYMM(timestamp)
		ORDER BY (project_id, service, level, timestamp)
		TTL toDate(timestamp) + INTERVAL 90 DAY`,
	}
	for _, q := range queries {
		if err := r.conn.Exec(ctx, q); err != nil {
			if strings.Contains(err.Error(), "already exists") {
				continue
			}
			return fmt.Errorf("obs_logs schema: %w", err)
		}
	}
	return nil
}

func (r *Repository) BatchInsert(ctx context.Context, entries []LogEntry) error {
	if len(entries) == 0 {
		return nil
	}
	batch, err := r.conn.PrepareBatch(ctx, "INSERT INTO obs_logs")
	if err != nil {
		return fmt.Errorf("prepare batch: %w", err)
	}
	for _, e := range entries {
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
			e.Level,
			e.Message,
			e.TraceID,
			e.SpanID,
			e.Host,
			e.Environment,
			attrs,
		); err != nil {
			return fmt.Errorf("append: %w", err)
		}
	}
	return batch.Send()
}

func (r *Repository) Query(ctx context.Context, p QueryParams) ([]LogEntry, error) {
	conds := []string{"project_id = ?"}
	args := []any{p.ProjectID}

	if p.Service != "" {
		conds = append(conds, "service = ?")
		args = append(args, p.Service)
	}
	if p.Level != "" {
		conds = append(conds, "level = ?")
		args = append(args, p.Level)
	}
	if !p.From.IsZero() {
		conds = append(conds, "timestamp >= ?")
		args = append(args, p.From)
	}
	if !p.To.IsZero() {
		conds = append(conds, "timestamp <= ?")
		args = append(args, p.To)
	}
	if p.Search != "" {
		conds = append(conds, "positionCaseInsensitive(message, ?) > 0")
		args = append(args, p.Search)
	}

	limit := p.Limit
	if limit <= 0 || limit > 1000 {
		limit = 100
	}
	if p.Offset < 0 {
		p.Offset = 0
	}

	query := fmt.Sprintf(`
		SELECT timestamp, project_id, service, level, message,
		       trace_id, span_id, host, environment, attributes
		FROM obs_logs
		WHERE %s
		ORDER BY timestamp DESC
		LIMIT %d OFFSET %d`,
		strings.Join(conds, " AND "), limit, p.Offset)

	rows, err := r.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []LogEntry
	for rows.Next() {
		var e LogEntry
		var attrsJSON string
		if err := rows.Scan(
			&e.Timestamp, &e.ProjectID, &e.Service, &e.Level, &e.Message,
			&e.TraceID, &e.SpanID, &e.Host, &e.Environment, &attrsJSON,
		); err != nil {
			return nil, err
		}
		if attrsJSON != "" && attrsJSON != "{}" {
			_ = json.Unmarshal([]byte(attrsJSON), &e.Attributes)
		}
		results = append(results, e)
	}
	return results, rows.Err()
}

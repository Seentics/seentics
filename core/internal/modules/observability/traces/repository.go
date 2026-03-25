package traces

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/rs/zerolog"
)

// TraceListItem is a lightweight summary returned by ListTraces.
type TraceListItem struct {
	TraceID       string    `json:"trace_id"`
	RootService   string    `json:"root_service"`
	RootOperation string    `json:"root_operation"`
	StartTime     time.Time `json:"start_time"`
	DurationMS    int64     `json:"duration_ms"`
	Status        string    `json:"status"`
	SpanCount     uint64    `json:"span_count"`
}

type Repository struct {
	conn   driver.Conn
	logger zerolog.Logger
}

func NewRepository(conn driver.Conn, logger zerolog.Logger) *Repository {
	return &Repository{conn: conn, logger: logger}
}

func (r *Repository) CreateSchema(ctx context.Context) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS obs_spans (
			timestamp      DateTime64(3, 'UTC') CODEC(Delta, ZSTD(1)),
			project_id     String,
			trace_id       String,
			span_id        String,
			parent_span_id String DEFAULT '',
			service        LowCardinality(String),
			operation      String,
			start_time     DateTime64(3, 'UTC') CODEC(Delta, ZSTD(1)),
			end_time       DateTime64(3, 'UTC') CODEC(Delta, ZSTD(1)),
			duration_ms    Int64,
			status         LowCardinality(String),
			error_message  String DEFAULT '',
			attributes     String DEFAULT '{}'
		) ENGINE = MergeTree()
		PARTITION BY toYYYYMM(timestamp)
		ORDER BY (project_id, trace_id, span_id)
		TTL toDate(timestamp) + INTERVAL 90 DAY`,
	}
	for _, q := range queries {
		if err := r.conn.Exec(ctx, q); err != nil {
			if strings.Contains(err.Error(), "already exists") {
				continue
			}
			return fmt.Errorf("obs_spans schema: %w", err)
		}
	}
	return nil
}

func (r *Repository) BatchInsert(ctx context.Context, spans []Span) error {
	if len(spans) == 0 {
		return nil
	}
	batch, err := r.conn.PrepareBatch(ctx, "INSERT INTO obs_spans")
	if err != nil {
		return fmt.Errorf("prepare batch: %w", err)
	}
	for _, s := range spans {
		attrs := "{}"
		if len(s.Attributes) > 0 {
			if b, err := json.Marshal(s.Attributes); err == nil {
				attrs = string(b)
			}
		}
		if err := batch.Append(
			s.Timestamp,
			s.ProjectID,
			s.TraceID,
			s.SpanID,
			s.ParentSpanID,
			s.Service,
			s.Operation,
			s.StartTime,
			s.EndTime,
			s.DurationMS,
			s.Status,
			s.ErrorMessage,
			attrs,
		); err != nil {
			return fmt.Errorf("append: %w", err)
		}
	}
	return batch.Send()
}

// ListTraces returns one summary row per trace_id, newest first.
func (r *Repository) ListTraces(ctx context.Context, projectID, service string, from, to *time.Time, limit, offset int) ([]TraceListItem, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}

	conds := []string{"project_id = ?"}
	args := []any{projectID}

	if service != "" {
		conds = append(conds, "service = ?")
		args = append(args, service)
	}
	if from != nil {
		conds = append(conds, "timestamp >= ?")
		args = append(args, *from)
	}
	if to != nil {
		conds = append(conds, "timestamp <= ?")
		args = append(args, *to)
	}

	query := fmt.Sprintf(`
		SELECT
			trace_id,
			argMinIf(service,   start_time, parent_span_id = '')         AS root_service,
			argMinIf(operation, start_time, parent_span_id = '')         AS root_operation,
			min(start_time)                                              AS start_time,
			dateDiff('millisecond', min(start_time), max(end_time))      AS duration_ms,
			if(countIf(status = 'error') > 0, 'error', 'ok')            AS status,
			count()                                                      AS span_count
		FROM obs_spans
		WHERE %s
		GROUP BY trace_id
		ORDER BY min(start_time) DESC
		LIMIT %d OFFSET %d`,
		strings.Join(conds, " AND "), limit, offset)

	rows, err := r.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []TraceListItem
	for rows.Next() {
		var t TraceListItem
		if err := rows.Scan(
			&t.TraceID, &t.RootService, &t.RootOperation,
			&t.StartTime, &t.DurationMS, &t.Status, &t.SpanCount,
		); err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, rows.Err()
}

// GetTrace returns all spans for a trace, ordered start_time ASC (for waterfall).
func (r *Repository) GetTrace(ctx context.Context, projectID, traceID string) ([]Span, error) {
	rows, err := r.conn.Query(ctx, `
		SELECT timestamp, project_id, trace_id, span_id, parent_span_id,
		       service, operation, start_time, end_time, duration_ms,
		       status, error_message, attributes
		FROM obs_spans
		WHERE project_id = ? AND trace_id = ?
		ORDER BY start_time ASC`,
		projectID, traceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var spans []Span
	for rows.Next() {
		var s Span
		var attrsJSON string
		if err := rows.Scan(
			&s.Timestamp, &s.ProjectID, &s.TraceID, &s.SpanID, &s.ParentSpanID,
			&s.Service, &s.Operation, &s.StartTime, &s.EndTime, &s.DurationMS,
			&s.Status, &s.ErrorMessage, &attrsJSON,
		); err != nil {
			return nil, err
		}
		if attrsJSON != "" && attrsJSON != "{}" {
			_ = json.Unmarshal([]byte(attrsJSON), &s.Attributes)
		}
		spans = append(spans, s)
	}
	return spans, rows.Err()
}

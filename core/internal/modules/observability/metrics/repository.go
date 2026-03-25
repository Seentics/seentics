package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/rs/zerolog"
)

// MetricBucket is one aggregated data point returned by Query.
type MetricBucket struct {
	Bucket string  `json:"bucket"`
	Name   string  `json:"name"`
	Avg    float64 `json:"avg"`
	Min    float64 `json:"min"`
	Max    float64 `json:"max"`
	Count  uint64  `json:"count"`
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
		`CREATE TABLE IF NOT EXISTS obs_metrics (
			timestamp  DateTime64(3, 'UTC') CODEC(Delta, ZSTD(1)),
			project_id String,
			service    LowCardinality(String),
			name       LowCardinality(String),
			type       LowCardinality(String),
			value      Float64,
			host       LowCardinality(String) DEFAULT '',
			labels     String DEFAULT '{}'
		) ENGINE = MergeTree()
		PARTITION BY toYYYYMM(timestamp)
		ORDER BY (project_id, service, name, timestamp)
		TTL toDate(timestamp) + INTERVAL 90 DAY`,
	}
	for _, q := range queries {
		if err := r.conn.Exec(ctx, q); err != nil {
			if strings.Contains(err.Error(), "already exists") {
				continue
			}
			return fmt.Errorf("obs_metrics schema: %w", err)
		}
	}
	return nil
}

func (r *Repository) BatchInsert(ctx context.Context, points []MetricPoint) error {
	if len(points) == 0 {
		return nil
	}
	batch, err := r.conn.PrepareBatch(ctx, "INSERT INTO obs_metrics")
	if err != nil {
		return fmt.Errorf("prepare batch: %w", err)
	}
	for _, p := range points {
		labels := "{}"
		if len(p.Labels) > 0 {
			if b, err := json.Marshal(p.Labels); err == nil {
				labels = string(b)
			}
		}
		if err := batch.Append(
			p.Timestamp,
			p.ProjectID,
			p.Service,
			p.Name,
			p.Type,
			p.Value,
			p.Host,
			labels,
		); err != nil {
			return fmt.Errorf("append: %w", err)
		}
	}
	return batch.Send()
}

func intervalExpr(granularity string) string {
	switch granularity {
	case "hour":
		return "toStartOfHour(timestamp)"
	case "day":
		return "toStartOfDay(timestamp)"
	default:
		return "toStartOfMinute(timestamp)"
	}
}

func (r *Repository) Query(ctx context.Context, p QueryParams) ([]MetricBucket, error) {
	if p.ProjectID == "" {
		return nil, fmt.Errorf("project_id is required")
	}

	conds := []string{"project_id = ?"}
	args := []any{p.ProjectID}

	if p.Service != "" {
		conds = append(conds, "service = ?")
		args = append(args, p.Service)
	}
	if p.MetricName != "" {
		conds = append(conds, "name = ?")
		args = append(args, p.MetricName)
	}
	if !p.From.IsZero() {
		conds = append(conds, "timestamp >= ?")
		args = append(args, p.From)
	}
	if !p.To.IsZero() {
		conds = append(conds, "timestamp <= ?")
		args = append(args, p.To)
	}

	query := fmt.Sprintf(`
		SELECT
			toString(%s) AS bucket,
			name,
			avg(value)   AS avg,
			min(value)   AS min,
			max(value)   AS max,
			count()      AS cnt
		FROM obs_metrics
		WHERE %s
		GROUP BY bucket, name
		ORDER BY bucket ASC`,
		intervalExpr(p.Granularity), strings.Join(conds, " AND "))

	rows, err := r.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var buckets []MetricBucket
	for rows.Next() {
		var b MetricBucket
		if err := rows.Scan(&b.Bucket, &b.Name, &b.Avg, &b.Min, &b.Max, &b.Count); err != nil {
			return nil, err
		}
		buckets = append(buckets, b)
	}
	return buckets, rows.Err()
}

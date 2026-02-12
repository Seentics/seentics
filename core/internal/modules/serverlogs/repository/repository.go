package repository

import (
	"analytics-app/internal/modules/serverlogs/models"
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type LogsRepository struct {
	db *pgxpool.Pool
}

func NewLogsRepository(db *pgxpool.Pool) *LogsRepository {
	return &LogsRepository{db: db}
}

// Logs
func (r *LogsRepository) IngestLog(ctx context.Context, log *models.LogEntry) error {
	query := `INSERT INTO server_logs (id, level, message, source, metadata, timestamp)
			  VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.Exec(ctx, query, log.ID, log.Level, log.Message, log.Source, log.Metadata, log.Timestamp)
	return err
}

func (r *LogsRepository) QueryLogs(ctx context.Context, q models.LogQuery) ([]models.LogEntry, error) {
	query := `SELECT id, timestamp, level, message, source, metadata
			  FROM server_logs
			  WHERE timestamp >= $1 AND timestamp <= $2`

	args := []interface{}{q.StartTime, q.EndTime}
	argCount := 2

	if q.Level != "" {
		argCount++
		query += fmt.Sprintf(" AND level = $%d", argCount)
		args = append(args, q.Level)
	}

	if q.Source != "" {
		argCount++
		query += fmt.Sprintf(" AND source = $%d", argCount)
		args = append(args, q.Source)
	}

	query += " ORDER BY timestamp DESC"

	if q.Limit > 0 {
		argCount++
		query += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, q.Limit)
	} else {
		query += " LIMIT 100"
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.LogEntry
	for rows.Next() {
		var l models.LogEntry
		if err := rows.Scan(&l.ID, &l.Timestamp, &l.Level, &l.Message, &l.Source, &l.Metadata); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

// Metrics
func (r *LogsRepository) IngestMetric(ctx context.Context, m *models.MetricEntry) error {
	query := `INSERT INTO server_metrics (id, name, value, labels, timestamp)
			  VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.Exec(ctx, query, m.ID, m.Name, m.Value, m.Labels, m.Timestamp)
	return err
}

func (r *LogsRepository) QueryMetrics(ctx context.Context, q models.MetricQuery) ([]models.MetricEntry, error) {
	query := `SELECT id, timestamp, name, value, labels
			  FROM server_metrics
			  WHERE name = $1 AND timestamp >= $2 AND timestamp <= $3
			  ORDER BY timestamp ASC`

	rows, err := r.db.Query(ctx, query, q.Name, q.StartTime, q.EndTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var metrics []models.MetricEntry
	for rows.Next() {
		var m models.MetricEntry
		if err := rows.Scan(&m.ID, &m.Timestamp, &m.Name, &m.Value, &m.Labels); err != nil {
			return nil, err
		}
		metrics = append(metrics, m)
	}
	return metrics, nil
}

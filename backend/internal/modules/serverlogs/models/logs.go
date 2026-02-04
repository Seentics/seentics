package models

import (
	"encoding/json"
	"time"
)

type LogEntry struct {
	ID        string          `json:"id"`
	Timestamp time.Time       `json:"timestamp"`
	Level     string          `json:"level"` // INFO, WARN, ERROR, DEBUG
	Message   string          `json:"message"`
	Source    string          `json:"source"` // backend, frontend, worker, etc.
	Metadata  json.RawMessage `json:"metadata"`
}

type MetricEntry struct {
	ID        string          `json:"id"`
	Timestamp time.Time       `json:"timestamp"`
	Name      string          `json:"name"` // cpu_usage, memory_usage, etc.
	Value     float64         `json:"value"`
	Labels    json.RawMessage `json:"labels"` // e.g {"service": "api"}
}

type LogQuery struct {
	Level     string    `json:"level"`
	Source    string    `json:"source"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	Limit     int       `json:"limit"`
}

type MetricQuery struct {
	Name      string    `json:"name"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
}

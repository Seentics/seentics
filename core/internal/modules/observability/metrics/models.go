package metrics

import "time"

// MetricPoint is a single metric data point.
type MetricPoint struct {
	Timestamp  time.Time         `json:"timestamp"`
	ProjectID  string            `json:"project_id"`
	Service    string            `json:"service"`
	Name       string            `json:"name"`
	Type       string            `json:"type"` // gauge | counter | histogram
	Value      float64           `json:"value"`
	Labels     map[string]string `json:"labels,omitempty"`
	Host       string            `json:"host,omitempty"`
}

// IngestRequest is the payload for POST /observability/metrics/ingest.
type IngestRequest struct {
	Metrics []MetricPoint `json:"metrics"`
}

// QueryParams holds filters for GET /observability/metrics.
type QueryParams struct {
	ProjectID  string
	Service    string
	MetricName string
	From       time.Time
	To         time.Time
	Granularity string // minute | hour | day
}

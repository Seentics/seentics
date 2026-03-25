package seentics

import "time"

// MetricType mirrors the backend values.
type MetricType string

const (
	MetricGauge     MetricType = "gauge"
	MetricCounter   MetricType = "counter"
	MetricHistogram MetricType = "histogram"
)

// MetricPoint is the payload sent to POST /api/v1/observability/metrics/ingest.
type MetricPoint struct {
	Timestamp time.Time         `json:"timestamp"`
	ProjectID string            `json:"project_id"`
	Service   string            `json:"service"`
	Name      string            `json:"name"`
	Type      MetricType        `json:"type"`
	Value     float64           `json:"value"`
	Labels    map[string]string `json:"labels,omitempty"`
	Host      string            `json:"host,omitempty"`
}

// Gauge records a point-in-time measurement (e.g. memory usage, queue depth).
func (c *Client) Gauge(name string, value float64, labels ...map[string]string) {
	c.pushMetric(MetricGauge, name, value, labels)
}

// Counter records a cumulative increment (e.g. requests served, bytes written).
func (c *Client) Counter(name string, value float64, labels ...map[string]string) {
	c.pushMetric(MetricCounter, name, value, labels)
}

// Histogram records a distribution sample (e.g. request latency, payload size).
func (c *Client) Histogram(name string, value float64, labels ...map[string]string) {
	c.pushMetric(MetricHistogram, name, value, labels)
}

func (c *Client) pushMetric(t MetricType, name string, value float64, labels []map[string]string) {
	p := MetricPoint{
		Timestamp: time.Now().UTC(),
		ProjectID: c.cfg.ProjectID,
		Service:   c.cfg.Service,
		Name:      name,
		Type:      t,
		Value:     value,
	}
	if len(labels) > 0 {
		p.Labels = labels[0]
	}
	if c.metricBuf.add(p) {
		c.triggerFlush()
	}
}

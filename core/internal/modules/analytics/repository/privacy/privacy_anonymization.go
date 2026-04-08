package privacy

// AnonymizeEventsData is a no-op: events live in ClickHouse which handles
// data via its built-in 2-year TTL. ClickHouse does not support arbitrary
// UPDATE statements, so per-user anonymization at the row level is not feasible
// without a full table rewrite. For GDPR anonymization use DeleteEventsDataForWebsite.
func (r *PrivacyRepository) AnonymizeEventsData(userID string) error {
	r.LogPrivacyOperation("anonymize_events", userID, "skipped: events are in ClickHouse (TTL-managed)")
	return nil
}

// AnonymizeAnalyticsData is a no-op: aggregated analytics are derived from
// ClickHouse via materialized views in ClickHouse, not PostgreSQL.
func (r *PrivacyRepository) AnonymizeAnalyticsData(userID string) error {
	r.LogPrivacyOperation("anonymize_analytics", userID, "skipped: analytics are ClickHouse-backed")
	return nil
}

// AnonymizeOldIPs is a no-op: IP addresses are stored in ClickHouse events,
// not in PostgreSQL. ClickHouse TTL (2-year) already handles data lifecycle.
func (r *PrivacyRepository) AnonymizeOldIPs() error {
	r.LogPrivacyOperation("anonymize_old_ips", "system", "skipped: IPs are stored in ClickHouse (TTL-managed)")
	return nil
}

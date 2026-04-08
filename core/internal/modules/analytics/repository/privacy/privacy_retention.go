package privacy

import (
	"context"
	"fmt"
	"time"
)

// CleanupOldEvents is a no-op: events live in ClickHouse which has a built-in
// TTL of 2 years (TTL toDate(timestamp) + INTERVAL 2 YEAR). No manual cleanup needed.
func (r *PrivacyRepository) CleanupOldEvents() error {
	r.LogPrivacyOperation("cleanup_old_events", "system", "skipped: ClickHouse TTL handles event lifecycle")
	return nil
}

// CleanupOldAnalytics removes stale PostgreSQL analytics metadata older than 1 year.
// Currently cleans up inactive funnels. ClickHouse analytics data is handled by TTL.
func (r *PrivacyRepository) CleanupOldAnalytics() error {
	cutoffDate := time.Now().AddDate(-1, 0, 0)

	result, err := r.db.Exec(context.Background(), `
		DELETE FROM funnels WHERE created_at < $1 AND is_active = false
	`, cutoffDate)
	if err != nil {
		return fmt.Errorf("failed to cleanup old funnels: %w", err)
	}

	r.LogPrivacyOperation("cleanup_old_analytics", "system", fmt.Sprintf(
		"Cleaned up %d inactive funnels older than %s", result.RowsAffected(), cutoffDate.Format(time.RFC3339),
	))

	return nil
}

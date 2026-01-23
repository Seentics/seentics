package privacy

import (
	"context"
	"fmt"
	"time"
)

// CleanupOldEvents cleans up events older than 2 years
func (r *PrivacyRepository) CleanupOldEvents() error {
	cutoffDate := time.Now().AddDate(-2, 0, 0)

	// Delete events older than 2 years
	deleteQuery := `DELETE FROM events WHERE timestamp < $1`

	result, err := r.db.Exec(context.Background(), deleteQuery, cutoffDate)
	if err != nil {
		return fmt.Errorf("failed to cleanup old events: %w", err)
	}

	rowsAffected := result.RowsAffected()

	// Log the cleanup operation
	r.LogPrivacyOperation("cleanup_old_events", "system", fmt.Sprintf("Cleaned up %d events older than %s", rowsAffected, cutoffDate.Format(time.RFC3339)))

	return nil
}

// CleanupOldAnalytics cleans up analytics data older than 1 year
func (r *PrivacyRepository) CleanupOldAnalytics() error {
	cutoffDate := time.Now().AddDate(-1, 0, 0)

	// Note: Analytics data is primarily stored in materialized views which are automatically
	// updated based on the events table. Since we're already cleaning up old events,
	// the materialized views will automatically reflect the cleaned data.

	// However, we can clean up old funnel data that's no longer needed
	deleteOldFunnelsQuery := `
		DELETE FROM funnels 
		WHERE created_at < $1 AND is_active = false
	`

	result, err := r.db.Exec(context.Background(), deleteOldFunnelsQuery, cutoffDate)
	if err != nil {
		return fmt.Errorf("failed to cleanup old funnels: %w", err)
	}

	rowsAffected := result.RowsAffected()

	// Log the cleanup operation
	r.LogPrivacyOperation("cleanup_old_analytics", "system", fmt.Sprintf("Cleaned up %d inactive funnels older than %s", rowsAffected, cutoffDate.Format(time.RFC3339)))

	return nil
}

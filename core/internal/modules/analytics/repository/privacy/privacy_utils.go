package privacy

import (
	"context"
	"fmt"
	"time"
)

// GetUserWebsites returns all site_ids owned by the given user.
// Queries the local websites table in PostgreSQL — no external HTTP calls needed.
func (r *PrivacyRepository) GetUserWebsites(userID string) ([]string, error) {
	query := `SELECT site_id FROM websites WHERE user_id = $1`

	rows, err := r.db.Query(context.Background(), query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query user websites: %w", err)
	}
	defer rows.Close()

	var siteIDs []string
	for rows.Next() {
		var siteID string
		if err := rows.Scan(&siteID); err != nil {
			continue
		}
		siteIDs = append(siteIDs, siteID)
	}

	return siteIDs, nil
}

// LogPrivacyOperation logs privacy operations for audit purposes
func (r *PrivacyRepository) LogPrivacyOperation(operation, userID, details string) error {
	insertQuery := `
		INSERT INTO privacy_audit_log (operation, user_id, details, timestamp, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	var ipAddress, userAgent *string

	_, err := r.db.Exec(context.Background(), insertQuery,
		operation, userID, details, time.Now().UTC(), ipAddress, userAgent)

	if err != nil {
		// If the audit log table doesn't exist, skip silently
		return nil
	}

	return nil
}

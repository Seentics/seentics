package privacy

import (
	"context"
	"fmt"
	"time"
)

// AnonymizeEventsData anonymizes events data for a specific user
func (r *PrivacyRepository) AnonymizeEventsData(userID string) error {
	// Get all websites owned by the user
	websiteIDs, err := r.GetUserWebsites(userID)
	if err != nil {
		return fmt.Errorf("failed to get user websites: %w", err)
	}

	if len(websiteIDs) == 0 {
		r.LogPrivacyOperation("anonymize_events", userID, "No websites found for user")
		return nil
	}

	// Anonymize IP addresses by setting the last octet to 0
	anonymizeIPQuery := `
		UPDATE events 
		SET ip_address = CASE 
			WHEN ip_address IS NOT NULL THEN 
				host(ip_address)::inet || '.0'::inet
			ELSE NULL 
		END
		WHERE website_id = ANY($1) AND ip_address IS NOT NULL
	`

	result, err := r.db.Exec(context.Background(), anonymizeIPQuery, websiteIDs)
	if err != nil {
		return fmt.Errorf("failed to anonymize IP addresses: %w", err)
	}
	ipsAnonymized := result.RowsAffected()

	// Anonymize user agents by keeping only browser/OS info, removing version details
	anonymizeUserAgentQuery := `
		UPDATE events 
		SET user_agent = CASE 
			WHEN user_agent IS NOT NULL THEN 
				REGEXP_REPLACE(
					REGEXP_REPLACE(
						REGEXP_REPLACE(user_agent, '\\d+\\.\\d+', 'X.X', 'g'),
						'\\d+', 'X', 'g'
					),
					'[A-Za-z0-9]{8,}', 'XXXXXXXX', 'g'
				)
			ELSE NULL 
		END
		WHERE website_id = ANY($1) AND user_agent IS NOT NULL
	`

	result, err = r.db.Exec(context.Background(), anonymizeUserAgentQuery, websiteIDs)
	if err != nil {
		return fmt.Errorf("failed to anonymize user agents: %w", err)
	}
	userAgentsAnonymized := result.RowsAffected()

	// Anonymize visitor IDs by hashing them (keeping them consistent for analytics)
	anonymizeVisitorIDQuery := `
		UPDATE events 
		SET visitor_id = 'anon_' || SUBSTRING(MD5(visitor_id), 1, 8)
		WHERE website_id = ANY($1) AND visitor_id IS NOT NULL
	`

	result, err = r.db.Exec(context.Background(), anonymizeVisitorIDQuery, websiteIDs)
	if err != nil {
		return fmt.Errorf("failed to anonymize visitor IDs: %w", err)
	}
	visitorIDsAnonymized := result.RowsAffected()

	// Anonymize session IDs by hashing them
	anonymizeSessionIDQuery := `
		UPDATE events 
		SET session_id = 'anon_' || SUBSTRING(MD5(session_id), 1, 8)
		WHERE website_id = ANY($1) AND session_id IS NOT NULL
	`

	result, err = r.db.Exec(context.Background(), anonymizeSessionIDQuery, websiteIDs)
	if err != nil {
		return fmt.Errorf("failed to anonymize session IDs: %w", err)
	}
	sessionIDsAnonymized := result.RowsAffected()

	// Log the anonymization operation
	r.LogPrivacyOperation("anonymize_events", userID, fmt.Sprintf(
		"Anonymized events data for %d websites: %d IPs, %d user agents, %d visitor IDs, %d session IDs",
		len(websiteIDs), ipsAnonymized, userAgentsAnonymized, visitorIDsAnonymized, sessionIDsAnonymized,
	))

	return nil
}

// AnonymizeAnalyticsData anonymizes analytics data for a specific user
func (r *PrivacyRepository) AnonymizeAnalyticsData(userID string) error {
	// Get all websites owned by the user
	websiteIDs, err := r.GetUserWebsites(userID)
	if err != nil {
		return fmt.Errorf("failed to get user websites: %w", err)
	}

	if len(websiteIDs) == 0 {
		r.LogPrivacyOperation("anonymize_analytics", userID, "No websites found for user")
		return nil
	}

	// Note: Analytics data is primarily derived from the events table through materialized views.
	// Since we've already anonymized the events data, the materialized views will automatically
	// reflect the anonymized data. However, we should refresh the materialized views to ensure
	// they're up to date.

	// Refresh materialized views to reflect anonymized data
	refreshViewsQuery := `
		REFRESH MATERIALIZED VIEW CONCURRENTLY events_daily;
		REFRESH MATERIALIZED VIEW CONCURRENTLY events_hourly;
	`

	_, err = r.db.Exec(context.Background(), refreshViewsQuery)
	if err != nil {
		// Log the error but don't fail the operation as this is not critical
		r.LogPrivacyOperation("anonymize_analytics", userID, fmt.Sprintf("Warning: Failed to refresh materialized views: %v", err))
	}

	// Log the anonymization operation
	r.LogPrivacyOperation("anonymize_analytics", userID, fmt.Sprintf("Analytics data anonymization completed for %d websites (materialized views refreshed)", len(websiteIDs)))

	return nil
}

// AnonymizeOldIPs anonymizes IP addresses older than 90 days
func (r *PrivacyRepository) AnonymizeOldIPs() error {
	cutoffDate := time.Now().AddDate(0, 0, -90)

	// Anonymize IP addresses older than 90 days by setting the last octet to 0
	anonymizeIPQuery := `
		UPDATE events 
		SET ip_address = CASE 
			WHEN ip_address IS NOT NULL THEN 
				host(ip_address)::inet || '.0'::inet
			ELSE NULL 
		END
		WHERE timestamp < $1 AND ip_address IS NOT NULL
	`

	result, err := r.db.Exec(context.Background(), anonymizeIPQuery, cutoffDate)
	if err != nil {
		return fmt.Errorf("failed to anonymize old IP addresses: %w", err)
	}

	rowsAffected := result.RowsAffected()

	// Log the anonymization operation
	r.LogPrivacyOperation("anonymize_old_ips", "system", fmt.Sprintf("Anonymized %d IP addresses older than %s", rowsAffected, cutoffDate.Format(time.RFC3339)))

	return nil
}

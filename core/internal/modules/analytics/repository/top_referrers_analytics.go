package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TopReferrersAnalytics struct {
	db *pgxpool.Pool
}

func NewTopReferrersAnalytics(db *pgxpool.Pool) *TopReferrersAnalytics {
	return &TopReferrersAnalytics{db: db}
}

// GetTopReferrers returns the top referrers for a website with analytics
func (tr *TopReferrersAnalytics) GetTopReferrers(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.ReferrerStat, error) {
	timezone = validateTimezone(timezone)

	query := fmt.Sprintf(`
		WITH normalized_referrers AS (
			SELECT
				CASE
					WHEN e.referrer LIKE '%%utm_source=%%' THEN
						CASE
							WHEN e.referrer LIKE '%%localhost%%' THEN 'Internal Navigation'
							WHEN e.referrer LIKE '%%google%%' THEN 'Google'
							WHEN e.referrer LIKE '%%facebook%%' THEN 'Facebook'
							WHEN e.referrer LIKE '%%twitter%%' THEN 'Twitter'
							WHEN e.referrer LIKE '%%linkedin%%' THEN 'LinkedIn'
							WHEN e.referrer LIKE '%%youtube%%' THEN 'YouTube'
							WHEN e.referrer LIKE '%%instagram%%' THEN 'Instagram'
							ELSE 'External Sites'
						END
					ELSE
						CASE
							WHEN e.referrer IS NULL OR e.referrer = '' THEN 'Direct Traffic'
							WHEN LOWER(e.referrer) LIKE '%%localhost%%' THEN 'Internal Navigation'
							WHEN LOWER(e.referrer) LIKE '%%google%%' THEN 'Google'
							WHEN LOWER(e.referrer) LIKE '%%facebook%%' THEN 'Facebook'
							WHEN LOWER(e.referrer) LIKE '%%twitter%%' THEN 'Twitter'
							WHEN LOWER(e.referrer) LIKE '%%linkedin%%' THEN 'LinkedIn'
							WHEN LOWER(e.referrer) LIKE '%%youtube%%' THEN 'YouTube'
							WHEN LOWER(e.referrer) LIKE '%%instagram%%' THEN 'Instagram'
							WHEN LOWER(e.referrer) LIKE '%%mail.google%%' OR LOWER(e.referrer) LIKE '%%accounts.google%%' THEN 'Google'
							WHEN LOWER(e.referrer) IN ('direct', 'none', 'null') THEN 'Direct Traffic'
							ELSE 'External Sites'
						END
				END as normalized_referrer,
				e.visitor_id,
				e.session_id,
				COUNT(*) OVER (PARTITION BY e.session_id) as total_session_pages
			FROM events e
			WHERE e.website_id = $1
			AND e.timestamp >= %s
			AND e.event_type = 'pageview'
		)
		SELECT
			nr.normalized_referrer as referrer,
			COUNT(*) as views,
			COUNT(DISTINCT nr.visitor_id) as unique_visitors,
			COALESCE(
				(COUNT(*) FILTER (WHERE total_session_pages = 1) * 100.0) /
				NULLIF(COUNT(DISTINCT nr.session_id), 0), 0
			) as bounce_rate
		FROM normalized_referrers nr
		WHERE nr.normalized_referrer IS NOT NULL AND nr.normalized_referrer != ''
		GROUP BY nr.normalized_referrer
		ORDER BY unique_visitors DESC, views DESC
		LIMIT $4`, tzStartSQL)

	rows, err := tr.db.Query(ctx, query, websiteID, days, timezone, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var referrers []models.ReferrerStat
	referrerMap := make(map[string]*models.ReferrerStat)

	for rows.Next() {
		var ref models.ReferrerStat
		var bounceRate *float64
		var uniqueVisitors int
		var rawReferrer *string

		err := rows.Scan(&rawReferrer, &ref.Views, &uniqueVisitors, &bounceRate)
		if err != nil {
			continue
		}

		if rawReferrer == nil || *rawReferrer == "" {
			ref.Referrer = "Direct Traffic"
		} else {
			ref.Referrer = *rawReferrer
		}

		ref.Unique = uniqueVisitors

		if bounceRate != nil && *bounceRate > 100.0 {
			*bounceRate = 100.0
		}

		ref.BounceRate = bounceRate

		if existing, exists := referrerMap[ref.Referrer]; exists {
			existing.Views += ref.Views
			existing.Unique += ref.Unique
			if existing.BounceRate != nil && bounceRate != nil {
				*existing.BounceRate = (*existing.BounceRate + *bounceRate) / 2
			}
		} else {
			newRef := ref
			referrerMap[ref.Referrer] = &newRef
		}
	}

	for _, ref := range referrerMap {
		referrers = append(referrers, *ref)
	}

	return referrers, nil
}

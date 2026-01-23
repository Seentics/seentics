package repository

import (
	"analytics-app/models"
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TopSourcesAnalytics struct {
	db *pgxpool.Pool
}

func NewTopSourcesAnalytics(db *pgxpool.Pool) *TopSourcesAnalytics {
	return &TopSourcesAnalytics{db: db}
}

// GetTopSources returns the top traffic sources for a website with analytics
func (ts *TopSourcesAnalytics) GetTopSources(ctx context.Context, websiteID string, days int, limit int) ([]models.SourceStat, error) {
	query := `
		WITH session_stats AS (
			SELECT 
				session_id,
				COUNT(*) as page_count
			FROM events
			WHERE website_id = $1 
			AND timestamp >= NOW() - INTERVAL '1 day' * $2
			AND event_type = 'pageview'
			GROUP BY session_id
		),
		source_categorized AS (
			SELECT 
				CASE 
					-- UTM Source takes priority for campaign tracking
					WHEN e.utm_source IS NOT NULL AND e.utm_source != '' THEN
						CASE 
							WHEN LOWER(e.utm_source) IN ('google', 'bing', 'yahoo', 'duckduckgo', 'search') THEN 'Search Engines'
							WHEN LOWER(e.utm_source) IN ('facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'snapchat') THEN 'Social Media'
							WHEN LOWER(e.utm_source) IN ('email', 'newsletter', 'mailchimp', 'sendgrid') THEN 'Email Marketing'
							WHEN LOWER(e.utm_source) IN ('google_ads', 'facebook_ads', 'linkedin_ads', 'twitter_ads') OR LOWER(e.utm_medium) IN ('cpc', 'ppc', 'paid', 'ads') THEN 'Paid Advertising'
							WHEN LOWER(e.utm_source) IN ('affiliate', 'partner', 'referral') THEN 'Affiliate/Referral'
							ELSE 'Campaign Traffic'
						END
					-- Analyze referrer for organic traffic
					ELSE 
						CASE 
							WHEN e.referrer IS NULL OR e.referrer = '' OR LOWER(e.referrer) IN ('direct', 'none', 'null') THEN 'Direct Traffic'
							WHEN LOWER(e.referrer) LIKE '%localhost%' OR LOWER(e.referrer) LIKE '%127.0.0.1%' THEN 'Internal Navigation'
							WHEN LOWER(e.referrer) LIKE '%google.%/search%' OR LOWER(e.referrer) LIKE '%bing.%/search%' OR LOWER(e.referrer) LIKE '%yahoo.%/search%' OR LOWER(e.referrer) LIKE '%duckduckgo.%' THEN 'Organic Search'
							WHEN LOWER(e.referrer) LIKE '%facebook.%' OR LOWER(e.referrer) LIKE '%twitter.%' OR LOWER(e.referrer) LIKE '%linkedin.%' OR LOWER(e.referrer) LIKE '%youtube.%' OR LOWER(e.referrer) LIKE '%instagram.%' OR LOWER(e.referrer) LIKE '%tiktok.%' THEN 'Social Media'
							WHEN LOWER(e.referrer) LIKE '%mail.%' OR LOWER(e.referrer) LIKE '%email%' OR LOWER(e.referrer) LIKE '%newsletter%' THEN 'Email Marketing'
							WHEN LOWER(e.referrer) LIKE '%.edu%' OR LOWER(e.referrer) LIKE '%.gov%' OR LOWER(e.referrer) LIKE '%.org%' THEN 'Institutional'
							ELSE 'Referral Traffic'
						END
				END as source_category,
				e.visitor_id,
				e.session_id,
				e.timestamp
			FROM events e
			WHERE e.website_id = $1 
			AND e.timestamp >= NOW() - INTERVAL '1 day' * $2
			AND e.event_type = 'pageview'
		)
		SELECT 
			sc.source_category as source,
			COUNT(*) as views,
			COUNT(DISTINCT sc.visitor_id) as unique_visitors,
			COALESCE(
				(COUNT(*) FILTER (WHERE s.page_count = 1) * 100.0) / 
				NULLIF(COUNT(DISTINCT sc.session_id), 0), 0
			) as bounce_rate
		FROM source_categorized sc
		LEFT JOIN session_stats s ON sc.session_id = s.session_id
		GROUP BY sc.source_category
		ORDER BY unique_visitors DESC, views DESC
		LIMIT $3
	`

	rows, err := ts.db.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sources []models.SourceStat
	for rows.Next() {
		var source models.SourceStat
		err := rows.Scan(
			&source.Source,
			&source.Views,
			&source.UniqueVisitors,
			&source.BounceRate,
		)
		if err != nil {
			return nil, err
		}

		// Clean up source names
		if source.Source == "" {
			source.Source = "Direct Traffic"
		}

		sources = append(sources, source)
	}

	return sources, rows.Err()
}

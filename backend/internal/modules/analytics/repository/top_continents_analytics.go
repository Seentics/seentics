package repository

import (
	"analytics-app/models"
	"context"
	"database/sql"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TopGeolocationAnalytics handles continent, region, and city analytics
type TopGeolocationAnalytics struct {
	db *pgxpool.Pool
}

// NewTopGeolocationAnalytics creates a new geolocation analytics repository
func NewTopGeolocationAnalytics(db *pgxpool.Pool) *TopGeolocationAnalytics {
	return &TopGeolocationAnalytics{db: db}
}

// GetTopContinents returns the top continents by visitor count for a website
func (r *TopGeolocationAnalytics) GetTopContinents(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error) {
	query := `
		SELECT 
			COALESCE(continent, 'Unknown') as name,
			COUNT(DISTINCT visitor_id) as count,
			ROUND(COUNT(DISTINCT visitor_id) * 100.0 / SUM(COUNT(DISTINCT visitor_id)) OVER(), 2) as percentage
		FROM events 
		WHERE website_id = $1 
			AND timestamp >= $2 
			AND timestamp <= $3
			AND event_type = 'pageview'
		GROUP BY continent
		ORDER BY count DESC
		LIMIT $4
	`

	rows, err := r.db.Query(ctx, query, websiteID, startDate, endDate, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.TopItem
	for rows.Next() {
		var item models.TopItem
		var percentage sql.NullFloat64
		
		err := rows.Scan(&item.Name, &item.Count, &percentage)
		if err != nil {
			return nil, err
		}
		
		if percentage.Valid {
			item.Percentage = percentage.Float64
		}
		
		results = append(results, item)
	}

	return results, rows.Err()
}

// GetTopRegions returns the top regions by visitor count for a website
func (r *TopGeolocationAnalytics) GetTopRegions(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error) {
	query := `
		SELECT 
			COALESCE(region, 'Unknown') as name,
			COUNT(DISTINCT visitor_id) as count,
			ROUND(COUNT(DISTINCT visitor_id) * 100.0 / SUM(COUNT(DISTINCT visitor_id)) OVER(), 2) as percentage
		FROM events 
		WHERE website_id = $1 
			AND timestamp >= $2 
			AND timestamp <= $3
			AND event_type = 'pageview'
		GROUP BY region
		ORDER BY count DESC
		LIMIT $4
	`

	rows, err := r.db.Query(ctx, query, websiteID, startDate, endDate, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.TopItem
	for rows.Next() {
		var item models.TopItem
		var percentage sql.NullFloat64
		
		err := rows.Scan(&item.Name, &item.Count, &percentage)
		if err != nil {
			return nil, err
		}
		
		if percentage.Valid {
			item.Percentage = percentage.Float64
		}
		
		results = append(results, item)
	}

	return results, rows.Err()
}

// GetTopCountries returns the top countries by visitor count for a website
func (r *TopGeolocationAnalytics) GetTopCountries(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error) {
	query := `
		SELECT 
			COALESCE(country, 'Unknown') as name,
			COUNT(DISTINCT visitor_id) as count,
			ROUND(COUNT(DISTINCT visitor_id) * 100.0 / SUM(COUNT(DISTINCT visitor_id)) OVER(), 2) as percentage
		FROM events 
		WHERE website_id = $1 
			AND timestamp >= $2 
			AND timestamp <= $3
			AND event_type = 'pageview'
		GROUP BY country
		ORDER BY count DESC
		LIMIT $4
	`

	rows, err := r.db.Query(ctx, query, websiteID, startDate, endDate, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.TopItem
	for rows.Next() {
		var item models.TopItem
		var percentage sql.NullFloat64
		
		err := rows.Scan(&item.Name, &item.Count, &percentage)
		if err != nil {
			return nil, err
		}
		
		if percentage.Valid {
			item.Percentage = percentage.Float64
		}
		
		results = append(results, item)
	}

	return results, rows.Err()
}

// GetGeolocationBreakdown returns comprehensive geolocation analytics
func (r *TopGeolocationAnalytics) GetGeolocationBreakdown(ctx context.Context, websiteID string, startDate, endDate time.Time) (*models.GeolocationBreakdown, error) {
	// Get top countries
	countries, err := r.GetTopCountries(ctx, websiteID, startDate, endDate, 10)
	if err != nil {
		return nil, err
	}

	// Get top continents
	continents, err := r.GetTopContinents(ctx, websiteID, startDate, endDate, 10)
	if err != nil {
		return nil, err
	}

	// Get top regions
	regions, err := r.GetTopRegions(ctx, websiteID, startDate, endDate, 10)
	if err != nil {
		return nil, err
	}

	// Get top cities
	cities, err := r.GetTopCities(ctx, websiteID, startDate, endDate, 10)
	if err != nil {
		return nil, err
	}

	return &models.GeolocationBreakdown{
		Countries:  countries,
		Continents: continents,
		Regions:    regions,
		Cities:     cities,
	}, nil
}

// GetTopCities returns the top cities by visitor count for a website
func (r *TopGeolocationAnalytics) GetTopCities(ctx context.Context, websiteID string, startDate, endDate time.Time, limit int) ([]models.TopItem, error) {
	query := `
		SELECT 
			COALESCE(city, 'Unknown') as name,
			COUNT(DISTINCT visitor_id) as count,
			ROUND(COUNT(DISTINCT visitor_id) * 100.0 / SUM(COUNT(DISTINCT visitor_id)) OVER(), 2) as percentage
		FROM events 
		WHERE website_id = $1 
			AND timestamp >= $2 
			AND timestamp <= $3
			AND event_type = 'pageview'
		GROUP BY city
		ORDER BY count DESC
		LIMIT $4
	`

	rows, err := r.db.Query(ctx, query, websiteID, startDate, endDate, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.TopItem
	for rows.Next() {
		var item models.TopItem
		var percentage sql.NullFloat64
		
		err := rows.Scan(&item.Name, &item.Count, &percentage)
		if err != nil {
			return nil, err
		}
		
		if percentage.Valid {
			item.Percentage = percentage.Float64
		}
		
		results = append(results, item)
	}

	return results, rows.Err()
}

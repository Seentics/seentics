package privacy

import (
	"github.com/jackc/pgx/v5/pgxpool"
)

// PrivacyRepository handles all privacy-related database operations
// This struct is defined here but methods are implemented in separate files:
// - privacy_export.go: Data export functionality
// - privacy_deletion.go: Data deletion functionality
// - privacy_anonymization.go: Data anonymization functionality
// - privacy_retention.go: Data retention and cleanup functionality
// - privacy_utils.go: Utility functions and audit logging
type PrivacyRepository struct {
	db *pgxpool.Pool
}

// NewPrivacyRepository creates a new PrivacyRepository instance
func NewPrivacyRepository(db *pgxpool.Pool) *PrivacyRepository {
	return &PrivacyRepository{
		db: db,
	}
}

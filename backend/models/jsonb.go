package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
)

// IntSlice for handling PostgreSQL integer arrays
type IntSlice []int

func (s IntSlice) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}
	return json.Marshal(s)
}

func (s *IntSlice) Scan(value interface{}) error {
	if value == nil {
		*s = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("failed to unmarshal IntSlice value")
	}

	return json.Unmarshal(bytes, s)
}

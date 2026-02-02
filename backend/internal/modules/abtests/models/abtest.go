package models

import "time"

type ABTest struct {
ID          string    `json:"id"`
WebsiteID   string    `json:"website_id"`
Name        string    `json:"name"`
Description string    `json:"description"`
Status      string    `json:"status"` // 'draft', 'running', 'paused', 'finished'
Goal        string    `json:"goal"`   // 'pageview', 'conversion'
CreatedAt   time.Time `json:"created_at"`
UpdatedAt   time.Time `json:"updated_at"`
Variants    []Variant `json:"variants"`
}

type Variant struct {
ID        string `json:"id"`
ABTestID  string `json:"ab_test_id"`
Name      string `json:"name"`
URL       string `json:"url"`
Weight    int    `json:"weight"` // 0-100
IsControl bool   `json:"is_control"`
}

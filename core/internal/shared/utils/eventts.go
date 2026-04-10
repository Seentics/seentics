package utils

// EventTimestampMs extracts the "ts" field (milliseconds) from a generic event map.
// Handles float64 (JSON default after unmarshal), int64, and int.
func EventTimestampMs(ev map[string]interface{}) int64 {
	v, ok := ev["ts"]
	if !ok {
		return 0
	}
	switch t := v.(type) {
	case float64:
		return int64(t)
	case int64:
		return t
	case int:
		return int64(t)
	default:
		return 0
	}
}

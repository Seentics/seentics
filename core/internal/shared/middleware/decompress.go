package middleware

import (
	"compress/gzip"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const maxDecompressedBody = 10 * 1024 * 1024 // 10MB limit to prevent zip bombs

// DecompressMiddleware transparently decompresses gzip-encoded request bodies.
// If Content-Encoding is not gzip, the request passes through unchanged.
func DecompressMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !strings.EqualFold(c.GetHeader("Content-Encoding"), "gzip") {
			c.Next()
			return
		}

		gz, err := gzip.NewReader(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid gzip body"})
			c.Abort()
			return
		}

		c.Request.Body = io.NopCloser(io.LimitReader(gz, maxDecompressedBody))
		c.Request.Header.Del("Content-Encoding")
		c.Request.Header.Del("Content-Length")

		c.Next()
	}
}

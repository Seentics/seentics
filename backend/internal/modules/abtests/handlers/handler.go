package handlers

import (
"analytics-app/internal/modules/abtests/models"
"analytics-app/internal/modules/abtests/services"
"net/http"

"github.com/gin-gonic/gin"
"github.com/rs/zerolog"
)

type ABTestHandler struct {
service *services.ABTestService
logger  zerolog.Logger
}

func NewABTestHandler(service *services.ABTestService, logger zerolog.Logger) *ABTestHandler {
return &ABTestHandler{
service: service,
logger:  logger,
}
}

func (h *ABTestHandler) Create(c *gin.Context) {
var req models.ABTest
if err := c.ShouldBindJSON(&req); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
return
}

websiteID := c.Param("website_id")
req.WebsiteID = websiteID

if err := h.service.CreateABTest(c.Request.Context(), &req); err != nil {
h.logger.Error().Err(err).Msg("Failed to create AB test")
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}

c.JSON(http.StatusCreated, req)
}

func (h *ABTestHandler) List(c *gin.Context) {
websiteID := c.Param("website_id")
tests, err := h.service.GetWebsiteABTests(c.Request.Context(), websiteID)
if err != nil {
h.logger.Error().Err(err).Msg("Failed to list AB tests")
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}

c.JSON(http.StatusOK, tests)
}

func (h *ABTestHandler) Get(c *gin.Context) {
websiteID := c.Param("website_id")
id := c.Param("id")

test, err := h.service.GetABTest(c.Request.Context(), id, websiteID)
if err != nil {
h.logger.Error().Err(err).Msg("Failed to get AB test")
c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
return
}

c.JSON(http.StatusOK, test)
}

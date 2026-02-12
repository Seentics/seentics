package handlers

import (
"net/http"
"analytics-app/internal/modules/realtime/hub"
"github.com/gin-gonic/gin"
"github.com/gorilla/websocket"
"github.com/rs/zerolog"
"time"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // In production, check origin
	},
}

type RealtimeHandler struct {
	Hub    *hub.Hub
	Logger zerolog.Logger
}

func NewRealtimeHandler(h *hub.Hub, logger zerolog.Logger) *RealtimeHandler {
	return &RealtimeHandler{
		Hub:    h,
		Logger: logger,
	}
}

func (h *RealtimeHandler) StreamPulse(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.Logger.Error().Err(err).Msg("Failed to upgrade to websocket")
		return
	}

	client := &hub.Client{
		Hub:       h.Hub,
		Conn:      conn,
		Send:      make(chan []byte, 256),
		WebsiteID: websiteID,
	}

	client.Hub.Register <- client

	// Start pumps
	go h.writePump(client)
	go h.readPump(client)
}

func (h *RealtimeHandler) readPump(c *hub.Client) {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error { 
c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil 
	})

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (h *RealtimeHandler) writePump(c *hub.Client) {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

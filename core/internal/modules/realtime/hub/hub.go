package hub

import (
"analytics-app/internal/modules/analytics/models"
"encoding/json"
"github.com/gorilla/websocket"
"sync"
)

// Client represents a websocket subscriber
type Client struct {
	Hub       *Hub
	Conn      *websocket.Conn
	Send      chan []byte
	WebsiteID string
}

// Hub maintains the set of active clients and broadcasts messages to them.
type Hub struct {
	// Registered clients by WebsiteID
	Clients map[string]map[*Client]bool

	// Inbound messages from the servers.
	Broadcast chan models.Event

	// Register requests from the clients.
	Register chan *Client

	// Unregister requests from clients.
	Unregister chan *Client
	
	mu sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		Broadcast:  make(chan models.Event, 1000),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Clients:    make(map[string]map[*Client]bool),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			if h.Clients[client.WebsiteID] == nil {
				h.Clients[client.WebsiteID] = make(map[*Client]bool)
			}
			h.Clients[client.WebsiteID][client] = true
			h.mu.Unlock()

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client.WebsiteID]; ok {
				if _, ok := h.Clients[client.WebsiteID][client]; ok {
					delete(h.Clients[client.WebsiteID], client)
					close(client.Send)
					if len(h.Clients[client.WebsiteID]) == 0 {
						delete(h.Clients, client.WebsiteID)
					}
				}
			}
			h.mu.Unlock()

		case event := <-h.Broadcast:
			h.mu.RLock()
			clients := h.Clients[event.WebsiteID]
			if len(clients) > 0 {
				payload, err := json.Marshal(event)
				if err == nil {
					for client := range clients {
						select {
						case client.Send <- payload:
						default:
							// Slow client, skip or close
						}
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

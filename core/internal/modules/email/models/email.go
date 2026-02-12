package models

type EmailRequest struct {
	To      []string `json:"to" binding:"required"`
	Subject string   `json:"subject" binding:"required"`
	HTML    string   `json:"html" binding:"required"`
	Plain   string   `json:"plain"`
	CC      []string `json:"cc"`
	BCC     []string `json:"bcc"`
	ReplyTo string   `json:"reply_to"`
}

type PostalSendRequest struct {
	To      []string          `json:"to"`
	From    string            `json:"from"`
	Subject string            `json:"subject"`
	HTML    string            `json:"html_body"`
	Plain   string            `json:"plain_body"`
	ReplyTo string            `json:"reply_to,omitempty"`
	CC      []string          `json:"cc,omitempty"`
	BCC     []string          `json:"bcc,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
}

type PostalSendResponse struct {
	Status string `json:"status"`
	Data   struct {
		MessageID string            `json:"message_id"`
		Messages  map[string]string `json:"messages"`
	} `json:"data"`
}

-- Create support_forms table
CREATE TABLE IF NOT EXISTS support_forms (
    id TEXT PRIMARY KEY,
    website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    fields JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create support_form_submissions table
CREATE TABLE IF NOT EXISTS support_form_submissions (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES support_forms(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create support_chat_widgets table
CREATE TABLE IF NOT EXISTS support_chat_widgets (
    id TEXT PRIMARY KEY,
    website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL, -- Customer user if logged in
    subject TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'open', -- open, pending, closed
    priority TEXT DEFAULT 'medium', -- low, medium, high
    source TEXT, -- web, email, chat
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create support_ticket_replies table
CREATE TABLE IF NOT EXISTS support_ticket_replies (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL, -- Admin or User replying
    message TEXT NOT NULL,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_support_forms_website_id ON support_forms(website_id);
CREATE INDEX idx_support_form_submissions_form_id ON support_form_submissions(form_id);
CREATE INDEX idx_support_chat_widgets_website_id ON support_chat_widgets(website_id);
CREATE INDEX idx_support_tickets_website_id ON support_tickets(website_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);

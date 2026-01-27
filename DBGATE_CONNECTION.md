# Connecting Docker PostgreSQL to DbGate

## Quick Connection Guide

Your PostgreSQL is running in Docker. Here's how to connect it to DbGate:

### Connection Details

```
Host: localhost
Port: 5432
Database: seentics_analytics
Username: seentics
Password: seentics_postgres_pass
```

---

## Step-by-Step Instructions

### 1. Open DbGate

Launch DbGate application on your Mac.

### 2. Create New Connection

- Click **"New Connection"** or the **"+"** button
- Select **"PostgreSQL"** as the database type

### 3. Enter Connection Details

Fill in the following fields:

| Field | Value |
|-------|-------|
| **Server** | `localhost` |
| **Port** | `5432` |
| **User** | `seentics` |
| **Password** | `seentics_postgres_pass` |
| **Database** | `seentics_analytics` |
| **Display Name** | `Seentics Analytics (Local)` |

### 4. Advanced Settings (Optional)

- **SSL Mode**: Disable (not needed for local Docker)
- **Connection Timeout**: 30 seconds (default)

### 5. Test Connection

Click **"Test Connection"** to verify it works.

### 6. Save & Connect

Click **"Save"** and then **"Connect"**.

---

## Troubleshooting

### Issue: Connection Refused

**Solution:** Make sure PostgreSQL container is running:
```bash
docker ps | grep postgres
```

If not running, start it:
```bash
cd /Users/shohag/Desktop/seentics-analytics
docker compose up -d postgres
```

### Issue: Authentication Failed

**Solution:** Verify credentials in docker-compose.yml:
```bash
grep -A 5 "POSTGRES_" docker-compose.yml
```

### Issue: Database Not Found

**Solution:** Check if database exists:
```bash
docker exec postgres psql -U seentics -l
```

---

## Alternative: Connection String

If DbGate supports connection strings, use:

```
postgresql://seentics:seentics_postgres_pass@localhost:5432/seentics_analytics
```

---

## Useful Commands

### View All Databases
```bash
docker exec postgres psql -U seentics -l
```

### Connect via CLI
```bash
docker exec -it postgres psql -U seentics -d seentics_analytics
```

### View All Tables
```bash
docker exec postgres psql -U seentics -d seentics_analytics -c "\dt"
```

### Check Connection from Host
```bash
psql -h localhost -p 5432 -U seentics -d seentics_analytics
# Password: seentics123
```

---

## Database Schema Overview

Your database contains the following main tables:

- **users** - User accounts
- **websites** - Website configurations
- **analytics_events** - Event tracking data
- **automations** - Automation definitions
- **automation_actions** - Automation actions
- **automation_conditions** - Automation conditions
- **automation_executions** - Automation execution logs
- **funnels** - Funnel definitions
- **funnel_steps** - Funnel step configurations

---

## DbGate Features You Can Use

Once connected, you can:

✅ **Browse Tables** - View all tables and their data
✅ **Run Queries** - Execute SQL queries
✅ **Export Data** - Export to CSV, JSON, Excel
✅ **Import Data** - Import from various formats
✅ **View Relationships** - See foreign key relationships
✅ **Edit Data** - Directly edit table data
✅ **Create Diagrams** - Generate ER diagrams
✅ **Query History** - View past queries

---

## Quick Queries to Try

### View Recent Events
```sql
SELECT event_type, event_name, page_url, created_at 
FROM analytics_events 
ORDER BY created_at DESC 
LIMIT 10;
```

### Count Events by Type
```sql
SELECT event_type, COUNT(*) as count 
FROM analytics_events 
GROUP BY event_type;
```

### View Active Automations
```sql
SELECT id, name, trigger_type, is_active 
FROM automations 
WHERE is_active = true;
```

### View Funnels
```sql
SELECT f.name, COUNT(fs.id) as step_count 
FROM funnels f 
LEFT JOIN funnel_steps fs ON f.id = fs.funnel_id 
GROUP BY f.id, f.name;
```

---

## Connection Saved!

Once you save this connection in DbGate, you can:
- Quickly reconnect anytime
- Switch between databases
- Manage multiple environments (local, staging, production)

Happy querying! 🚀

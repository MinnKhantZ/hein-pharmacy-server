# External Cron Job Configuration

## Overview

The server now uses HTTP endpoints instead of internal cron jobs for scheduled notifications. This allows the application to work with hosting providers that don't support running cron jobs.

## Setup

### 1. Environment Variable

Add the following environment variable to your `.env` file:

```env
CRON_API_KEY=your-secure-random-api-key-here
```

**Important:** Generate a strong, random API key to secure the endpoint. You can use a tool like:
```bash
# Generate a secure random key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. External Cron Service

Configure an external cron service to trigger the notification endpoint at your desired interval.

#### Recommended Services:
- **cron-job.org** (Free)
- **EasyCron** (Free tier available)
- **Cronitor** (Free tier available)
- **UptimeRobot** (Can be used for periodic calls)

### 3. Endpoint Configuration

#### Low Stock Notifications

**Endpoint:** `POST /api/notifications/cron/low-stock`

**Authentication:** Include API key in header or query parameter

**Examples:**

Using Header (Recommended):
```bash
curl -X POST https://your-server.com/api/notifications/cron/low-stock \
  -H "X-Cron-Api-Key: your-secure-random-api-key-here"
```

Using Query Parameter:
```bash
curl -X POST "https://your-server.com/api/notifications/cron/low-stock?api_key=your-secure-random-api-key-here"
```

**Recommended Schedule:**
- Run every minute to check for devices with scheduled notification times
- The server will only send notifications to devices at their configured alert time

#### Response Format

Success:
```json
{
  "success": true,
  "message": "Low stock notifications processed successfully",
  "timestamp": "2025-10-20T10:30:00.000Z"
}
```

Error:
```json
{
  "error": "Failed to process low stock notifications",
  "message": "Error details here",
  "timestamp": "2025-10-20T10:30:00.000Z"
}
```

## Example: Setting up with cron-job.org

1. Go to https://cron-job.org
2. Create a free account
3. Click "Create Cronjob"
4. Configure:
   - **Title:** Hein Pharmacy - Low Stock Notifications
   - **Address:** `https://your-server.com/api/notifications/cron/low-stock`
   - **Schedule:** `* * * * *` (every minute)
   - **Request method:** POST
   - **Headers:** Add header `X-Cron-Api-Key: your-secure-random-api-key-here`
5. Save and enable

## Testing

### Health Check
```bash
curl https://your-server.com/api/notifications/health
```

### Manual Trigger (for testing)
```bash
curl -X POST https://your-server.com/api/notifications/cron/low-stock \
  -H "X-Cron-Api-Key: your-secure-random-api-key-here"
```

## Security Notes

- Keep your `CRON_API_KEY` secret and secure
- Use HTTPS in production to encrypt the API key in transit
- Rotate the API key periodically for better security
- Monitor the endpoint for unauthorized access attempts

## Migration from Internal Cron

The server no longer starts internal cron jobs. The `cronService.checkAndNotifyLowStockPerDevice()` function is now called via the HTTP endpoint instead of being scheduled internally.

### What Changed:
- ✅ Removed `cronService.startJobs()` from server startup
- ✅ Removed `cronService.stopJobs()` from shutdown handlers
- ✅ Added `/api/notifications/cron/low-stock` endpoint
- ✅ Added API key authentication for cron endpoints
- ✅ Client-side notification methods removed (notifications are now server-driven)

### What Stayed the Same:
- The actual notification logic remains unchanged
- Per-device notification timing still works
- All notification preferences are still respected

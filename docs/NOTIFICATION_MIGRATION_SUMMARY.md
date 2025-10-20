# Notification System Refactoring - Migration Summary

## Overview

This migration moves from internal server-side cron jobs to HTTP endpoint-triggered notifications, allowing the system to work with hosting providers that don't support cron jobs.

## Changes Made

### Server-Side Changes

1. **New Files Created:**
   - `routes/notifications.js` - HTTP endpoints for triggering notifications
   - `middleware/cronAuth.js` - API key authentication for cron endpoints
   - `docs/EXTERNAL_CRON_SETUP.md` - Setup documentation

2. **Modified Files:**
   - `index.js` - Added notifications route, removed internal cron job initialization

3. **New Endpoint:**
   ```
   POST /api/notifications/cron/low-stock
   ```
   - Triggers low stock notification checks
   - Requires `X-Cron-Api-Key` header or `api_key` query parameter
   - Returns JSON response with success/failure status

4. **Environment Variable Required:**
   ```env
   CRON_API_KEY=your-secure-random-api-key-here
   ```

### Client-Side Changes

1. **Modified Files:**
   - `services/notificationService.js` - Removed deprecated methods:
     - `scheduleNotification()`
     - `sendLowStockAlert()`
     - `sendDailySalesNotification()`
     - `cancelScheduledNotifications()`
   
   - `contexts/NotificationContext.js` - Removed from context:
     - `sendLowStockAlert`
     - `sendDailySalesNotification`

2. **Reason for Removal:**
   - All notifications are now server-driven
   - Push notifications are sent from the server to registered devices
   - Client-side scheduling is no longer needed

## Migration Steps

### 1. Server Setup

1. Add `CRON_API_KEY` to your `.env` file:
   ```bash
   # Generate a secure key
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Restart your server

3. Test the health endpoint:
   ```bash
   curl https://your-server.com/api/notifications/health
   ```

### 2. Configure External Cron Service

Choose a cron service provider (e.g., cron-job.org, EasyCron) and configure:

- **URL:** `https://your-server.com/api/notifications/cron/low-stock`
- **Method:** POST
- **Schedule:** `* * * * *` (every minute)
- **Header:** `X-Cron-Api-Key: your-api-key-here`

### 3. Verify Notifications

1. Set a test item's stock below minimum
2. Configure a device with low stock alerts enabled
3. Wait for the scheduled notification time
4. Verify push notification is received

## What Still Works

✅ Per-device notification timing  
✅ Low stock alerts based on user preferences  
✅ Push notification registration  
✅ Device management and preferences  
✅ All existing notification settings  

## What Changed

❌ No more internal cron jobs  
❌ Client-side notification methods removed  
✅ External HTTP-triggered notifications  
✅ Better hosting compatibility  

## Testing

### Manual Test
```bash
# Test the cron endpoint
curl -X POST https://your-server.com/api/notifications/cron/low-stock \
  -H "X-Cron-Api-Key: your-api-key-here"
```

### Expected Response
```json
{
  "success": true,
  "message": "Low stock notifications processed successfully",
  "timestamp": "2025-10-20T10:30:00.000Z"
}
```

## Rollback Plan

If you need to rollback:

1. Restore `index.js` to call `cronService.startJobs()`
2. The `cronService.js` file still exists and is functional
3. Disable the external cron job

## Support

For detailed setup instructions, see: `docs/EXTERNAL_CRON_SETUP.md`

## Security Considerations

- Keep `CRON_API_KEY` secret
- Use HTTPS in production
- Rotate API key periodically
- Monitor for unauthorized access attempts

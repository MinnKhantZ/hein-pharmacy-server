# Quick Setup Guide - External Cron for Notifications

## 1. Generate API Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output.

## 2. Add to .env

```env
CRON_API_KEY=<paste-your-generated-key-here>
```

## 3. Setup on cron-job.org (Free)

1. Go to https://cron-job.org
2. Sign up / Login
3. Create new cronjob:
   - **Title:** Low Stock Alerts
   - **URL:** `https://your-server.com/api/notifications/cron/low-stock`
   - **Schedule:** `* * * * *` (every minute)
   - **Request Method:** POST
   - **Add Custom Header:**
     - Name: `X-Cron-Api-Key`
     - Value: `<your-api-key-from-step-1>`
4. Save & Enable

## 4. Test

```bash
curl -X POST https://your-server.com/api/notifications/cron/low-stock \
  -H "X-Cron-Api-Key: your-api-key-here"
```

Should return:
```json
{"success": true, "message": "Low stock notifications processed successfully", ...}
```

## Alternative Services

- **EasyCron:** https://www.easycron.com/
- **Cronitor:** https://cronitor.io/
- **UptimeRobot:** https://uptimerobot.com/ (Monitor with HTTP POST)

## Troubleshooting

**401 Error:** API key missing  
**403 Error:** API key invalid  
**500 Error:** Check server logs

**No notifications received:**
- Verify device has low stock alerts enabled
- Check notification time matches current time
- Ensure items are actually low stock
- Check server logs for errors

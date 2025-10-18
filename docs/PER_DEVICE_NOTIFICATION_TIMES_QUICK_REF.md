# Quick Reference: Per-Device Notification Times

## Summary
Each device can now configure its own time for receiving daily low stock notifications. This allows different staff members or shifts to receive notifications at times convenient for them.

## Key Changes

### Database
- **Table**: `devices`
- **New Column**: `low_stock_alert_time` (TIME, default '09:00:00')

### Server Files Modified
1. `db/migrations/20240102000002-add-low-stock-alert-time-to-devices.js` - ✅ Migrated
2. `controllers/deviceController.js` - Accepts and stores time
3. `services/cronService.js` - Per-minute check instead of daily

### Client Files Modified
1. `services/notificationService.js` - Includes time in registration/updates
2. `contexts/NotificationContext.js` - Added lowStockAlertTime state
3. `app/(tabs)/profile.tsx` - Time picker UI
4. `i18n.js` - New translation keys

## API Changes

### Register Device
```javascript
POST /api/devices/register
{
  "device_id": "unique-id",
  "push_token": "ExponentPushToken[xxx]",
  "device_model": "iPhone 14",
  "low_stock_alert_time": "09:00:00"  // NEW - optional, defaults to 09:00:00
}
```

### Update Preferences
```javascript
PUT /api/devices/preferences
{
  "low_stock_alerts": true,
  "sales_notifications": true,
  "low_stock_alert_time": "14:30:00"  // NEW - optional
}
```

## Time Format

| Context | Format | Example |
|---------|--------|---------|
| Client (storage) | HH:MM | '09:00' |
| Client (API) | HH:MM:SS | '09:00:00' |
| Server (database) | TIME | '09:00:00' |
| Server (query) | HH:MM% | '09:00%' |

## How It Works

1. **Cron runs every minute** ('* * * * *')
2. **Queries devices** matching current time (e.g., at 09:00, finds devices with '09:00%')
3. **Checks inventory** for each matched device's owner
4. **Sends notifications** to devices with low stock items

## User Experience

### Setting Notification Time
1. Open app → Profile
2. Tap "Settings"
3. Tap "Notification Settings"
4. Enable "Low Stock Alerts" (if not already on)
5. **NEW**: "Alert Time" section appears
6. Tap time button (shows current time, e.g., "09:00")
7. Time picker modal opens
8. Enter hour (0-23) and minute (0-59)
9. Tap "Done"
10. Success message: "Alert time updated successfully"

### Visual Indicators
- ✅ Time displayed with clock icon (🕐)
- ✅ Hint text: "Daily low stock notifications will be sent at this time"
- ✅ Only visible when Low Stock Alerts is enabled
- ✅ Available in both English and Burmese

## Testing Quick Checks

```bash
# 1. Check migration ran successfully
psql -d hein_pharmacy_dev -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='devices' AND column_name='low_stock_alert_time';"

# 2. Check devices with alert times
psql -d hein_pharmacy_dev -c "SELECT device_id, device_model, low_stock_alert_time, low_stock_alerts FROM devices;"

# 3. Test cron query (run at current time)
psql -d hein_pharmacy_dev -c "SELECT * FROM devices WHERE is_active = true AND low_stock_alerts = true AND low_stock_alert_time::text LIKE '09:00%';"
```

## Example Scenarios

### Scenario 1: Single Device
- Device A: Alert time 09:00
- **Result**: Receives notification daily at 9:00 AM

### Scenario 2: Multiple Devices (Same Owner)
- Device A: Alert time 09:00 (morning shift)
- Device B: Alert time 16:00 (evening shift)
- **Result**: Each device gets notification at its configured time

### Scenario 3: Disable Notifications
- Device A: Alert time 09:00, low_stock_alerts = false
- **Result**: No notifications sent even at 9:00 AM

## Translation Keys Added

### English
- "Alert Time"
- "Set Alert Time"
- "Daily low stock notifications will be sent at this time"
- "Hour"
- "Minute"
- "Alert time updated successfully"

### Burmese (မြန်မာ)
- "အသိပေးချိန်"
- "အသိပေးချိန်သတ်မှတ်ပါ"
- "ဤအချိန်တွင် နေ့စဉ်လက်ကျန်နည်းသောအသိပေးချက်များပို့ပါမည်"
- "နာရီ"
- "မိနစ်"
- "အသိပေးချိန်အောင်မြင်စွာပြောင်းလဲခဲ့သည်"

## Troubleshooting

| Issue | Check | Solution |
|-------|-------|----------|
| No notifications at set time | Cron service running? | Check server logs for "Cron service started" |
| Time not saving | Network error? | Check API response in app logs |
| Wrong time | Timezone issue? | Server uses Asia/Yangon (UTC+6:30) |
| Multiple notifications | Duplicate devices? | Check for duplicate device_id in database |

## Related Implementations

This feature builds on:
- ✅ Sales notification exclusion (device that creates sale doesn't get notified)
- ✅ Daily scheduled notifications (moved from immediate to scheduled)
- ✅ Admin owner management (password reset, edit owners)

## Next Steps

1. ✅ Migration completed
2. ✅ Server code updated
3. ✅ Client code updated
4. ✅ UI implemented
5. ✅ Translations added
6. ⏳ Test with real devices
7. ⏳ Monitor for 24 hours to verify cron execution
8. ⏳ Collect user feedback on UI/UX

## Performance Note

- Cron runs 1,440 times per day (every minute)
- Most executions match 0 devices (when no one has that exact time)
- Average load: ~5-20 queries per minute
- Scales well up to hundreds of devices

## Migration Command
```bash
cd hein-pharmacy-server
npx sequelize-cli db:migrate
```

## Files to Review
- Full documentation: `docs/PER_DEVICE_NOTIFICATION_TIMES.md`
- Migration: `db/migrations/20240102000002-add-low-stock-alert-time-to-devices.js`
- Cron service: `services/cronService.js`
- Device controller: `controllers/deviceController.js`
- Client service: `hein-pharmacy-client/services/notificationService.js`
- UI: `hein-pharmacy-client/app/(tabs)/profile.tsx`

# Per-Device Low Stock Notification Times

## Overview
This feature allows each device to configure its own preferred time for receiving daily low stock notifications. Different devices can have different notification times to accommodate various user schedules.

## Changes Made

### Database Changes
- **Migration**: `20240102000002-add-low-stock-alert-time-to-devices.js`
- **Table**: `devices`
- **New Column**: `low_stock_alert_time` (TIME type, default '09:00:00')
- Each device can now store its preferred notification time in HH:MM:SS format

### Server-Side Changes

#### 1. Device Controller (`controllers/deviceController.js`)
**Changes**:
- Modified `registerDevice()` to accept `low_stock_alert_time` parameter (default: '09:00:00')
- Updated SQL INSERT to include the new column
- Modified `updateNotificationPreferences()` to update `low_stock_alert_time` using COALESCE

**API Endpoints Affected**:
- `POST /api/devices/register` - Now accepts `low_stock_alert_time` in request body
- `PUT /api/devices/preferences` - Now accepts `low_stock_alert_time` in request body

#### 2. Cron Service (`services/cronService.js`)
**Major Rewrite**:
- Changed from single daily cron job to per-minute check
- **Old Behavior**: Single cron at 9:00 AM ('0 9 * * *')
- **New Behavior**: Runs every minute ('* * * * *')
- New function: `checkAndNotifyLowStockPerDevice()`
  - Queries devices matching current HH:MM time
  - Sends notifications only to devices with matching alert time
  - Filters to only active devices with low_stock_alerts enabled

**SQL Query**:
```sql
SELECT * FROM devices 
WHERE is_active = true 
AND low_stock_alerts = true 
AND low_stock_alert_time::text LIKE $1
```
Parameters: `['HH:MM%']` (e.g., '09:00%')

### Client-Side Changes

#### 1. Notification Service (`services/notificationService.js`)
**Changes**:
- Updated `getNotificationSettings()` to include `lowStockAlertTime: '09:00'` in default settings
- Modified `registerDeviceWithServer()`:
  - Sends `low_stock_alert_time` formatted as 'HH:MM:SS'
  - Converts client format (HH:MM) to server format (HH:MM:SS)
  - Defaults to '09:00:00' if not set
- Modified `updateServerPreferences()`:
  - Sends `low_stock_alert_time` when updating preferences
  - Only sends if `lowStockAlertTime` is provided (uses undefined otherwise)

#### 2. Notification Context (`contexts/NotificationContext.js`)
**Changes**:
- Added `lowStockAlertTime: '09:00'` to initial notification settings state
- Context now maintains and propagates the time setting

#### 3. Profile UI (`app/(tabs)/profile.tsx`)
**New UI Components**:
- Added state: `lowStockAlertTime` in notification settings
- Added state: `showTimePicker` for time picker modal
- Added handler: `handleTimeChange()` to update notification time

**Notification Settings Modal**:
- New collapsible section appears when "Enable Low Stock Alerts" is ON
- Shows current alert time (e.g., "09:00")
- Tap to open time picker modal
- Displays hint: "Daily low stock notifications will be sent at this time"

**Time Picker Modal**:
- Simple modal with hour and minute input fields
- Hour: 0-23 (24-hour format)
- Minute: 0-59
- Updates settings immediately on value change
- Shows success alert on update

**New Styles Added**:
- `timePickerContainer` - Container for time display in notification settings
- `timePickerLabel` - Label for "Alert Time"
- `timePickerButton` - Touchable button showing current time
- `timePickerText` - Large, bold time display
- `timePickerIcon` - Clock icon (🕐)
- `timePickerHint` - Description text
- `timePickerModalOverlay` - Semi-transparent backdrop
- `timePickerModal` - Modal container
- `timePickerInputContainer` - Container for hour/minute inputs
- `timeInputLabel` - Labels for Hour/Minute
- `timeInput` - Large input fields for time values
- `timeInputSeparator` - Colon separator between hour and minute

#### 4. Translations (`i18n.js`)
**New Translation Keys**:
- English:
  - "Alert Time": "Alert Time"
  - "Set Alert Time": "Set Alert Time"
  - "Daily low stock notifications will be sent at this time": "Daily low stock notifications will be sent at this time"
  - "Hour": "Hour"
  - "Minute": "Minute"
  - "Alert time updated successfully": "Alert time updated successfully"

- Burmese (မြန်မာ):
  - "Alert Time": "အသိပေးချိန်"
  - "Set Alert Time": "အသိပေးချိန်သတ်မှတ်ပါ"
  - "Daily low stock notifications will be sent at this time": "ဤအချိန်တွင် နေ့စဉ်လက်ကျန်နည်းသောအသိပေးချက်များပို့ပါမည်"
  - "Hour": "နာရီ"
  - "Minute": "မိနစ်"
  - "Alert time updated successfully": "အသိပေးချိန်အောင်မြင်စွာပြောင်းလဲခဲ့သည်"

## Data Flow

### 1. Device Registration/Update
```
Client Device
    ↓ (includes lowStockAlertTime: '09:00')
notificationService.registerDeviceWithServer()
    ↓ (formats to '09:00:00')
POST /api/devices/register { low_stock_alert_time: '09:00:00' }
    ↓
deviceController.registerDevice()
    ↓
Database: INSERT into devices (low_stock_alert_time)
```

### 2. Time Preference Update
```
User changes time in Profile → Time Picker Modal
    ↓
handleTimeChange(hours, minutes)
    ↓
updateNotificationSettings({ lowStockAlertTime: 'HH:MM' })
    ↓
notificationService.updateServerPreferences()
    ↓ (formats to 'HH:MM:SS')
PUT /api/devices/preferences { low_stock_alert_time: 'HH:MM:SS' }
    ↓
deviceController.updateNotificationPreferences()
    ↓
Database: UPDATE devices SET low_stock_alert_time = 'HH:MM:SS'
```

### 3. Daily Notification Check
```
Cron Job (runs every minute)
    ↓
cronService.checkAndNotifyLowStockPerDevice()
    ↓
Query: SELECT devices WHERE low_stock_alert_time LIKE 'HH:MM%'
    ↓ (e.g., at 09:00, finds all devices with alert time 09:00:xx)
For each matched device:
    ↓
Check low stock inventory for that device's owner
    ↓
Send notification to device's push_token
```

## Time Format Conventions

### Client-Side
- **Storage**: 'HH:MM' (e.g., '09:00', '14:30')
- **Display**: 'HH:MM' format in UI
- **Input**: Separate hour (0-23) and minute (0-59) fields

### Server-Side
- **Storage**: 'HH:MM:SS' in PostgreSQL TIME column (e.g., '09:00:00')
- **API**: Accepts 'HH:MM:SS' format
- **Query**: Matches on 'HH:MM%' pattern to catch all seconds

### Conversion
- **Client → Server**: Append ':00' to HH:MM → 'HH:MM:00'
- **Server → Client**: Truncate seconds (not needed, only shown in UI as stored)

## Usage Example

### Scenario: Pharmacy Owner with Two Devices

**Device 1** (Morning Staff):
- Alert Time: 08:00
- Receives low stock notifications at 8:00 AM daily

**Device 2** (Evening Staff):
- Alert Time: 16:00
- Receives low stock notifications at 4:00 PM daily

**Cron Execution**:
- At 08:00: Checks devices with alert_time LIKE '08:00%', sends to Device 1
- At 16:00: Checks devices with alert_time LIKE '16:00%', sends to Device 2

## Testing

### Manual Testing Steps

1. **Test Device Registration**:
   ```bash
   # Register device with custom time
   curl -X POST http://localhost:5000/api/devices/register \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{
       "device_id": "test-device-1",
       "push_token": "ExponentPushToken[xxx]",
       "device_model": "Test Device",
       "low_stock_alert_time": "14:30:00"
     }'
   ```

2. **Test Preference Update**:
   ```bash
   # Update notification time
   curl -X PUT http://localhost:5000/api/devices/preferences \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{
       "low_stock_alerts": true,
       "low_stock_alert_time": "10:00:00"
     }'
   ```

3. **Verify Database**:
   ```sql
   SELECT device_id, low_stock_alert_time, low_stock_alerts 
   FROM devices 
   WHERE is_active = true;
   ```

4. **Test Cron Query**:
   ```sql
   -- At 09:00, should find devices with 09:00:00 alert time
   SELECT * FROM devices 
   WHERE is_active = true 
   AND low_stock_alerts = true 
   AND low_stock_alert_time::text LIKE '09:00%';
   ```

5. **Test Client UI**:
   - Open app → Profile → Settings → Notification Settings
   - Enable Low Stock Alerts
   - Tap on Alert Time button
   - Change hour and minute values
   - Verify "Alert time updated successfully" message
   - Close and reopen app to verify persistence

### Integration Testing

1. **Two Devices, Different Times**:
   - Register Device A with alert time 09:00
   - Register Device B with alert time 14:00
   - Create low stock inventory items
   - Wait for 09:00 → Only Device A should receive notification
   - Wait for 14:00 → Only Device B should receive notification

2. **Time Change Test**:
   - Register device with alert time 10:00
   - Wait for 10:00 → Should receive notification
   - Change alert time to 15:00 via app UI
   - Wait for 10:00 next day → Should NOT receive notification
   - Wait for 15:00 → Should receive notification

3. **Toggle Test**:
   - Set alert time to 09:00
   - Disable low stock alerts
   - Wait for 09:00 → Should NOT receive notification
   - Re-enable low stock alerts
   - Wait for 09:00 next day → Should receive notification

## Performance Considerations

### Cron Frequency
- Runs every minute (1,440 times per day)
- Each execution performs:
  1. One SELECT query to find matching devices
  2. One SELECT query per device to check inventory
  3. Notification sending for devices with low stock

### Optimization
- Query uses indexed columns: `is_active`, `low_stock_alerts`
- Time matching uses LIKE pattern, leverages PostgreSQL TIME type indexing
- Only queries active devices with notifications enabled
- Batches notifications per device-owner combination

### Load Estimate
- 100 active devices: ~100 queries per minute worst case
- Most minutes will match 0-5 devices (notifications spread across day)
- Actual load: ~5-20 queries per minute on average

## Migration Notes

### Running the Migration
```bash
cd hein-pharmacy-server
npx sequelize-cli db:migrate
```

### Rollback (if needed)
```bash
npx sequelize-cli db:migrate:undo
```

### Migration Success
```
Loaded configuration file "config\config.js".
Using environment "development".
== 20240102000002-add-low-stock-alert-time-to-devices: migrating 
== 20240102000002-add-low-stock-alert-time-to-devices: migrated (0.959s)
```

## Backward Compatibility

### Default Behavior
- Existing devices: Automatically get '09:00:00' as default alert time
- No breaking changes to existing API calls
- Old clients (without time parameter): Use default 09:00:00

### API Compatibility
- `low_stock_alert_time` parameter is optional in all endpoints
- Defaults applied if parameter not provided
- Existing device registration calls work without modification

## Future Enhancements

### Potential Improvements
1. **Timezone Support**: Store timezone per device for accurate scheduling
2. **Multiple Alert Times**: Allow multiple alert times per device
3. **Day-Specific Times**: Different times for different days of week
4. **Snooze Feature**: Allow users to snooze notifications
5. **Time Range**: Alert window instead of specific time (e.g., 9:00-9:30)
6. **Smart Scheduling**: ML-based optimal notification times

### UI Enhancements
1. **Native Time Picker**: Use @react-native-community/datetimepicker
2. **12-Hour Format Option**: AM/PM display based on user preference
3. **Quick Presets**: Common times (Morning 9:00, Afternoon 14:00, Evening 18:00)
4. **Notification Preview**: Show sample notification with current settings

## Troubleshooting

### Common Issues

1. **Notifications Not Received at Set Time**:
   - Check device is active: `SELECT is_active FROM devices WHERE device_id = 'xxx'`
   - Check low_stock_alerts enabled: `SELECT low_stock_alerts FROM devices WHERE device_id = 'xxx'`
   - Check alert time set correctly: `SELECT low_stock_alert_time FROM devices WHERE device_id = 'xxx'`
   - Check cron service is running: Check server logs for "Cron service started"
   - Verify low stock items exist: `SELECT * FROM inventory WHERE quantity <= low_stock_threshold`

2. **Time Not Persisting**:
   - Check server logs for errors in updateNotificationPreferences
   - Verify authentication token is valid
   - Check network connectivity from app to server

3. **Multiple Notifications**:
   - Check for duplicate devices: `SELECT device_id, COUNT(*) FROM devices GROUP BY device_id HAVING COUNT(*) > 1`
   - Verify device_id is unique per device
   - Check cron isn't running multiple instances

4. **Wrong Time Zone**:
   - Server uses 'Asia/Yangon' timezone
   - Verify server timezone: Check `cronService.js` TZ setting
   - Client should use local time, server converts

## Related Documentation
- [Notification System](NOTIFICATION_SYSTEM.md) - Original notification implementation
- [Low Stock Alerts](LOW_STOCK_ALERTS.md) - Low stock feature documentation
- [Device Management](DEVICE_MANAGEMENT.md) - Device registration and management

## Version History
- **v1.0** (2024-01-02): Initial per-device notification time implementation
- **v0.9** (2024-01-02): Global notification time (9:00 AM only)
- **v0.8** (2024-01-01): Immediate low stock notifications

## Authors
- Implementation Date: January 2, 2024
- Feature Request: User requirement for customizable per-device notification times

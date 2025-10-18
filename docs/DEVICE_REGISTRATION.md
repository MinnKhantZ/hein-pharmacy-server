# Device Registration & Notification Preferences

## Overview

The Hein Pharmacy notification system now supports:
- ✅ Multiple devices per account
- ✅ Individual notification preferences per device
- ✅ Automatic device registration on login
- ✅ Preference synchronization between client and server

## Architecture

### Server-Side
- **Database**: `devices` table stores device info and preferences
- **API Endpoints**: `/api/devices/*` for device management
- **Smart Notifications**: Only sends to devices with enabled preferences

### Client-Side
- **Auto-Registration**: Devices register automatically on login
- **Preference Sync**: Settings sync with server in real-time
- **Multi-Device Support**: Same account can use multiple devices

## Database Schema

```sql
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES owners(id),
  push_token VARCHAR(255) NOT NULL UNIQUE,
  device_id VARCHAR(255),
  device_model VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  low_stock_alerts BOOLEAN DEFAULT true,      -- NEW
  sales_notifications BOOLEAN DEFAULT true,    -- NEW
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Register Device
```http
POST /api/devices/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "push_token": "ExponentPushToken[...]",
  "device_id": "device-unique-id",
  "device_model": "iPhone 13 Pro",
  "low_stock_alerts": true,        // Optional, default: true
  "sales_notifications": true       // Optional, default: true
}
```

**Response:**
```json
{
  "message": "Device registered successfully",
  "device": {
    "id": 1,
    "push_token": "ExponentPushToken[...]",
    "low_stock_alerts": true,
    "sales_notifications": true
  }
}
```

### Update Notification Preferences
```http
PUT /api/devices/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "push_token": "ExponentPushToken[...]",
  "low_stock_alerts": false,        // Optional
  "sales_notifications": true        // Optional
}
```

### Get My Devices
```http
GET /api/devices/my-devices
Authorization: Bearer <token>
```

**Response:**
```json
{
  "devices": [
    {
      "id": 1,
      "push_token": "ExponentPushToken[...]",
      "device_id": "iphone-123",
      "device_model": "iPhone 13 Pro",
      "is_active": true,
      "low_stock_alerts": true,
      "sales_notifications": false,
      "last_active": "2025-10-12T10:30:00Z"
    },
    {
      "id": 2,
      "push_token": "ExponentPushToken[...]",
      "device_id": "android-456",
      "device_model": "Samsung Galaxy S21",
      "is_active": true,
      "low_stock_alerts": false,
      "sales_notifications": true,
      "last_active": "2025-10-12T09:15:00Z"
    }
  ],
  "count": 2
}
```

## Client Implementation

### Automatic Device Registration

The client automatically registers the device in these scenarios:

1. **On Login**: When user logs in, device is registered with current preferences
2. **On Permission Grant**: When notification permissions are granted
3. **On App Start**: If user is already logged in and has notification permissions

### Notification Preferences

Users can configure two types of notifications:

```javascript
const notificationSettings = {
  lowStockAlerts: true,      // Receive low stock alerts
  salesNotifications: true    // Receive sales notifications
};
```

### Using the NotificationContext

```javascript
import { useNotifications } from '../contexts/NotificationContext';

function SettingsScreen() {
  const { 
    notificationSettings, 
    updateSettings,
    permissionStatus,
    requestPermissions
  } = useNotifications();

  const handleToggleLowStock = async () => {
    const newSettings = {
      ...notificationSettings,
      lowStockAlerts: !notificationSettings.lowStockAlerts
    };
    await updateSettings(newSettings);
  };

  const handleToggleSales = async () => {
    const newSettings = {
      ...notificationSettings,
      salesNotifications: !notificationSettings.salesNotifications
    };
    await updateSettings(newSettings);
  };

  return (
    <View>
      <Switch 
        value={notificationSettings.lowStockAlerts}
        onValueChange={handleToggleLowStock}
      />
      <Switch 
        value={notificationSettings.salesNotifications}
        onValueChange={handleToggleSales}
      />
    </View>
  );
}
```

## Server-Side Notification Logic

When a sale is created, the server:

1. **Queries active devices** with their preferences
2. **Filters by notification type**:
   - Low stock alerts → only to devices with `low_stock_alerts = true`
   - Sales notifications → only to devices with `sales_notifications = true`
3. **Sends notifications** to filtered device list

### Example Flow

```javascript
// Get devices with preferences
const devices = await pool.query(
  'SELECT push_token, low_stock_alerts, sales_notifications FROM devices WHERE is_active = true'
);

// Filter for low stock alerts
const lowStockTokens = devices.rows
  .filter(device => device.low_stock_alerts)
  .map(device => device.push_token);

// Send to filtered devices
await notificationService.sendLowStockAlert(lowStockTokens, itemData);

// Filter for sales notifications
const salesTokens = devices.rows
  .filter(device => device.sales_notifications)
  .map(device => device.push_token);

// Send to filtered devices
await notificationService.sendDailySalesNotification(salesTokens, salesData);
```

## Multi-Device Scenarios

### Scenario 1: User has 2 devices
- **iPhone**: Low stock alerts ON, Sales notifications OFF
- **iPad**: Low stock alerts OFF, Sales notifications ON

**Result when sale is created:**
- iPhone receives low stock alert (if applicable)
- iPad receives sales notification
- Both devices work independently with their own preferences

### Scenario 2: User has 3 devices
- **Work Phone**: All notifications ON
- **Personal Phone**: Only low stock alerts ON
- **Tablet**: All notifications OFF

**Result:**
- Work phone gets all notifications
- Personal phone only gets low stock alerts
- Tablet gets no notifications

### Scenario 3: Shared account, multiple users
- Owner has 2 devices with different preferences
- Manager has 1 device with all notifications enabled
- All 3 devices receive notifications based on their individual settings

## Testing

### Test Device Registration

```javascript
// In your React Native app
import notificationService from '../services/notificationService';
import { deviceAPI } from '../services/api';

// Get push token
const token = await notificationService.registerForPushNotificationsAsync();

// Register with server
await notificationService.registerDeviceWithServer(token);

// Verify registration
const response = await deviceAPI.getMyDevices();
console.log('My devices:', response.data);
```

### Test Notification Preferences

```bash
# Update preferences via API
curl -X PUT http://localhost:5000/api/devices/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "push_token": "ExponentPushToken[...]",
    "low_stock_alerts": false,
    "sales_notifications": true
  }'
```

### Test Notification Sending

```bash
# Create a sale and check server logs
# You should see:
# 📱 Found X active device(s) for notifications
# 📉 Low stock detected: Item Name (X/Y)
#    Sending to N device(s) with low stock alerts enabled
# 💰 Sending sales notification to M device(s)
```

## Migration Guide

### From Old System to New System

If you already have devices in the database without preferences:

```sql
-- All existing devices will default to TRUE for both preferences
-- No migration needed, columns have DEFAULT true

-- Optional: Set specific preferences for existing devices
UPDATE devices 
SET low_stock_alerts = false, sales_notifications = true
WHERE owner_id = 1;
```

### Client App Update

Users don't need to do anything! The app will:
1. Auto-register on next login with default preferences (both ON)
2. Preferences can be changed in settings screen

## Best Practices

1. **Default to Enabled**: New devices default to all notifications enabled
2. **Sync on Change**: Preferences sync immediately when changed
3. **Fail Gracefully**: If server sync fails, local preferences still work
4. **Re-register on Login**: Device preferences are updated on each login
5. **Respect User Choice**: Never override user's explicit preference changes

## Troubleshooting

### Device not receiving notifications

1. Check if device is registered:
   ```bash
   GET /api/devices/my-devices
   ```

2. Verify preferences are enabled:
   ```sql
   SELECT * FROM devices WHERE push_token = 'ExponentPushToken[...]';
   ```

3. Check server logs when sale is created:
   - Should show device count and filtered lists

### Preferences not syncing

1. Ensure user is logged in (has auth token)
2. Check network connectivity
3. Verify API endpoint is working:
   ```bash
   curl -X PUT /api/devices/preferences ...
   ```

### Multiple devices showing

This is expected! One account can have multiple devices.
- Each device has its own preferences
- Inactive devices don't receive notifications
- Old devices are automatically marked inactive after prolonged inactivity

## Security Considerations

1. **Owner-based access**: Users can only manage their own devices
2. **Token authentication**: All endpoints require valid JWT
3. **Device validation**: Push tokens are validated before registration
4. **Automatic cleanup**: Inactive/invalid tokens are removed automatically

## Future Enhancements

- [ ] Notification scheduling (quiet hours)
- [ ] Per-item notification preferences
- [ ] Notification history/audit log
- [ ] Custom notification sounds per type
- [ ] Delivery receipts and analytics

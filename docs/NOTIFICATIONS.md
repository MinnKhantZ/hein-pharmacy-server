# Notification System Setup

This document explains how to set up and use push notifications in the Hein Pharmacy system.

## Overview

The notification system uses **Expo Push Notifications** with the `expo-server-sdk` to send alerts to mobile devices.

## Features

- ✅ Low stock alerts when inventory items reach minimum threshold
- ✅ Sales notifications when new sales are recorded
- ✅ Test notification endpoint for debugging
- ✅ Device registration and management
- ✅ Support for multiple devices per user

## Configuration

### Environment Variables

Make sure the following is set in your `.env` file:

```env
EXPO_ACCESS_TOKEN=your_expo_access_token_here
```

### Database

The `devices` table stores push notification tokens:

```sql
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES owners(id),
  push_token VARCHAR(255) NOT NULL UNIQUE,
  device_id VARCHAR(255),
  device_model VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Device Registration

#### Register Device
```http
POST /api/devices/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "device_id": "device-unique-id",
  "device_model": "iPhone 13 Pro"
}
```

#### Unregister Device
```http
POST /api/devices/unregister
Authorization: Bearer <token>
Content-Type: application/json

{
  "push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

#### Get My Devices
```http
GET /api/devices/my-devices
Authorization: Bearer <token>
```

#### Get All Devices (Admin)
```http
GET /api/devices/all
Authorization: Bearer <token>
```

#### Test Notification
```http
POST /api/devices/test-notification
Authorization: Bearer <token>
Content-Type: application/json

{
  "push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title": "Test Title",
  "body": "Test Body"
}
```

## Client Integration

### Login with Push Token

When logging in, you can include the push token:

```javascript
const response = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'your_username',
    password: 'your_password',
    push_token: 'ExponentPushToken[...]',
    device_id: 'unique-device-id',
    device_model: 'iPhone 13 Pro'
  })
});
```

### Register Push Token After Login

```javascript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Get push token
const token = (await Notifications.getExpoPushTokenAsync()).data;

// Register device
await fetch('http://localhost:5000/api/devices/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  },
  body: JSON.stringify({
    push_token: token,
    device_id: Device.deviceId,
    device_model: Device.modelName
  })
});
```

## Notification Triggers

### 1. Low Stock Alert
Triggered when a sale reduces inventory to or below the minimum stock level.

**Notification Format:**
- Title: `⚠️ Low Stock Alert`
- Body: `[Item Name] is running low! Only [X] left (minimum: [Y])`
- Data: `{ type: 'low_stock', item_id, item_name, current_quantity, minimum_stock }`

### 2. Sales Notification
Triggered after every successful sale.

**Notification Format:**
- Title: `📊 New Sale Recorded`
- Body: `Sale of [X] Ks completed. [Y] item(s) sold.`
- Data: `{ type: 'daily_sales', total_amount, items_count, sale_id }`

## Testing

### Method 1: Test Script

```bash
# Test with a specific push token
node scripts/test-notification.js ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
```

### Method 2: Test Endpoint

```bash
curl -X POST http://localhost:5000/api/devices/test-notification \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "push_token": "ExponentPushToken[...]",
    "title": "Test",
    "body": "This is a test"
  }'
```

### Method 3: Create a Sale

Create a sale through the API - you should receive a notification automatically.

## Troubleshooting

### No Notifications Received

1. **Check if devices are registered:**
   ```bash
   GET /api/devices/all
   ```

2. **Verify EXPO_ACCESS_TOKEN:**
   - Check `.env` file has `EXPO_ACCESS_TOKEN`
   - Verify the token is valid in Expo dashboard

3. **Check server logs:**
   - Look for messages like: `📱 Found X active device(s) for notifications`
   - Check for errors in notification sending

4. **Verify push token format:**
   - Must start with `ExponentPushToken[`
   - Use `Expo.isExpoPushToken()` to validate

5. **Check device permissions:**
   - Ensure the mobile app has notification permissions enabled
   - On iOS: Settings > Your App > Notifications
   - On Android: App Settings > Notifications

### Common Issues

**"DeviceNotRegistered" Error:**
- The push token is no longer valid
- User may have uninstalled/reinstalled the app
- The token will be automatically removed from the database

**"MessageTooBig" Error:**
- Notification payload exceeds 4KB limit
- Reduce the size of the `data` object

**"MessageRateExceeded" Error:**
- Too many notifications sent to the same device
- Implement rate limiting or batch notifications

## Best Practices

1. **Register push token on app launch** and when it changes
2. **Handle notification permissions** properly in the client app
3. **Test notifications** in development before deploying
4. **Monitor logs** for notification failures
5. **Clean up inactive tokens** periodically

## Additional Resources

- [Expo Push Notifications Documentation](https://docs.expo.dev/push-notifications/overview/)
- [expo-server-sdk on npm](https://www.npmjs.com/package/expo-server-sdk)
- [Expo Push Notification Tool](https://expo.dev/notifications) - Test notifications manually

# Migration Guide - Notification & Owner Management Updates

## Prerequisites
- Backup your database before running migrations
- Ensure all users are logged out during the migration
- Stop the server before updating

## Step-by-Step Migration

### 1. Update Server Code

```bash
cd hein-pharmacy-server

# Pull the latest changes
git pull origin master

# Install any new dependencies (if needed)
npm install
```

### 2. Run Database Migration

The new `app_settings` table needs to be created:

```bash
# Run the migration
npx sequelize-cli db:migrate
```

Or manually run the SQL:

```sql
-- Create app_settings table
CREATE TABLE app_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Insert default settings
INSERT INTO app_settings (setting_key, setting_value, description, created_at, updated_at)
VALUES 
  ('low_stock_notification_time', '09:00', 'Daily time to send low stock notifications (HH:MM format in local time)', NOW(), NOW()),
  ('low_stock_notification_enabled', 'true', 'Enable or disable daily low stock notifications', NOW(), NOW());
```

### 3. Update Client Code

```bash
cd ../hein-pharmacy-client

# Pull the latest changes
git pull origin master

# Install any new dependencies (if needed)
npm install
```

### 4. Test the Changes

#### Test Sales Notification Exclusion:
1. Login to the app on Device A
2. Create a new sale
3. Verify Device A does NOT receive a notification about that sale
4. If you have Device B logged in, verify it DOES receive the notification

#### Test Owner Management (Admin Only):
1. Login as admin
2. Go to Profile > Manage Owners
3. Test editing an owner:
   - Click "Edit" on any owner
   - Change name, email, or phone
   - Save changes
   - Verify changes are saved
4. Test password reset:
   - Click "Reset Password" on any owner
   - Enter new password (min 6 characters)
   - Save
   - Verify the owner can login with new password

#### Test Daily Low Stock Notifications:
Option 1 - Wait for scheduled time (9:00 AM):
- Wait until 9:00 AM the next day
- Check if low stock notifications are sent

Option 2 - Manually trigger (for testing):
```javascript
// In server code, you can manually call:
const cronService = require('./services/cronService');
await cronService.checkAndNotifyLowStock();
```

### 5. Restart Server

```bash
cd hein-pharmacy-server

# Start the server
npm start
```

The server should show:
```
✅ Cron jobs started: Daily low stock notification at 9:00 AM
```

## Rollback Plan

If you need to rollback the changes:

### 1. Revert Database Changes
```sql
-- Drop the app_settings table
DROP TABLE IF EXISTS app_settings;
```

### 2. Revert Code Changes
```bash
# In server directory
git reset --hard <previous-commit-hash>

# In client directory  
git reset --hard <previous-commit-hash>

# Restart server
npm start
```

## Configuration Options

### Change Low Stock Notification Time

Edit `hein-pharmacy-server/services/cronService.js`:

```javascript
// Change the cron schedule
// Current: '0 9 * * *' = 9:00 AM
// Example: '0 21 * * *' = 9:00 PM
// Example: '30 14 * * *' = 2:30 PM

const lowStockJob = cron.schedule('0 9 * * *', async () => {
  await this.checkAndNotifyLowStock();
}, {
  scheduled: true,
  timezone: "Asia/Yangon"
});
```

### Change Timezone

Edit the `timezone` option in cronService.js:
- "Asia/Yangon" - Myanmar
- "Asia/Bangkok" - Thailand
- "Asia/Singapore" - Singapore
- "UTC" - Coordinated Universal Time

## Troubleshooting

### Issue: Cron job not running
**Solution**: Check server logs for errors. Ensure `node-cron` is installed:
```bash
npm install node-cron
```

### Issue: Sales notifications still going to creator
**Solution**: 
1. Verify the client is sending `device_push_token` in the sale payload
2. Check server logs to see if the token is being received
3. Clear app cache and re-login

### Issue: Low stock notifications not sent
**Solution**:
1. Check if any items have `quantity <= minimum_stock`
2. Verify devices have `low_stock_alerts = true` in database
3. Check server timezone matches expected timezone
4. Manually trigger the job to test

### Issue: Admin can't edit owners
**Solution**:
1. Verify you're logged in as admin (username: 'admin')
2. Check that the API routes are properly configured
3. Check server logs for authentication errors

### Issue: Database migration fails
**Solution**:
1. Check if `app_settings` table already exists: `\dt app_settings`
2. If it exists, the migration has already run
3. Manually insert missing settings if needed

## Verification Checklist

After migration, verify:
- [ ] Server starts without errors
- [ ] Cron job initialization message appears in logs
- [ ] Sales can be created successfully
- [ ] Sales notifications work (excluding creator)
- [ ] Admin can edit owner details
- [ ] Admin can reset owner passwords
- [ ] Owner changes persist in database
- [ ] Low stock notification time is configurable

## Support

If you encounter any issues:
1. Check server logs: Look for error messages
2. Check database: Verify tables and data
3. Check client console: Look for API errors
4. Verify authentication: Ensure tokens are valid

## Database Verification

Check if migration was successful:

```sql
-- Check if app_settings table exists
SELECT * FROM app_settings;

-- Should return 2 rows:
-- 1. low_stock_notification_time | 09:00
-- 2. low_stock_notification_enabled | true

-- Check devices table (should already exist)
SELECT push_token, low_stock_alerts, sales_notifications FROM devices LIMIT 5;

-- Check owners table
SELECT id, username, full_name, email, phone FROM owners WHERE is_active = true;
```

## Performance Considerations

- The daily cron job queries all inventory items and devices
- For large databases (>10,000 items), consider adding indexes:

```sql
-- Add index on inventory items for low stock queries
CREATE INDEX idx_inventory_low_stock ON inventory_items(quantity, minimum_stock) WHERE is_active = true;

-- Add index on devices for notification queries  
CREATE INDEX idx_devices_notifications ON devices(is_active, low_stock_alerts, sales_notifications) WHERE is_active = true;
```

## Next Steps

After successful migration:
1. Monitor server logs for the first 24 hours
2. Collect user feedback on notification timing
3. Adjust cron schedule if needed
4. Consider adding admin UI for notification settings
5. Plan for additional notification features if needed

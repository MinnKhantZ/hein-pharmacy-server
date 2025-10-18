# Notification & Owner Management Updates

## Summary of Changes

This document outlines the changes made to the Hein Pharmacy system to improve notification handling and owner management capabilities.

---

## 1. Sales Notification - Exclude Creating Device

### Changes Made:
- **File**: `hein-pharmacy-server/controllers/salesController.js`
- Modified the `createSale` method to accept `device_push_token` in the request body
- Updated notification logic to filter out the device that created the sale from receiving sales notifications
- Only other devices with `sales_notifications` enabled will receive the notification

### Impact:
- The device recording a sale will no longer receive a notification about that sale
- Prevents redundant notifications to the user who just made the sale

---

## 2. Daily Low Stock Notifications (Scheduled)

### Changes Made:

#### Server-Side:
1. **Created New Service**: `hein-pharmacy-server/services/cronService.js`
   - Implements a cron job that runs daily at 9:00 AM (Asia/Yangon timezone)
   - Checks for all low stock items (quantity <= minimum_stock)
   - Sends notifications only to devices with `low_stock_alerts` enabled
   
2. **Updated Main Server**: `hein-pharmacy-server/index.js`
   - Integrated cron service to start when server starts
   - Properly stops cron jobs on graceful shutdown

3. **Removed Immediate Notifications**: `hein-pharmacy-server/controllers/salesController.js`
   - Removed the immediate low stock check after each sale
   - Low stock alerts are now only sent through the daily scheduled job

4. **Database Migration**: `hein-pharmacy-server/db/migrations/20240102000001-create-app-settings.js`
   - Created `app_settings` table for configurable settings
   - Added default settings:
     - `low_stock_notification_time`: "09:00" (configurable time for daily notifications)
     - `low_stock_notification_enabled`: "true" (enable/disable feature)

### Impact:
- Low stock notifications are now sent once per day at 9:00 AM instead of after each sale
- Reduces notification spam when multiple sales occur
- Configurable notification time through database settings
- More predictable notification schedule for users

---

## 3. Admin Password Change & Owner Management

### Changes Made:

#### Server-Side:
1. **New Controller Methods**: `hein-pharmacy-server/controllers/authController.js`
   
   a. `updateOwner(req, res)`:
      - Allows admin to update owner details (full_name, email, phone)
      - Username cannot be changed
      - Admin account cannot be modified
      - Only accessible to admin users
   
   b. `resetOwnerPassword(req, res)`:
      - Allows admin to reset any owner's password without knowing the current password
      - Requires minimum 6 character password
      - Admin account password cannot be reset through this endpoint
      - Only accessible to admin users

2. **Updated Routes**: `hein-pharmacy-server/routes/auth.js`
   - Added `PUT /api/auth/owners/:id` - Update owner details
   - Added `PUT /api/auth/owners/:id/reset-password` - Reset owner password

#### Client-Side:
1. **Updated API Service**: `hein-pharmacy-client/services/api.js`
   - Added `updateOwner(id, ownerData)` method
   - Added `resetOwnerPassword(id, passwordData)` method

2. **Enhanced Owner Management Screen**: `hein-pharmacy-client/app/owner-management.tsx`
   
   a. New State Management:
      - `showEditModal` - Controls edit owner modal visibility
      - `showPasswordModal` - Controls password reset modal visibility
      - `selectedOwner` - Tracks currently selected owner
      - `editOwnerForm` - Stores edit form data
      - `newPassword` - Stores new password for reset
   
   b. New Handler Functions:
      - `handleEditOwner(owner)` - Opens edit modal with owner data
      - `handleSubmitEdit()` - Submits owner updates to server
      - `handleResetPassword(owner)` - Opens password reset modal
      - `handleSubmitPasswordReset()` - Submits new password to server
   
   c. Updated UI:
      - Added "Edit" button to each owner card (blue)
      - Added "Reset Password" button to each owner card (orange)
      - Existing "Delete" button (red)
      - All three buttons displayed horizontally
   
   d. New Modals:
      - **Edit Owner Modal**: Update full_name, email, phone (username is read-only)
      - **Reset Password Modal**: Set new password for selected owner
   
   e. New Styles:
      - `ownerActions` - Container for action buttons
      - `editButton` & `editButtonText` - Edit button styles (blue)
      - `passwordButton` & `passwordButtonText` - Password reset button styles (orange)
      - `readOnlyText` - Style for non-editable fields
      - `helperText` - Style for helper/instruction text

3. **Updated Translations**: `hein-pharmacy-client/i18n.js`
   - "Edit Owner"
   - "Update owner account details."
   - "Save Changes"
   - "Owner updated successfully"
   - "Failed to update owner"
   - "Reset Password"
   - "Reset password for"
   - "Password reset successfully"
   - "Failed to reset password"

### Impact:
- Admin can now easily edit owner information without recreating accounts
- Admin can reset forgotten passwords without security questions
- Improved user management workflow
- Better administrative control over user accounts

---

## 4. Client Sales - Send Device Token

### Changes Made:
- **File**: `hein-pharmacy-client/app/(tabs)/sales.tsx`
- Added `useNotifications` hook import
- Extract `expoPushToken` from notification context
- Include `device_push_token` in sale creation payload

### Impact:
- Server can identify and exclude the creating device from sales notifications
- Seamless integration with notification exclusion feature

---

## Database Schema Updates

### New Table: `app_settings`
```sql
CREATE TABLE app_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Initial Data:**
- `low_stock_notification_time`: "09:00"
- `low_stock_notification_enabled`: "true"

---

## Testing Checklist

### Sales Notification Exclusion:
- [ ] Create a sale from Device A
- [ ] Verify Device A does NOT receive a notification
- [ ] Verify Device B (if exists) DOES receive the notification

### Daily Low Stock Notifications:
- [ ] Wait for 9:00 AM or manually trigger the cron job
- [ ] Verify low stock items are detected correctly
- [ ] Verify notifications sent only to devices with `low_stock_alerts` enabled
- [ ] Verify no notifications sent after individual sales

### Owner Management:
- [ ] Login as admin
- [ ] Navigate to Owner Management
- [ ] Test editing an owner's details (name, email, phone)
- [ ] Test resetting an owner's password
- [ ] Verify changes are saved correctly
- [ ] Test that non-admin users cannot access these features

---

## Configuration

### Cron Schedule Configuration
To change the low stock notification time, modify the cron schedule in:
`hein-pharmacy-server/services/cronService.js`

Current: `'0 9 * * *'` (9:00 AM daily)

Cron format: `minute hour day month day-of-week`
- Example: `'0 21 * * *'` = 9:00 PM daily
- Example: `'30 8 * * *'` = 8:30 AM daily

### Timezone
Current timezone: "Asia/Yangon" (Myanmar)

To change, modify the timezone option in cronService.js

---

## API Endpoints

### New Endpoints:
- `PUT /api/auth/owners/:id` - Update owner details (Admin only)
- `PUT /api/auth/owners/:id/reset-password` - Reset owner password (Admin only)

### Modified Endpoints:
- `POST /api/sales` - Now accepts optional `device_push_token` field

---

## Dependencies

No new dependencies were added. The project uses existing dependencies:
- `node-cron` - For scheduled tasks
- `expo-notifications` - For client-side notifications
- Existing React Native and Express dependencies

---

## Future Enhancements

Potential improvements for future iterations:
1. Admin UI to configure notification time through settings page
2. Multiple notification times per day (e.g., morning and evening checks)
3. Notification history/logs
4. Bulk owner management operations
5. Owner role/permission management
6. Email notifications in addition to push notifications
7. Customizable notification messages
8. Weekly/monthly low stock reports

---

## Notes

- The cron job runs on server time, ensure server timezone is set correctly
- Low stock threshold is determined by the `minimum_stock` field in inventory items
- Admin account (username: 'admin') cannot be edited or deleted for security
- All password changes require minimum 6 characters
- Device tokens are automatically managed by the notification context

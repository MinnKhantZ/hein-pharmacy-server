# Quick Fix: Run This Migration Now

## The Problem
You're getting this error when creating a sale:
```
Error: invalid input value for enum enum_sales_payment_method: "mobile"
```

## The Solution
The database enum needs to be updated. I've created a migration that will fix this.

## Run These Commands (Copy & Paste)

Open PowerShell in the server directory and run:

```powershell
# Navigate to server directory
cd "c:\Users\Min\Documents\Hein Pharmacy\hein-pharmacy-server"

# Run the migration
npm run db:migrate
```

That's it! The migration will:
- ✅ Update the database enum from `['cash', 'mobile_wallet']` to `['cash', 'mobile']`
- ✅ Convert any existing 'mobile_wallet' sales to 'mobile'
- ✅ Allow your app to create sales with 'mobile' payment method

## After Running Migration

1. **Restart your server** (if it's running):
   ```powershell
   # Stop the server (Ctrl+C)
   # Then start again
   npm start
   # Or if using dev mode:
   npm run dev
   ```

2. **Test creating a sale** - it should now work!

## If Migration Command Doesn't Work

Run the SQL directly in your database:

```sql
BEGIN;

CREATE TYPE enum_sales_payment_method_new AS ENUM ('cash', 'mobile');

UPDATE sales SET payment_method = 'mobile' WHERE payment_method = 'mobile_wallet';

ALTER TABLE sales 
ALTER COLUMN payment_method 
TYPE enum_sales_payment_method_new 
USING payment_method::text::enum_sales_payment_method_new;

DROP TYPE enum_sales_payment_method;

ALTER TYPE enum_sales_payment_method_new 
RENAME TO enum_sales_payment_method;

COMMIT;
```

## Files Changed

1. ✅ Created: `db/migrations/20251015000001-update-payment-method-enum.js`
2. ✅ Updated: `models/sale.js` (enum values)
3. ✅ Already updated: `middleware/validation.js` (validation rules)
4. ✅ Already updated: Client payment options

## Need Help?

See the detailed guide: `docs/MIGRATION_PAYMENT_METHOD.md`

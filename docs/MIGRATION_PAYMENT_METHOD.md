# Database Migration Guide: Payment Method Enum Update

## Issue
The application code was updated to use `'mobile'` as a payment method value, but the database enum still has `'mobile_wallet'`. This causes the error:
```
Error: invalid input value for enum enum_sales_payment_method: "mobile"
```

## Solution
Run the migration to update the database enum from `['cash', 'mobile_wallet']` to `['cash', 'mobile']`.

## Migration Details

**File**: `db/migrations/20251015000001-update-payment-method-enum.js`

**What it does**:
1. Creates a new enum type with values: `'cash'`, `'mobile'`
2. Updates existing `'mobile_wallet'` records to `'cash'` (for data consistency)
3. Alters the `payment_method` column to use the new enum
4. Removes the old enum type
5. Renames the new enum to the original name

**Data Impact**:
- Any existing sales with `payment_method = 'mobile_wallet'` will be changed to `'cash'`
- This is a one-way conversion in the up migration
- The down migration can restore the old enum structure

## Steps to Run Migration

### Option 1: Using Sequelize CLI (Recommended)

```powershell
# Navigate to the server directory
cd "c:\Users\Min\Documents\Hein Pharmacy\hein-pharmacy-server"

# Check current migration status
npm run db:status

# Run the migration
npm run db:migrate

# Verify it ran successfully
npm run db:status
```

### Option 2: Using Direct SQL (If Sequelize CLI fails)

If the Sequelize CLI has issues, you can run the SQL directly in PostgreSQL:

```sql
-- Start a transaction for safety
BEGIN;

-- Create new enum type
CREATE TYPE enum_sales_payment_method_new AS ENUM ('cash', 'mobile');

-- Update existing mobile_wallet values to cash
UPDATE sales SET payment_method = 'cash' WHERE payment_method = 'mobile_wallet';

-- Alter column to use new enum
ALTER TABLE sales 
ALTER COLUMN payment_method 
TYPE enum_sales_payment_method_new 
USING payment_method::text::enum_sales_payment_method_new;

-- Drop old enum
DROP TYPE enum_sales_payment_method;

-- Rename new enum to original name
ALTER TYPE enum_sales_payment_method_new 
RENAME TO enum_sales_payment_method;

-- Commit the transaction
COMMIT;
```

### Option 3: Connect to PostgreSQL and Run

```powershell
# If you have psql installed, connect to your database
psql -h [DB_HOST] -U [DB_USER] -d [DB_NAME] -p [DB_PORT]

# Then paste the SQL from Option 2
```

## Verification

After running the migration, verify it worked:

### Check Database
```sql
-- Check the enum values
SELECT enumlabel 
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'enum_sales_payment_method';

-- Should show:
-- cash
-- mobile
```

### Check Existing Data
```sql
-- Check payment methods in use
SELECT payment_method, COUNT(*) 
FROM sales 
GROUP BY payment_method;

-- Should only show 'cash' and 'mobile'
```

### Test the Application
Try creating a new sale with payment method "mobile":
```javascript
// Should now work without error
POST /api/sales
{
  "items": [...],
  "payment_method": "mobile",
  ...
}
```

## Rollback (If Needed)

If something goes wrong and you need to rollback:

```powershell
# Undo the last migration
npm run db:migrate:undo
```

Or manually:
```sql
BEGIN;

CREATE TYPE enum_sales_payment_method_new AS ENUM ('cash', 'mobile_wallet');

UPDATE sales SET payment_method = 'mobile_wallet' WHERE payment_method = 'mobile';

ALTER TABLE sales 
ALTER COLUMN payment_method 
TYPE enum_sales_payment_method_new 
USING payment_method::text::enum_sales_payment_method_new;

DROP TYPE enum_sales_payment_method;

ALTER TYPE enum_sales_payment_method_new 
RENAME TO enum_sales_payment_method;

COMMIT;
```

## Files Updated

### 1. Migration File (NEW)
- `db/migrations/20251015000001-update-payment-method-enum.js`
- Contains both up and down migrations

### 2. Model File (UPDATED)
- `models/sale.js`
- Changed: `DataTypes.ENUM('cash', 'mobile_wallet')` → `DataTypes.ENUM('cash', 'mobile')`

### 3. Validation File (ALREADY UPDATED)
- `middleware/validation.js`
- Changed: `Joi.string().valid('cash', 'card', 'mobile', 'credit')` → `Joi.string().valid('cash', 'mobile')`

### 4. Client Files (ALREADY UPDATED)
- `hein-pharmacy-client/app/(tabs)/sales.tsx`
- Payment options already updated to show only Cash and Mobile

## Important Notes

⚠️ **Backup First**: Before running any migration, ensure you have a backup of your database.

⚠️ **Existing Data**: Any sales with `'mobile_wallet'` will be converted to `'cash'` during migration. If you want to preserve these as 'mobile' instead, update the migration file:

```javascript
// Change this line in the migration:
await queryInterface.sequelize.query(
  `UPDATE sales SET payment_method = 'mobile' WHERE payment_method = 'mobile_wallet';`,
  { transaction }
);
```

⚠️ **Production**: If running in production:
1. Schedule during low-traffic period
2. Test in staging first
3. Have rollback plan ready
4. Monitor application logs after deployment

## Troubleshooting

### Error: "relation does not exist"
- Check database connection in `.env` file
- Ensure database exists and is accessible

### Error: "type already exists"
- Migration may have partially run
- Check enum types: `SELECT typname FROM pg_type WHERE typname LIKE '%payment%';`
- Clean up manually if needed

### Error: "cannot cast"
- Some existing data may not be compatible
- Review data: `SELECT DISTINCT payment_method FROM sales;`
- Update problematic records manually first

## After Migration

1. ✅ Restart the server application
2. ✅ Test creating new sales with 'cash' payment method
3. ✅ Test creating new sales with 'mobile' payment method
4. ✅ Verify old sales display correctly
5. ✅ Check that filters work in the UI

## Support

If you encounter issues:
1. Check the migration status: `npm run db:status`
2. Review database logs
3. Check application logs
4. Verify enum values in database (queries above)
5. Ensure all files are saved and server is restarted

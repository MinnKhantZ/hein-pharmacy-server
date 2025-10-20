# Database Migration Guide

This project has been migrated to use Sequelize CLI for database migrations management, following the same pattern as the easy2success-server project.

## Directory Structure

```
hein-pharmacy-server/
├── .sequelizerc                 # Sequelize CLI configuration
├── config/
│   ├── config.js               # Sequelize database configuration
│   └── database.js             # Direct database connection
├── db/
│   ├── migrations/             # Database migration files ✅ ONLY LOCATION
│   └── seeders/                # Database seeder files
└── models/                     # Sequelize models
```

## Available Scripts

### Migration Scripts
- `npm run db:status` - Check migration status
- `npm run db:migrate` - Run all pending migrations
- `npm run db:migrate:undo` - Undo last migration
- `npm run db:migrate:undo:all` - Undo all migrations
- `npm run db:migration:generate -- migration-name` - Generate a new migration file

### Seeder Scripts
- `npm run db:seed:all` - Run all seeders
- `npm run db:seed -- --seed seeder-name` - Run a specific seeder
- `npm run db:seed:undo` - Undo last seeder
- `npm run db:seed:undo:all` - Undo all seeders
- `npm run db:seed:generate -- seeder-name` - Generate a new seeder file

## Migration Files

The following migration files have been created:

1. **20240101000001-create-owners.js** - Creates the owners table
2. **20240101000002-create-inventory-items.js** - Creates inventory_items table
3. **20240101000003-create-sales.js** - Creates sales table
4. **20240101000004-create-sale-items.js** - Creates sale_items table
5. **20240101000005-create-income-summary.js** - Creates income_summary table
6. **20240101000006-create-devices.js** - Creates devices table

## Seeder Files

- **20240101000001-demo-data.js** - Seeds initial owner and inventory item data

## Setup Instructions

### First-Time Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Make sure your `.env` file has the following variables:
   ```
   DB_HOST=your-database-host
   DB_PORT=5432
   DB_NAME=your-database-name
   DB_USER=your-database-user
   DB_PASSWORD=your-database-password
   ```

3. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

4. **Seed database (optional):**
   ```bash
   npm run db:seed:all
   ```

### For Existing Databases

If you already have tables created with the old migration system (`npm run migrate`), you have two options:

#### Option 1: Start Fresh (Recommended for Development)
1. Backup your data if needed
2. Drop all existing tables
3. Run the new migrations: `npm run db:migrate`
4. Seed data: `npm run db:seed:all`

#### Option 2: Skip Migrations (For Production)
If your tables already exist and match the schema:
1. Run migrations to create the SequelizeMeta table: `npm run db:migrate`
2. The migrations will check for existing tables and skip if they exist

## Creating New Migrations

To create a new migration:

```bash
npm run db:migration:generate -- add-new-field-to-owners
```

This will create a new migration file in `db/migrations/` with a timestamp prefix.

Example migration structure:

```javascript
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('owners', 'new_field', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('owners', 'new_field');
  },
};
```

## Creating New Seeders

To create a new seeder:

```bash
npm run db:seed:generate -- demo-sales
```

This will create a new seeder file in `db/seeders/` with a timestamp prefix.

Example seeder structure:

```javascript
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('sales', [
      {
        sale_date: new Date(),
        total_amount: 10000,
        payment_method: 'cash',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('sales', null, {});
  },
};
```

## Migration vs Model Sync

### Old Way (Deprecated)
```javascript
await sequelize.sync({ alter: true });
```

### New Way (Recommended)
```bash
npm run db:migrate
```

**Why use migrations?**
- Version control for database schema
- Rollback capability
- Team collaboration
- Production-safe updates
- Clear audit trail of schema changes

## Troubleshooting

### Issue: "SequelizeMeta table doesn't exist"
**Solution:** This is normal for first-time setup. Run `npm run db:migrate` to create it.

### Issue: "Relation already exists"
**Solution:** Your table already exists. Either:
- Drop the existing table and re-run migrations, or
- Manually insert a record into SequelizeMeta to mark the migration as complete

### Issue: Migration failed
**Solution:** 
1. Check your database connection
2. Review the migration file for errors
3. Run `npm run db:migrate:undo` to rollback
4. Fix the issue and run `npm run db:migrate` again

## Best Practices

1. **Never modify executed migrations** - Create a new migration instead
2. **Always test migrations** - Test in development before production
3. **Write reversible migrations** - Always implement the `down` method
4. **Keep migrations atomic** - One logical change per migration
5. **Document complex migrations** - Add comments for clarity
6. **Backup before migrating** - Especially in production

## Important: Single Migration System ⚠️

**Migration Cleanup Complete:**
- ✅ Only `db/migrations/` is used for all database changes
- ❌ Old `migrations/` folder has been removed
- ❌ `migrations/migrate.js` script is no longer available
- ❌ `npm run migrate` script has been removed

**All migrations go in:** `db/migrations/`

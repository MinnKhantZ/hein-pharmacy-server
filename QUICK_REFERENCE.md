# Quick Reference - Database Commands

## Most Common Commands

### Check Migration Status
```bash
npm run db:status
```

### Run Migrations
```bash
npm run db:migrate
```

### Rollback Last Migration
```bash
npm run db:migrate:undo
```

### Seed Database with Demo Data
```bash
npm run db:seed:all
```

### Create New Migration
```bash
npm run db:migration:generate -- your-migration-name
```

## Complete Command List

| Command | Description |
|---------|-------------|
| `npm run db:status` | Check which migrations have been applied |
| `npm run db:migrate` | Run all pending migrations |
| `npm run db:migrate:undo` | Revert the last migration |
| `npm run db:migrate:undo:all` | Revert all migrations |
| `npm run db:migration:generate -- name` | Create a new migration file |
| `npm run db:seed:all` | Run all seeder files |
| `npm run db:seed -- --seed file-name` | Run a specific seeder |
| `npm run db:seed:undo` | Undo the last seeder |
| `npm run db:seed:undo:all` | Undo all seeders |
| `npm run db:seed:generate -- name` | Create a new seeder file |

## Common Workflows

### Initial Setup (Fresh Database)
```bash
npm install
npm run db:migrate
npm run db:seed:all
```

### Development Workflow
```bash
# Create migration
npm run db:migration:generate -- add-column-to-table

# Edit the generated file in db/migrations/

# Run migration
npm run db:migrate

# If something goes wrong, rollback
npm run db:migrate:undo
```

### Adding New Table
```bash
# Generate migration
npm run db:migration:generate -- create-new-table

# Edit db/migrations/[timestamp]-create-new-table.js
# Add table creation code in up() method
# Add table drop code in down() method

# Run migration
npm run db:migrate
```

### Adding New Column
```bash
# Generate migration
npm run db:migration:generate -- add-field-to-owners

# Edit the migration file:
# up: queryInterface.addColumn(...)
# down: queryInterface.removeColumn(...)

# Run migration
npm run db:migrate
```

## Files and Directories

```
hein-pharmacy-server/
├── .sequelizerc              ← Sequelize CLI config
├── config/
│   └── config.js            ← Database configuration
├── db/
│   ├── migrations/          ← Migration files
│   └── seeders/             ← Seeder files
└── models/                  ← Sequelize models
```

## Environment Variables Required

Make sure these are set in your `.env` file:

```env
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-database-user
DB_PASSWORD=your-database-password
```

## Tips

💡 **Always check status first**: `npm run db:status`
💡 **Test in development first**: Never test migrations in production
💡 **Backup before migrating**: Especially important in production
💡 **Never modify executed migrations**: Create a new one instead
💡 **Write reversible migrations**: Always implement the down() method

## Getting Help

- 📖 Read MIGRATION_GUIDE.md for detailed information
- 📝 Read MIGRATION_SETUP_SUMMARY.md for overview
- 🌐 Sequelize Docs: https://sequelize.org/docs/v6/other-topics/migrations/

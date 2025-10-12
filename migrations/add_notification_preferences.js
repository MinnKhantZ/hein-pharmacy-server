/**
 * Migration: Add notification preferences to devices table
 * Run: node migrations/add_notification_preferences.js
 */

const pool = require('../config/database');

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add notification preference columns to devices table
    await client.query(`
      ALTER TABLE devices 
      ADD COLUMN IF NOT EXISTS low_stock_alerts BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS sales_notifications BOOLEAN DEFAULT true
    `);

    console.log('✅ Notification preference columns added successfully');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error adding notification preferences:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      ALTER TABLE devices 
      DROP COLUMN IF EXISTS low_stock_alerts,
      DROP COLUMN IF EXISTS sales_notifications
    `);
    
    await client.query('COMMIT');
    console.log('✅ Notification preference columns removed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error removing notification preferences:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  up()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { up, down };

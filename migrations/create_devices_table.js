/**
 * Migration: Create devices table for storing push notification tokens
 * Run: node migrations/create_devices_table.js
 */

const pool = require('../config/database');

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create devices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
        push_token VARCHAR(255) NOT NULL UNIQUE,
        device_id VARCHAR(255),
        device_model VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index on owner_id for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_devices_owner_id ON devices(owner_id)
    `);

    // Create index on push_token for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_devices_push_token ON devices(push_token)
    `);

    await client.query('COMMIT');
    console.log('✅ Devices table created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating devices table:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query('DROP TABLE IF EXISTS devices CASCADE');
    
    await client.query('COMMIT');
    console.log('✅ Devices table dropped successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error dropping devices table:', error);
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

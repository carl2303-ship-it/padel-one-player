const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.rqiwnxcexsccguruiteq:PadelOne2025!@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const client = await pool.connect();
    
    // 1. Add is_private column
    await client.query('ALTER TABLE open_games ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;');
    console.log('1. Column is_private added successfully!');
    
    // 2. Read the migration SQL for the updated RPC function
    const fs = require('fs');
    const migrationSQL = fs.readFileSync('C:\\padelone\\padel-one-tour\\supabase\\migrations\\20260224000000_add_is_private_to_open_games.sql', 'utf8');
    
    // Extract only the CREATE OR REPLACE FUNCTION part
    const funcStart = migrationSQL.indexOf('CREATE OR REPLACE FUNCTION add_player_to_open_game');
    if (funcStart >= 0) {
      const funcSQL = migrationSQL.substring(funcStart);
      await client.query(funcSQL);
      console.log('2. RPC function updated successfully!');
    }
    
    // Verify
    const { rows } = await client.query("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'open_games' AND column_name = 'is_private'");
    console.log('3. Verification:', rows);
    
    client.release();
  } catch (e) {
    console.error('Error:', e.message);
  }
  await pool.end();
})();

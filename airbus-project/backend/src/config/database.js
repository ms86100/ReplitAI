const { Pool } = require('pg');
const { getUserId } = require('../utils/requestContext');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'project_management',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  // Use connection string if provided (for production)
  ...(process.env.DATABASE_URL && { connectionString: process.env.DATABASE_URL }),
  // Connection pool settings
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

console.log('🔗 Connecting to database:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user
});

const pool = new Pool(dbConfig);

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to execute queries
const query = async (text, params) => {
  const start = Date.now();
  const userId = getUserId();
  const client = await pool.connect();
  try {
    if (userId) {
      try {
        await client.query('select set_current_user_id($1)', [userId]);
      } catch (e) {
        console.warn('set_current_user_id not available, continuing without auth.uid context');
      }
    }
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Query executed', { text: text.substring(0, 100), duration, rows: res.rowCount, ctxUser: !!userId });
    return res;
  } catch (error) {
    console.error('❌ Query error', { text: text.substring(0, 100), error: error.message });
    throw error;
  } finally {
    client.release();
  }
};

// Helper function to get a client from the pool
const getClient = async () => {
  return await pool.connect();
};

module.exports = {
  query,
  getClient,
  pool
};
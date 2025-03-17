// Database configuration for PostgreSQL
const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Nécessaire pour les connexions SSL à Supabase
});

// Test the connection
pool.connect()
  .then(client => {
    logger.info('PostgreSQL connection established');
    client.release();
  })
  .catch(err => {
    logger.error('PostgreSQL connection error:', err);
  });

module.exports = { pool };
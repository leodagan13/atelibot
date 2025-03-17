// database/supabase.js
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Get Supabase URL and key from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
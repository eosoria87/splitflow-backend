const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Validate environment variables
const validateEnv = () => {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Create Supabase client (Singleton pattern)
const createSupabaseClient = () => {
  validateEnv();
  
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: false, // Server-side doesn't need session persistence
      }
    }
  );
};

// Export singleton instance
const supabase = createSupabaseClient();

module.exports = supabase;
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ghwvwtwktnveqdqivxmy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = !!supabaseAnonKey && supabaseAnonKey.startsWith('eyJ');

// Direct PostgreSQL Connection Details (for Edge Functions / Webhooks)
export const dbConfig = {
  host: 'aws-0-ap-southeast-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.ghwvwtwktnveqdqivxmy',
  projectRef: 'ghwvwtwktnveqdqivxmy'
};

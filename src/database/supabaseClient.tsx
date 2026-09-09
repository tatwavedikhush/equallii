import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pdsxpdvmysvtpkemghum.supabase.co/';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkc3hwZHZteXN2dHBrZW1naHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5ODQ2NTAsImV4cCI6MjEwMjU2MDY1MH0.1NvDXWzK0uEUlBTOAzdq34n1qQFldBDWWBTIXj6_hEg';

export const supabase = createClient(supabaseUrl, supabaseKey);
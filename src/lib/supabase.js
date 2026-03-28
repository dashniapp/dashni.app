import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://cpthnynbdrkesxfdlmdv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwdGhueW5iZHJrZXN4ZmRsbWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTI1MTgsImV4cCI6MjA4OTg2ODUxOH0.Qz7HCdeJ87ypr29G-qQzZkB2ZGqftY4GcY3kU6l0Az4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

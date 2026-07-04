import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdjartbuhxrkbwunqatc.supabase.co';
const supabaseAnonKey = 'sb_publishable_RA40gdUUf8ONNUZZtJY8MA_r2lnEvW3';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
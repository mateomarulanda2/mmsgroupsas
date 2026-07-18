import { createClient } from "@supabase/supabase-js";

// The anon key is safe to expose in frontend code — it's the public key
// meant to be embedded in browser bundles. Access to your data is controlled
// by the Row Level Security policies set up in sql/schema.sql, not by
// keeping this key secret.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://hppmocjsivwfakrpfacs.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwcG1vY2pzaXZ3ZmFrcnBmYWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODczMDgsImV4cCI6MjA5OTk2MzMwOH0.HrY2cqPci-f1IP9AT0wA0AgoMHjQz2RcLsb33iNPidE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

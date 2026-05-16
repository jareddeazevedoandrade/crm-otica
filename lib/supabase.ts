import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://dmgmkmfopsyugdoseqnh.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtZ21rbWZvcHN5dWdkb3NlcW5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjIxNjgsImV4cCI6MjA5NDQzODE2OH0.CiB7oqb465jpI5-5s3cs2PeUCECSycNA24cwHcht30A"
);
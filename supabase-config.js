// Public publishable key is safe for browser use. Database access is protected by RLS.
window.supabaseClient = window.supabase?.createClient
  ? window.supabase.createClient(
      "https://bjevhwwnlffipeafwgwg.supabase.co",
      "sb_publishable_H7zxwa49Fnfy6CV1KwmLow_mO7u2bhK"
    )
  : null;

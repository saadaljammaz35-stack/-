// Third-party dependencies, pinned in one place. Edge Functions resolve npm:
// specifiers at deploy time; exact versions keep every deploy reproducible.
export { z } from "npm:zod@4.6.5";
export { createClient } from "npm:@supabase/supabase-js@2.117.1";
export type { SupabaseClient, User } from "npm:@supabase/supabase-js@2.117.1";
export { default as Anthropic } from "npm:@anthropic-ai/sdk@0.128.0";

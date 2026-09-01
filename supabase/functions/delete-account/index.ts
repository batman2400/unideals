import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function removeStoragePrefix(bucket: string, prefix: string) {
  const { data, error } = await admin.storage.from(bucket).list(prefix, {
    limit: 1000,
  });
  if (error) {
    console.error(`storage list ${bucket}/${prefix}:`, error);
    return;
  }
  if (!data?.length) return;

  const files: string[] = [];
  for (const item of data) {
    const path = `${prefix}/${item.name}`;
    if (!item.id) {
      await removeStoragePrefix(bucket, path);
    } else {
      files.push(path);
    }
  }
  if (files.length) {
    const { error: removeError } = await admin.storage.from(bucket).remove(files);
    if (removeError) {
      console.error(`storage remove ${bucket}:`, removeError);
    }
  }
}

async function deleteOwnedRows(table: string, column: string, userId: string) {
  const { error } = await admin.from(table).delete().eq(column, userId);
  if (error) {
    console.error(`delete ${table}:`, error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return json({ success: false, error: "Not authenticated" }, 401);
    }

    // Resolve the caller from their own JWT. Never take a user id from the body.
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      console.error("delete-account getUser:", userError?.message);
      return json({ success: false, error: "Not authenticated" }, 401);
    }

    const userId = userData.user.id;

    await removeStoragePrefix("verification-documents", userId);
    await removeStoragePrefix("avatars", userId);

    // Events reference auth.users without ON DELETE, so null them first.
    const { error: eventsError } = await admin
      .from("events")
      .update({ organizer_id: null })
      .eq("organizer_id", userId);
    if (eventsError) {
      console.error("clear events organizer:", eventsError);
    }

    await deleteOwnedRows("student_redemption_tickets", "student_id", userId);
    await deleteOwnedRows("push_tokens", "user_id", userId);
    await deleteOwnedRows("saved_deals", "user_id", userId);
    await deleteOwnedRows("manual_verifications", "user_id", userId);
    await deleteOwnedRows("verification_otps", "user_id", userId);
    await deleteOwnedRows("user_roles", "user_id", userId);

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("auth.admin.deleteUser failed:", deleteError);
      return json(
        { success: false, error: "Could not delete your account right now." },
        500,
      );
    }

    return json({ success: true });
  } catch (error) {
    console.error("delete-account failed:", error);
    return json({ success: false, error: "An unexpected error occurred." }, 500);
  }
});

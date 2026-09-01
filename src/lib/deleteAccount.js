import { supabase } from "./supabaseClient";

async function messageFromFunctionError(error) {
  const context = error?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (body?.error) return String(body.error);
    } catch {
      /* ignore unreadable function payloads */
    }
  }
  return null;
}

/**
 * Deletes the signed-in caller's Auth user via the delete-account
 * Edge Function. The function never accepts a target user id.
 */
export async function deleteOwnAccount() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (sessionError || !accessToken) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase.functions.invoke("delete-account", {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {},
  });

  if (error) {
    const fromBody = await messageFromFunctionError(error);
    throw new Error(
      fromBody || "Could not delete your account. Please try again.",
    );
  }

  if (data?.success === false) {
    throw new Error(
      data.error || "Could not delete your account. Please try again.",
    );
  }
}

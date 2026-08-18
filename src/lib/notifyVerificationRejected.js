import { supabase } from "./supabaseClient";

export async function notifyVerificationRejected(requestId) {
  const { error } = await supabase.functions.invoke("send-verification-rejected", {
    body: { request_id: requestId },
  });
  if (error) {
    console.error("Could not send verification reject email:", error);
  }
}

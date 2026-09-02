import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import {
  MAIL_FOOTER,
  REPLY_TO,
  TRANSACTIONAL_FROM,
} from "../_shared/mail.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return json({ success: false, error: "Not authenticated" }, 401);
    }

    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      console.error("send-verification-rejected getUser:", userError?.message);
      return json({ success: false, error: "Not authenticated" }, 401);
    }

    const { data: roleRow, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (roleError) {
      console.error("Role check failed:", roleError);
      return json({ success: false, error: "Could not authorize this request." }, 500);
    }

    if (roleRow?.role !== "admin") {
      return json({ success: false, error: "Unauthorized. Admin access required." }, 403);
    }

    const body = await req.json();
    const requestId = String(body?.request_id ?? "").trim();
    if (!requestId) {
      return json({ success: false, error: "Missing request id." }, 400);
    }

    const { data: row, error: rowError } = await admin
      .from("manual_verifications")
      .select("id, user_id, reject_reason, status")
      .eq("id", requestId)
      .maybeSingle();

    if (rowError) {
      console.error("Failed to load verification:", rowError);
      return json({ success: false, error: "Could not load that request." }, 500);
    }

    if (!row || row.status !== "rejected") {
      return json({ success: false, error: "Rejected request not found." }, 404);
    }

    const { data: student, error: studentError } = await admin.auth.admin
      .getUserById(row.user_id);

    if (studentError || !student?.user?.email) {
      console.error("Failed to load student account:", studentError);
      return json({ success: false, error: "Could not email the student." }, 500);
    }

    const reason = String(row.reject_reason ?? "Your verification was not approved.").trim();
    const studentName = student.user.user_metadata?.full_name || "there";

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: TRANSACTIONAL_FROM,
        reply_to: REPLY_TO,
        to: [student.user.email],
        subject: "Your Uni Deals verification was not approved",
        html: `<div style="font-family: sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
                 <h2 style="color: #0f172a; margin-top: 0;">Hi ${escapeHtml(String(studentName))},</h2>
                 <p style="color: #475569; line-height: 1.5;">We reviewed your student verification request and could not approve it this time.</p>
                 <p style="color: #0f172a; line-height: 1.5;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
                 <p style="color: #475569; line-height: 1.5;">Open Profile in the Uni Deals app or website, then submit a new request with a clear photo of the front and back of your student ID.</p>
                 <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">Best regards,<br/><strong>The Uni Deals Team</strong></p>
                 ${MAIL_FOOTER}
               </div>`,
      }),
    });

    if (!emailRes.ok) {
      console.error("Resend rejected the message:", await emailRes.text());
      return json({ success: false, error: "Could not send the email." }, 502);
    }

    return json({ success: true });
  } catch (error) {
    console.error("send-verification-rejected failed:", error);
    return json({ success: false, error: "An unexpected error occurred." }, 500);
  }
});

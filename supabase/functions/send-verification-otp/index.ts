import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import {
  MAIL_FOOTER,
  REPLY_TO,
  TRANSACTIONAL_FROM,
} from "../_shared/mail.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

/** Must match the Postgres side: sha256(otp || user_id) as lowercase hex. */
async function hashOtp(otp: string, userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(otp + userId);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOtp(): string {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return String(value % 1_000_000).padStart(6, "0");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ success: false, error: "Not authenticated" }, 401);
    }

    // Resolve the caller from their own JWT so the OTP can never be
    // requested on behalf of somebody else.
    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData?.user) {
      return json({ success: false, error: "Not authenticated" }, 401);
    }

    const user = userData.user;
    const { email } = await req.json();
    const normalized = String(email ?? "").trim().toLowerCase();

    if (!normalized.includes("@")) {
      return json({ success: false, error: "Invalid email format" }, 400);
    }

    const { data: domainAllowed, error: domainError } = await admin.rpc(
      "is_allowed_student_domain",
      { candidate_email: normalized },
    );

    if (domainError) {
      console.error("Domain check failed:", domainError);
      return json({ success: false, error: "Could not validate that email right now." }, 500);
    }

    if (!domainAllowed) {
      return json({
        success: false,
        error: "Email domain not recognized. Please use your official university email.",
      }, 400);
    }

    const { data: existingClaim, error: claimError } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("university_email", normalized)
      .neq("user_id", user.id)
      .maybeSingle();

    if (claimError) {
      console.error("Claim check failed:", claimError);
      return json({ success: false, error: "Could not validate that email right now." }, 500);
    }

    if (existingClaim) {
      return json({
        success: false,
        error: "This email is already associated with another account.",
      }, 400);
    }

    // Rate limit: at most 3 codes per user per 15 minutes.
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("verification_otps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", windowStart);

    if (countError) {
      console.error("Rate limit check failed:", countError);
      return json({ success: false, error: "Could not send a code right now." }, 500);
    }

    if ((count ?? 0) >= 3) {
      return json({
        success: false,
        error: "Too many requests. Please wait 15 minutes and try again.",
      }, 429);
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp, user.id);

    const { error: insertError } = await admin.from("verification_otps").insert({
      user_id: user.id,
      target_email: normalized,
      otp_hash: otpHash,
    });

    if (insertError) {
      console.error("Failed to store OTP:", insertError);
      return json({ success: false, error: "Could not send a code right now." }, 500);
    }

    const studentName = user.user_metadata?.full_name || "there";

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: TRANSACTIONAL_FROM,
        reply_to: REPLY_TO,
        to: [normalized],
        subject: "Your Uni Deals verification code",
        html: `<div style="font-family: sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
                 <h2 style="color: #0f172a; margin-top: 0;">Hi ${studentName},</h2>
                 <p style="color: #475569; line-height: 1.5;">Enter this code to verify your student status:</p>
                 <p style="font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #0f172a; margin: 24px 0;">${otp}</p>
                 <p style="color: #475569; line-height: 1.5;">The code expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
                 <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">Best regards,<br/><strong>The Uni Deals Team</strong></p>
                 ${MAIL_FOOTER}
               </div>`,
      }),
    });

    if (!emailRes.ok) {
      console.error("Resend rejected the message:", await emailRes.text());
      return json({ success: false, error: "Could not send the email. Please try again." }, 502);
    }

    // The plaintext code is never returned to the browser.
    return json({ success: true });
  } catch (error) {
    console.error("send-verification-otp failed:", error);
    return json({ success: false, error: "An unexpected error occurred." }, 500);
  }
});

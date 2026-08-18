import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

import {
  MAIL_FOOTER,
  REPLY_TO,
  TEAM_INBOX,
  TRANSACTIONAL_FROM,
} from "../_shared/mail.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    // Supabase webhooks wrap payload in { type, table, record, old_record }
    const { record } = payload;
    
    if (!record || !record.email) {
      return json({ error: "Missing record or email" }, 400);
    }

    const { name, email, inquiry_type, message, brand_name } = record;

    // Send email to team
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: TRANSACTIONAL_FROM,
        reply_to: REPLY_TO,
        to: [TEAM_INBOX],
        subject: `New Inquiry [${inquiry_type}]: ${name}`,
        html: `<div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                 <h2 style="color: #0f172a; margin-top: 0;">New Inquiry Received</h2>
                 <p><strong>Name:</strong> ${name}</p>
                 <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                 <p><strong>Type:</strong> ${inquiry_type}</p>
                 <p><strong>Brand:</strong> ${brand_name || 'N/A'}</p>
                 <p><strong>Message:</strong></p>
                 <div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; color: #334155;">${message}</div>
               </div>`,
      }),
    });

    // Send confirmation to user
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: TRANSACTIONAL_FROM,
        reply_to: REPLY_TO,
        to: [email],
        subject: "We received your inquiry!",
        html: `<div style="font-family: sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
                 <h2 style="color: #0f172a; margin-top: 0;">Hi ${name},</h2>
                 <p style="color: #475569; line-height: 1.5;">Thanks for reaching out to Uni Deals. We have received your inquiry and our support team will get back to you shortly.</p>
                 <br/>
                 <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">Best regards,<br/><strong>The Uni Deals Team</strong></p>
                 ${MAIL_FOOTER}
               </div>`,
      }),
    });

    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});

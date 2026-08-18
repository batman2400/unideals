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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const payload = await req.json();
    const { record, old_record } = payload;
    
    // Only proceed if status shifted to approved
    if (record?.status !== 'approved' || old_record?.status === 'approved') {
      return new Response(JSON.stringify({ message: "Not an approval transition" }), { status: 200 });
    }

    if (!record.organizer_id) {
      return new Response(JSON.stringify({ error: "No organizer id" }), { status: 400 });
    }

    // Fetch user email from auth.users (requires service role key)
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(record.organizer_id);
    
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 400 });
    }
    
    const userEmail = userData.user.email;
    const userName = userData.user.user_metadata?.full_name || "Student";

    // Send email to student
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: TRANSACTIONAL_FROM,
        reply_to: REPLY_TO,
        to: [userEmail],
        subject: `Your event "${record.title}" is approved!`,
        html: `<div style="font-family: sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
                 <h2 style="color: #0f172a; margin-top: 0;">Hi ${userName},</h2>
                 <p style="color: #475569; line-height: 1.5;">Great news! Your event <strong>${record.title}</strong> has been approved and is now live on Uni Deals.</p>
                 <br/>
                 <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">Best regards,<br/><strong>The Uni Deals Team</strong></p>
                 ${MAIL_FOOTER}
               </div>`,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

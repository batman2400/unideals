import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  try {
    const payload = await req.json();
    // Supabase webhooks wrap payload in { type, table, record, old_record }
    const { record } = payload;
    
    if (!record || !record.email) {
      return new Response(JSON.stringify({ error: "Missing record or email" }), { status: 400 });
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
        from: "UniDeals Support <help@unideals.lk>",
        to: ["help@unideals.lk"],
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
        from: "UniDeals Support <help@unideals.lk>",
        to: [email],
        subject: "We received your inquiry!",
        html: `<div style="font-family: sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
                 <h2 style="color: #0f172a; margin-top: 0;">Hi ${name},</h2>
                 <p style="color: #475569; line-height: 1.5;">Thanks for reaching out to UniDeals. We have received your inquiry and our support team will get back to you shortly.</p>
                 <br/>
                 <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">Best regards,<br/><strong>The UniDeals Team</strong></p>
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

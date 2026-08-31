import { Helmet } from "react-helmet-async";
import { SITE_URL } from "../lib/seo";

export default function Support() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 animate-fade-in">
      <Helmet>
        <title>Help & Support | Uni Deals</title>
        <meta
          name="description"
          content="Get help with student verification, redeeming deals, and your Uni Deals account. Contact our support team for assistance."
        />
        <link rel="canonical" href={`${SITE_URL}/support`} />
      </Helmet>
      <div className="mb-8 text-center md:text-left">
        <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background">
          Help & Support
        </h1>
        <p className="text-on-surface-variant text-base mt-2">
          We're here to help you get the most out of UniDeals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-6 shadow-sm flex flex-col items-center md:items-start text-center md:text-left">
          <span className="material-symbols-outlined text-primary text-4xl mb-4">mail</span>
          <h3 className="font-headline font-bold text-xl text-on-background mb-2">Email Us</h3>
          <p className="text-on-surface-variant text-sm mb-4">
            Have a question or need assistance? Drop us an email and our support team will get back to you within 24 hours.
          </p>
          <a href="mailto:unideals.lk@gmail.com" className="inline-flex items-center gap-2 text-primary font-bold hover:underline">
            unideals.lk@gmail.com
            <span className="material-symbols-outlined text-sm">open_in_new</span>
          </a>
        </div>

        <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-6 shadow-sm flex flex-col items-center md:items-start text-center md:text-left">
          <span className="material-symbols-outlined text-primary text-4xl mb-4">school</span>
          <h3 className="font-headline font-bold text-xl text-on-background mb-2">Verification Help</h3>
          <p className="text-on-surface-variant text-sm mb-4">
            Having trouble verifying your student status? Make sure your university email is valid or use the manual verification method in your profile. Status expires after 12 months, so re-verify each year to keep access.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-headline font-bold text-2xl text-on-background mb-4">
          Frequently asked
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5">
            <h3 className="font-headline font-bold text-base text-on-background mb-2">
              How do I verify my student status?
            </h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Open Profile and complete verification. Institute emails use a one-time code to prove inbox ownership; Gmail and school students upload ID. An admin must approve before you can redeem — OTP alone does not verify you. Verification is valid for 12 months.
            </p>
          </div>
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5">
            <h3 className="font-headline font-bold text-base text-on-background mb-2">
              Do I need to verify every year?
            </h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Yes. Student status lasts 12 months from approval. Re-verify from Profile before it expires so you can keep unlocking deal codes and in-store tickets.
            </p>
          </div>
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5">
            <h3 className="font-headline font-bold text-base text-on-background mb-2">
              How do I redeem a deal?
            </h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Open the deal. Online offers reveal a promo code. In-store offers generate a timed ticket on that deal page — show it to the cashier. Your Profile pass is identity only, not a ticket.
            </p>
          </div>
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5">
            <h3 className="font-headline font-bold text-base text-on-background mb-2">
              How do I submit a campus event?
            </h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Sign in, go to Events, and submit a listing. Events stay pending until an admin approves them. Students will see approved events on the Events page.
            </p>
          </div>
          <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-5">
            <h3 className="font-headline font-bold text-base text-on-background mb-2">
              How do brand partnerships work?
            </h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Email us at unideals.lk@gmail.com or use the Contact form. A team member will reply from that inbox — automated mail from Uni Deals is send-only and is not monitored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

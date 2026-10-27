import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "../lib/supabaseClient";
import { useRoleContext } from "../lib/RoleContext";
import { uploadApplicationLogo } from "../lib/brandLogoUpload";
import { SITE_URL } from "../lib/seo";

const CATEGORIES = [
  "Food & Beverage",
  "Fashion & Apparel",
  "Tech & Electronics",
  "Entertainment",
  "Health & Beauty",
  "Travel",
  "Other",
];

function openLogin() {
  window.dispatchEvent(
    new CustomEvent("open-auth-modal", { detail: { tab: "login" } }),
  );
}

function withWebsiteScheme(value) {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function schemaMissing(error) {
  const message = error?.message ?? "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST202" ||
    error?.code === "42883" ||
    /applicant_user_id|submit_brand_application|does not exist|could not find the function/i.test(
      message,
    )
  );
}

const emptyForm = {
  name: "",
  category: "",
  description: "",
  contactName: "",
  contactPhone: "",
  websiteUrl: "",
  instagramHandle: "",
  tiktokHandle: "",
  location: "",
};

export default function PartnerApply() {
  const { user, role, authReady, loading: roleLoading } = useRoleContext();
  const [form, setForm] = useState(emptyForm);
  const [logoFile, setLogoFile] = useState(null);
  const [existingLogo, setExistingLogo] = useState(null);
  const [status, setStatus] = useState(null);
  const [rejectionReason, setRejectionReason] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!authReady || roleLoading) return;
      if (!user?.id || role === "partner" || role === "admin") {
        if (active) setLoading(false);
        return;
      }

      // limit(1) returns 200 [] when this account has no application.
      // maybeSingle asks for a single object and PostgREST answers 406.
      const { data: rows, error: fetchError } = await supabase
        .from("brands")
        .select(
          "name, category, description, website_url, instagram_handle, tiktok_handle, location, logo_url, contact_name, contact_phone, status, rejection_reason",
        )
        .eq("applicant_user_id", user.id)
        .limit(1);
      const data = rows?.[0] ?? null;

      if (!active) return;

      if (fetchError) {
        setUnavailable(schemaMissing(fetchError));
        setError(
          schemaMissing(fetchError)
            ? ""
            : fetchError.message || "Couldn't load your application.",
        );
        setLoading(false);
        return;
      }

      if (data) {
        setForm({
          name: data.name ?? "",
          category: data.category ?? "",
          description: data.description ?? "",
          contactName: data.contact_name ?? "",
          contactPhone: data.contact_phone ?? "",
          websiteUrl: data.website_url ?? "",
          instagramHandle: data.instagram_handle ?? "",
          tiktokHandle: data.tiktok_handle ?? "",
          location: data.location ?? "",
        });
        setExistingLogo(data.logo_url);
        setStatus(data.status);
        setRejectionReason(data.rejection_reason);
      }
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [authReady, roleLoading, role, user?.id]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!user?.id || submitting) return;
    setError("");
    setSubmitted(false);
    setSubmitting(true);

    try {
      let logoUrl = existingLogo;
      if (logoFile) {
        const uploaded = await uploadApplicationLogo({
          file: logoFile,
          userId: user.id,
        });
        logoUrl = uploaded.publicUrl;
      }

      const { error: submitError } = await supabase.rpc(
        "submit_brand_application",
        {
          p_name: form.name.trim(),
          p_contact_name: form.contactName.trim(),
          p_contact_phone: form.contactPhone.trim(),
          p_category: form.category.trim() || null,
          p_description: form.description.trim() || null,
          p_website_url: withWebsiteScheme(form.websiteUrl) || null,
          p_instagram_handle: form.instagramHandle.trim() || null,
          p_tiktok_handle: form.tiktokHandle.trim() || null,
          p_location: form.location.trim() || null,
          p_logo_url: logoUrl,
        },
      );

      if (submitError) {
        if (schemaMissing(submitError)) {
          setUnavailable(true);
          return;
        }
        throw submitError;
      }

      setLogoFile(null);
      setExistingLogo(logoUrl);
      setStatus("pending");
      setRejectionReason(null);
      setSubmitted(true);
    } catch (caught) {
      setError(caught?.message || "Couldn't submit your application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="max-w-2xl mx-auto px-4 sm:px-6 py-10 md:py-14">
      <Helmet>
        <title>Partner application | Uni Deals</title>
        <meta
          name="description"
          content="Apply to list your brand on Uni Deals. Applications are reviewed before a brand can publish student offers."
        />
        <link rel="canonical" href={`${SITE_URL}/become-partner`} />
      </Helmet>

      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant/60 font-semibold">
        Partners
      </p>
      <h1 className="mt-2 font-headline font-black text-3xl md:text-4xl text-on-background tracking-tight">
        Become a partner
      </h1>
      <p className="mt-3 text-on-surface-variant leading-relaxed">
        Tell us who you are and how to confirm the brand. We review every
        application. Your account stays a student until it is approved.
      </p>

      {!authReady || roleLoading || loading ? (
        <p className="mt-8 text-sm text-on-surface-variant">Loading…</p>
      ) : !user ? (
        <div className="mt-8">
          <p className="text-on-surface-variant mb-4">
            Sign in with the account you want to use as the brand owner.
          </p>
          <button
            type="button"
            onClick={openLogin}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold"
          >
            Sign in
          </button>
        </div>
      ) : role === "partner" ? (
        <p className="mt-8 text-on-surface-variant">
          You already have a partner account. Edit the brand from{" "}
          <Link to="/profile" className="text-primary font-bold">
            your profile
          </Link>
          . Name and logo changes show to students as soon as you save them.
        </p>
      ) : role === "admin" ? (
        <p className="mt-8 text-on-surface-variant">
          Admins create brands from the{" "}
          <Link to="/admin/brands" className="text-primary font-bold">
            brands screen
          </Link>
          . Those brands go live immediately. Student applications wait in{" "}
          <Link
            to="/admin/brand-applications"
            className="text-primary font-bold"
          >
            Brand applications
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          {unavailable && (
            <p className="bg-primary/10 text-on-background px-4 py-3 rounded-xl text-sm">
              Brand applications are not live yet. The database update still
              needs to be applied.
            </p>
          )}
          {status === "pending" && (
            <p className="bg-primary/10 text-on-background px-4 py-3 rounded-xl text-sm">
              Your application is in review. You stay a student until an admin
              approves it. Saving again sends the latest version.
            </p>
          )}
          {status === "rejected" && (
            <p className="bg-error/10 text-error px-4 py-3 rounded-xl text-sm">
              {rejectionReason
                ? `The last application was declined: ${rejectionReason}`
                : "The last application was declined. Update the details and submit again."}
            </p>
          )}
          {status === "suspended" && (
            <p className="bg-error/10 text-error px-4 py-3 rounded-xl text-sm">
              This brand is suspended. Contact support if you think that's a
              mistake.
            </p>
          )}
          {submitted && (
            <p className="bg-primary/10 text-on-background px-4 py-3 rounded-xl text-sm">
              Application sent. You stay a student until an admin approves it.
            </p>
          )}
          {error && (
            <p className="bg-error/10 text-error px-4 py-3 rounded-xl text-sm">
              {error}
            </p>
          )}

          <Field label="Brand name" name="name" value={form.name} onChange={onChange} required />
          <label className="flex flex-col gap-2 text-sm font-bold text-on-background">
            Category
            <select
              name="category"
              value={form.category}
              onChange={onChange}
              className="h-12 bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 font-normal"
            >
              <option value="">Select category</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              {form.category && !CATEGORIES.includes(form.category) ? (
                <option value={form.category}>{form.category}</option>
              ) : null}
            </select>
          </label>
          <Field
            label="Description"
            name="description"
            value={form.description}
            onChange={onChange}
            multiline
          />
          <Field
            label="Contact name"
            name="contactName"
            value={form.contactName}
            onChange={onChange}
            required
          />
          <Field
            label="Contact phone"
            name="contactPhone"
            value={form.contactPhone}
            onChange={onChange}
            required
          />
          <Field
            label="Website"
            name="websiteUrl"
            value={form.websiteUrl}
            onChange={onChange}
            placeholder="https://yourbrand.com"
          />
          <Field
            label="Instagram"
            name="instagramHandle"
            value={form.instagramHandle}
            onChange={onChange}
            placeholder="@brand"
          />
          <Field
            label="TikTok"
            name="tiktokHandle"
            value={form.tiktokHandle}
            onChange={onChange}
            placeholder="@brand"
          />
          <Field label="Location" name="location" value={form.location} onChange={onChange} />

          <label className="flex flex-col gap-2 text-sm font-bold text-on-background">
            Logo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
              className="font-normal text-sm"
            />
            <span className="font-normal text-xs text-on-surface-variant">
              Optional. JPG, PNG, or WEBP, max 5MB.
            </span>
          </label>

          <p className="text-sm text-on-surface-variant">
            A website or one social profile is required. We use the contact
            details only to review the application.
          </p>

          <button
            type="submit"
            disabled={submitting || unavailable || status === "suspended"}
            className="h-12 rounded-xl bg-primary text-on-primary font-bold disabled:opacity-50"
          >
            {submitting
              ? "Sending…"
              : status
                ? "Update application"
                : "Submit application"}
          </button>
        </form>
      )}
    </section>
  );
}

function Field({ label, name, value, onChange, required = false, multiline = false, placeholder }) {
  const className =
    "bg-surface-container-low border border-outline-variant/30 rounded-xl px-4 font-normal text-on-background";
  return (
    <label className="flex flex-col gap-2 text-sm font-bold text-on-background">
      {label}
      {multiline ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          rows={4}
          className={`${className} py-3`}
        />
      ) : (
        <input
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          className={`${className} h-12`}
        />
      )}
    </label>
  );
}

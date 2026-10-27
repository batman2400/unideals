import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import PortalLayout from "../../layouts/PortalLayout";

function schemaMissing(error) {
  const message = error?.message ?? "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST202" ||
    /profile_review_status|does not exist|could not find the function/i.test(
      message,
    )
  );
}

function toItems(row) {
  const shared = {
    id: row.id,
    name: row.name,
    pendingName: row.pending_name,
    logoUrl: row.logo_url,
    pendingLogoUrl: row.pending_logo_url,
    category: row.category,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    websiteUrl: row.website_url,
    instagramHandle: row.instagram_handle,
    tiktokHandle: row.tiktok_handle,
    location: row.location,
    description: row.description,
  };
  if (row.status !== "pending") return [];
  return [{ ...shared, kind: "application" }];
}

export default function AdminBrandApplications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [actingKey, setActingKey] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data, error: fetchError } = await supabase
      .from("brands")
      .select(
        "id, name, status, profile_review_status, pending_name, pending_logo_url, logo_url, category, description, contact_name, contact_phone, website_url, instagram_handle, tiktok_handle, location, submitted_at",
      )
      .eq("status", "pending")
      .order("submitted_at", { ascending: false });

    if (fetchError) {
      setUnavailable(schemaMissing(fetchError));
      setError(
        schemaMissing(fetchError)
          ? ""
          : fetchError.message || "Couldn't load brand applications.",
      );
      setItems([]);
      setLoading(false);
      return;
    }

    setUnavailable(false);
    setItems((data ?? []).flatMap(toItems));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (item, decision) => {
    const reason =
      decision === "reject"
        ? window.prompt("Reason for the brand (optional)") ?? null
        : null;
    if (decision === "reject" && reason === null) return;

    const functionName =
      decision === "approve"
        ? "approve_brand_application"
        : "reject_brand_application";

    const key = `${item.kind}:${item.id}`;
    setActingKey(key);
    setError("");
    const args =
      decision === "approve"
        ? { p_brand_id: item.id }
        : { p_brand_id: item.id, p_reason: reason?.trim() || null };
    const { error: reviewError } = await supabase.rpc(functionName, args);
    setActingKey("");
    if (reviewError) {
      setError(reviewError.message || "Couldn't update that review.");
      return;
    }
    await load();
  };

  return (
    <PortalLayout portalType="admin">
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
          Brand applications
        </h1>
        <p className="text-on-surface-variant text-sm leading-relaxed">
          Approving an application promotes that student to a partner for the
          brand. Rejected applicants can edit and resubmit.
        </p>
      </div>

      {unavailable && (
        <p className="mb-4 bg-primary/10 text-on-background px-4 py-3 rounded-xl text-sm">
          This queue is not live yet. Apply the brand applications SQL in
          Supabase first.
        </p>
      )}
      {error && (
        <p className="mb-4 bg-error/10 text-error px-4 py-3 rounded-xl text-sm font-bold">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : items.length === 0 && !unavailable ? (
        <p className="text-sm text-on-surface-variant">
          No brand applications waiting.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => {
            const lines = [
              item.category && `Category: ${item.category}`,
              item.contactName && `Contact: ${item.contactName}`,
              item.contactPhone && `Phone: ${item.contactPhone}`,
              item.websiteUrl && `Website: ${item.websiteUrl}`,
              item.instagramHandle && `Instagram: ${item.instagramHandle}`,
              item.tiktokHandle && `TikTok: ${item.tiktokHandle}`,
              item.location && `Location: ${item.location}`,
              item.description && `About: ${item.description}`,
            ].filter(Boolean);
            const preview = item.logoUrl;
            const key = `${item.kind}:${item.id}`;
            return (
              <li
                key={key}
                className="bg-surface rounded-2xl border border-outline-variant/15 p-5 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  {preview ? (
                    <img
                      src={preview}
                      alt=""
                      className="h-12 w-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-surface-container" />
                  )}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                      New application
                    </p>
                    <p className="font-headline font-extrabold text-lg text-on-background">
                      {item.name}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1 text-sm text-on-surface-variant mb-4">
                  {lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={actingKey === key}
                    onClick={() => void review(item, "approve")}
                    className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={actingKey === key}
                    onClick={() => void review(item, "reject")}
                    className="px-4 py-2 rounded-xl border border-outline-variant/40 text-sm font-bold disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PortalLayout>
  );
}

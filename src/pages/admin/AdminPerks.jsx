import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import PortalLayout from "../../layouts/PortalLayout";
import {
  PERK_COLUMNS,
  mapPerk,
  perksSchemaMissing,
} from "../../lib/studentPerks";

const EMPTY = {
  providerName: "",
  category: "Software",
  summary: "",
  eligibility: "",
  claimSteps: "",
  officialUrl: "https://",
  availability: "Sri Lanka",
  lastVerifiedOn: "",
  isActive: false,
};

export default function AdminPerks() {
  const [perks, setPerks] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("student_perks")
      .select(PERK_COLUMNS)
      .order("sort_order", { ascending: true });
    if (fetchError) {
      setUnavailable(perksSchemaMissing(fetchError));
      setError(
        perksSchemaMissing(fetchError)
          ? ""
          : fetchError.message || "Couldn't load student perks.",
      );
      setPerks([]);
    } else {
      setUnavailable(false);
      setError("");
      setPerks((data ?? []).map(mapPerk));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.providerName.trim() || !form.summary.trim()) {
      setError("Provider name and summary are required.");
      return;
    }
    if (!/^https:\/\//i.test(form.officialUrl.trim())) {
      setError("Official link must start with https://.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      provider_name: form.providerName.trim(),
      category: form.category.trim() || null,
      summary: form.summary.trim(),
      eligibility: form.eligibility.trim() || null,
      claim_steps: form.claimSteps.trim() || null,
      official_url: form.officialUrl.trim(),
      availability: form.availability.trim() || null,
      last_verified_on: form.lastVerifiedOn.trim() || null,
      is_active: form.isActive,
    };
    const query = editingId
      ? supabase.from("student_perks").update(payload).eq("id", editingId)
      : supabase.from("student_perks").insert([
          {
            ...payload,
            sort_order: Math.max(0, ...perks.map((perk) => perk.sortOrder)) + 1,
          },
        ]);
    const { error: saveError } = await query;
    setSaving(false);
    if (saveError) {
      setError(saveError.message || "Couldn't save that perk.");
      return;
    }
    setForm(EMPTY);
    setEditingId(null);
    await load();
  };

  const toggle = async (perk) => {
    const { error: updateError } = await supabase
      .from("student_perks")
      .update({ is_active: !perk.isActive })
      .eq("id", perk.id);
    if (updateError) {
      setError(updateError.message || "Couldn't update that perk.");
      return;
    }
    await load();
  };

  return (
    <PortalLayout portalType="admin">
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
          Student perks
        </h1>
        <p className="text-on-surface-variant text-sm leading-relaxed">
          Hidden perks stay off the public site. Use the provider's own page,
          not a referral link.
        </p>
      </div>

      {unavailable && (
        <p className="mb-4 bg-primary/10 text-on-background px-4 py-3 rounded-xl text-sm">
          Student perks are not live yet. Apply the student perks SQL in
          Supabase first.
        </p>
      )}
      {error && (
        <p className="mb-4 bg-error/10 text-error px-4 py-3 rounded-xl text-sm font-bold">
          {error}
        </p>
      )}

      <form onSubmit={save} className="mb-8 grid gap-3 max-w-2xl">
        <input name="providerName" value={form.providerName} onChange={onChange} placeholder="Provider name" className="h-12 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4" />
        <textarea name="summary" value={form.summary} onChange={onChange} placeholder="Summary" rows={3} className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3" />
        <textarea name="eligibility" value={form.eligibility} onChange={onChange} placeholder="Who can claim it" rows={3} className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3" />
        <textarea name="claimSteps" value={form.claimSteps} onChange={onChange} placeholder="Claim steps, one per line" rows={4} className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3" />
        <input name="officialUrl" value={form.officialUrl} onChange={onChange} placeholder="https://official-page" className="h-12 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4" />
        <input name="availability" value={form.availability} onChange={onChange} placeholder="Sri Lanka" className="h-12 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4" />
        <input name="lastVerifiedOn" value={form.lastVerifiedOn} onChange={onChange} placeholder="2026-10-12" className="h-12 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4" />
        <label className="flex items-center gap-2 text-sm font-bold text-on-background">
          <input type="checkbox" name="isActive" checked={form.isActive} onChange={onChange} />
          Visible to students
        </label>
        <button type="submit" disabled={saving || unavailable} className="h-12 rounded-xl bg-primary font-bold text-on-primary disabled:opacity-50">
          {editingId ? "Save perk" : "Add perk"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {perks.map((perk) => (
            <li key={perk.id} className="rounded-2xl border border-outline-variant/15 bg-surface p-4">
              <p className="font-headline font-extrabold text-on-background">{perk.providerName}</p>
              <p className="text-xs font-bold text-primary mt-1">{perk.isActive ? "Visible" : "Hidden"}</p>
              <p className="mt-2 text-sm text-on-surface-variant">{perk.summary}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => void toggle(perk)} className="rounded-xl border border-outline-variant/40 px-3 py-2 text-sm font-bold">
                  {perk.isActive ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(perk.id);
                    setForm({
                      providerName: perk.providerName,
                      category: perk.category || "Software",
                      summary: perk.summary,
                      eligibility: perk.eligibility || "",
                      claimSteps: perk.claimSteps.join("\n"),
                      officialUrl: perk.officialUrl,
                      availability: perk.availability || "",
                      lastVerifiedOn: perk.lastVerifiedOn || "",
                      isActive: perk.isActive,
                    });
                  }}
                  className="rounded-xl border border-outline-variant/40 px-3 py-2 text-sm font-bold"
                >
                  Edit
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PortalLayout>
  );
}

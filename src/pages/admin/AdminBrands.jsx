import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";
import { uploadBrandLogo } from "../../lib/brandLogoUpload";

function AdminBrands() {
  const { role, loading: roleLoading } = useRoleContext();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [saving, setSaving] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => () => { isMountedRef.current = false; }, []);

  const fetchBrands = useCallback(async () => {
    if (role !== "admin") return;
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("brands")
      .select("*")
      .order("name", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setBrands(data || []);
    }
    setLoading(false);
  }, [role]);

  useEffect(() => {
    if (roleLoading) return;
    fetchBrands();
  }, [roleLoading, fetchBrands]);

  const showMsg = useCallback((text) => {
    setMessage(text);
    setTimeout(() => { if (isMountedRef.current) setMessage(""); }, 4000);
  }, []);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setLogoFile(null);
      setLogoPreview("");
      return;
    }
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Brand name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let uploadedLogoUrl = null;
      if (logoFile) {
        const { publicUrl } = await uploadBrandLogo({
          file: logoFile,
          brandName: name,
        });
        uploadedLogoUrl = publicUrl;
      }

      const { error: insertError } = await supabase
        .from("brands")
        .insert([
          {
            name: name.trim(),
            description: description.trim() || null,
            website_url: websiteUrl.trim() || null,
            logo_url: uploadedLogoUrl,
          },
        ]);

      if (insertError) throw insertError;

      if (isMountedRef.current) {
        setShowCreate(false);
        setName("");
        setDescription("");
        setWebsiteUrl("");
        setLogoFile(null);
        setLogoPreview("");
        showMsg(`Brand "${name}" created successfully.`);
        fetchBrands();
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || "Failed to create brand");
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  };

  if (roleLoading || loading) {
    return (
      <PortalLayout portalType="admin">
        <div className="space-y-5">
          <div className="h-8 w-40 rounded-xl skeleton-shimmer" />
          <div className="h-12 rounded-xl skeleton-shimmer" />
          <div className="h-96 rounded-2xl skeleton-shimmer" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout portalType="admin">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
            Brand Management
          </h1>
          <p className="text-on-surface-variant text-sm">
            Create and manage partner brands in the system.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-5 py-2.5 rounded-xl font-headline font-bold text-sm shadow-sm hover:shadow-md transition-all"
        >
          <span className="material-symbols-outlined text-lg">add_business</span>
          Create Brand
        </button>
      </div>

      {message && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <p className="text-emerald-700 text-sm font-bold">{message}</p>
        </div>
      )}
      {error && (
        <div className="mb-4 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      )}

      {showCreate && (
        <div className="mb-6 bg-surface rounded-2xl border border-primary/20 p-5 shadow-sm animate-slide-down">
          <h3 className="font-headline font-bold text-on-background mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">add_business</span>
            Create New Brand
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Brand Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apple"
                  required
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Website URL</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short description about this brand..."
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[80px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Brand Logo</label>
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <img src={logoPreview} alt="Preview" className="w-16 h-16 rounded-xl object-cover border border-outline-variant/20" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-primary-container file:text-on-primary-container hover:file:bg-primary-container/80 transition-all cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 emerald-gradient text-on-primary px-6 py-3 rounded-xl font-headline font-bold text-sm shadow-sm disabled:opacity-60"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-lg">check</span>
                )}
                Create Brand
              </button>
            </div>
          </form>
        </div>
      )}

      {brands.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">storefront</span>
          <p className="text-on-surface-variant text-sm">No brands found. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((b) => (
            <div key={b.id} className="bg-surface border border-outline-variant/20 rounded-2xl p-5 hover:border-primary/30 transition-colors shadow-sm flex flex-col">
              <div className="flex items-start gap-4 mb-3">
                {b.logo_url ? (
                  <img src={b.logo_url} alt={b.name} className="w-14 h-14 rounded-xl object-cover border border-outline-variant/10 shadow-sm" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-surface-variant/50 text-2xl">image</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-headline font-bold text-on-background text-lg truncate">{b.name}</h3>
                  {b.website_url && (
                    <a href={b.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[14px]">link</span>
                      Website
                    </a>
                  )}
                </div>
              </div>
              {b.description ? (
                <p className="text-sm text-on-surface-variant line-clamp-2 mt-auto">{b.description}</p>
              ) : (
                <p className="text-sm text-on-surface-variant/50 italic mt-auto">No description provided.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}

export default AdminBrands;

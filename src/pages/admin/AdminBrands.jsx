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

  // Edit Drawer State
  const [editingBrand, setEditingBrand] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editWebsiteUrl, setEditWebsiteUrl] = useState("");
  const [editLogoFile, setEditLogoFile] = useState(null);
  const [editLogoPreview, setEditLogoPreview] = useState("");
  const [updating, setUpdating] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const fetchBrands = useCallback(async () => {
    if (role !== "admin") return;
    setLoading(true);
    setError("");

    // Use a custom RPC if we had one for stats, else fetch from brands table
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
    setTimeout(() => {
      if (isMountedRef.current) setMessage("");
    }, 4000);
  }, []);

  const handleLogoChange = (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) {
      if (isEdit) {
        setEditLogoFile(null);
        setEditLogoPreview(editingBrand?.logo_url || "");
      } else {
        setLogoFile(null);
        setLogoPreview("");
      }
      return;
    }
    const url = URL.createObjectURL(file);
    if (isEdit) {
      setEditLogoFile(file);
      setEditLogoPreview(url);
    } else {
      setLogoFile(file);
      setLogoPreview(url);
    }
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

      const { error: insertError } = await supabase.from("brands").insert([
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

  const openEditDrawer = (brand) => {
    setEditingBrand(brand);
    setEditName(brand.name);
    setEditDescription(brand.description || "");
    setEditWebsiteUrl(brand.website_url || "");
    setEditLogoPreview(brand.logo_url || "");
    setEditLogoFile(null);
    setError("");
  };

  const closeEditDrawer = () => {
    setEditingBrand(null);
    setEditName("");
    setEditDescription("");
    setEditWebsiteUrl("");
    setEditLogoPreview("");
    setEditLogoFile(null);
    setError("");
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      setError("Brand name is required");
      return;
    }

    setUpdating(true);
    setError("");

    try {
      let uploadedLogoUrl = editingBrand.logo_url;
      if (editLogoFile) {
        const { publicUrl } = await uploadBrandLogo({
          file: editLogoFile,
          brandName: editName,
        });
        uploadedLogoUrl = publicUrl;
      }

      const { error: updateError } = await supabase
        .from("brands")
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          website_url: editWebsiteUrl.trim() || null,
          logo_url: uploadedLogoUrl,
        })
        .eq("id", editingBrand.id);

      if (updateError) throw updateError;

      if (isMountedRef.current) {
        showMsg(`Brand "${editName}" updated successfully.`);
        closeEditDrawer();
        fetchBrands();
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || "Failed to update brand");
      }
    } finally {
      if (isMountedRef.current) {
        setUpdating(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${editingBrand.name}? This action cannot be undone and will fail if deals are attached.`)) {
      return;
    }
    setUpdating(true);
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("brands")
        .delete()
        .eq("id", editingBrand.id);

      if (deleteError) throw deleteError;

      if (isMountedRef.current) {
        showMsg(`Brand "${editingBrand.name}" deleted successfully.`);
        closeEditDrawer();
        fetchBrands();
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message || "Failed to delete brand");
      }
    } finally {
      if (isMountedRef.current) {
        setUpdating(false);
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
          <span className="material-symbols-outlined text-lg">
            add_business
          </span>
          Create Brand
        </button>
      </div>

      {message && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <p className="text-emerald-700 text-sm font-bold">{message}</p>
        </div>
      )}
      {error && !editingBrand && (
        <div className="mb-4 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      )}

      {showCreate && (
        <div className="mb-6 bg-surface rounded-2xl border border-primary/20 p-5 shadow-sm animate-slide-down">
          <h3 className="font-headline font-bold text-on-background mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">
              add_business
            </span>
            Create New Brand
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Brand Name *
                </label>
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
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Website URL
                </label>
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
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short description about this brand..."
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[80px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                Brand Logo
              </label>
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <img
                    src={logoPreview}
                    alt="Preview"
                    className="w-16 h-16 rounded-xl object-contain bg-gray-50 border border-outline-variant/20"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoChange(e, false)}
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
                  <span className="material-symbols-outlined text-lg">
                    check
                  </span>
                )}
                Create Brand
              </button>
            </div>
          </form>
        </div>
      )}

      {brands.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">
            storefront
          </span>
          <p className="text-on-surface-variant text-sm">
            No brands found. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {brands.map((b) => {
            const initials = b.name ? b.name.substring(0, 2).toUpperCase() : "??";
            return (
              <div
                key={b.id}
                onClick={() => openEditDrawer(b)}
                className="bg-surface border border-outline-variant/20 rounded-2xl p-5 hover:shadow-lg hover:border-emerald-500 cursor-pointer transition-all duration-200 flex flex-col group relative"
              >
                <div className="flex items-start gap-4 mb-3">
                  {b.logo_url ? (
                    <img
                      src={b.logo_url}
                      alt={b.name}
                      className="w-14 h-14 rounded-xl object-contain bg-gray-50 border border-outline-variant/10 shadow-sm"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gray-100 border border-outline-variant/20 flex items-center justify-center">
                      <span className="font-headline font-extrabold text-xl text-gray-400">
                        {initials}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline font-bold text-on-background text-lg truncate group-hover:text-emerald-700 transition-colors">
                      {b.name}
                    </h3>
                    {b.website_url && (
                      <a
                        href={b.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:underline text-xs flex items-center gap-1 mt-0.5"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          link
                        </span>
                        Website
                      </a>
                    )}
                  </div>
                </div>
                {b.description ? (
                  <p className="text-sm text-on-surface-variant line-clamp-2 mt-2 mb-4">
                    {b.description}
                  </p>
                ) : (
                  <p className="text-sm text-on-surface-variant/50 italic mt-2 mb-4">
                    No description provided.
                  </p>
                )}

                {/* Footer Platform Stats (Placeholder / Aggregated mock) */}
                <div className="mt-auto pt-3 border-t border-outline-variant/10 flex items-center justify-between text-xs text-on-surface-variant/70 font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-emerald-500">local_activity</span>
                    Active Deals
                  </div>
                  <span>Click to Edit →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Drawer Slide-over */}
      {editingBrand && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div 
            className="fixed inset-0 bg-background/50 backdrop-blur-sm transition-opacity" 
            onClick={closeEditDrawer} 
          />
          <div className="relative w-full max-w-md bg-surface h-full shadow-2xl flex flex-col border-l border-outline-variant/10 animate-slide-left">
            <div className="px-6 py-5 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/30">
              <h2 className="font-headline font-extrabold text-xl text-on-background">Edit Brand</h2>
              <button 
                onClick={closeEditDrawer}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-outline-variant/10 transition-colors"
              >
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {error && (
                <div className="mb-4 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
                  <p className="text-error text-sm font-bold">{error}</p>
                </div>
              )}
              <form id="edit-brand-form" onSubmit={handleUpdate} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Brand Name *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={editWebsiteUrl}
                    onChange={(e) => setEditWebsiteUrl(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[100px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Update Logo
                  </label>
                  <div className="flex items-center gap-4">
                    {editLogoPreview ? (
                      <img
                        src={editLogoPreview}
                        alt="Preview"
                        className="w-16 h-16 rounded-xl object-contain bg-gray-50 border border-outline-variant/20"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-100 border border-outline-variant/20 flex items-center justify-center">
                        <span className="font-headline font-extrabold text-xl text-gray-400">
                          {editName.substring(0,2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoChange(e, true)}
                      className="text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-surface-container-high file:text-on-surface hover:file:bg-surface-variant transition-all cursor-pointer"
                    />
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-outline-variant/10 bg-surface-container-low flex justify-between items-center gap-4">
              <button 
                type="button"
                onClick={handleDelete}
                disabled={updating}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-red-600 font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
                Delete
              </button>
              <button
                type="submit"
                form="edit-brand-form"
                disabled={updating}
                className="inline-flex items-center justify-center gap-2 emerald-gradient text-on-primary px-6 py-2.5 rounded-xl font-headline font-bold text-sm shadow-sm disabled:opacity-60 flex-1"
              >
                {updating ? (
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-lg">save</span>
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}

export default AdminBrands;

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";
import { uploadBrandLogo } from "../../lib/brandLogoUpload";

const CATEGORIES = [
  "Food & Beverage",
  "Fashion & Apparel",
  "Tech & Electronics",
  "Entertainment",
  "Health & Beauty",
  "Travel",
  "Other"
];

function AdminBrands() {
  const { role, loading: roleLoading } = useRoleContext();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Edit Drawer State
  const [editingBrand, setEditingBrand] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editWebsiteUrl, setEditWebsiteUrl] = useState("");
  const [editInstagramHandle, setEditInstagramHandle] = useState("");
  const [editTiktokHandle, setEditTiktokHandle] = useState("");
  const [editLogoFile, setEditLogoFile] = useState(null);
  const [editLogoPreview, setEditLogoPreview] = useState("");
  const [updating, setUpdating] = useState(false);
  const [isEditDragging, setIsEditDragging] = useState(false);

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

  const handleLogoDrop = (e, isEdit = false) => {
    e.preventDefault();
    if (isEdit) setIsEditDragging(false);
    else setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      if (isEdit) {
        setEditLogoFile(file);
        setEditLogoPreview(url);
      } else {
        setLogoFile(file);
        setLogoPreview(url);
      }
    }
  };

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
          category: category || null,
          description: description.trim() || null,
          website_url: websiteUrl.trim() || null,
          instagram_handle: instagramHandle.trim() || null,
          tiktok_handle: tiktokHandle.trim() || null,
          logo_url: uploadedLogoUrl,
        },
      ]);

      if (insertError) throw insertError;

      if (isMountedRef.current) {
        setShowCreate(false);
        setName("");
        setCategory("");
        setDescription("");
        setWebsiteUrl("");
        setInstagramHandle("");
        setTiktokHandle("");
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
    setEditCategory(brand.category || "");
    setEditDescription(brand.description || "");
    setEditWebsiteUrl(brand.website_url || "");
    setEditInstagramHandle(brand.instagram_handle || "");
    setEditTiktokHandle(brand.tiktok_handle || "");
    setEditLogoPreview(brand.logo_url || "");
    setEditLogoFile(null);
    setError("");
  };

  const closeEditDrawer = () => {
    setEditingBrand(null);
    setEditName("");
    setEditCategory("");
    setEditDescription("");
    setEditWebsiteUrl("");
    setEditInstagramHandle("");
    setEditTiktokHandle("");
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
          category: editCategory || null,
          description: editDescription.trim() || null,
          website_url: editWebsiteUrl.trim() || null,
          instagram_handle: editInstagramHandle.trim() || null,
          tiktok_handle: editTiktokHandle.trim() || null,
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
        <div className="mb-6 bg-surface rounded-2xl border border-primary/20 p-6 shadow-sm animate-slide-down">
          <h3 className="font-headline font-bold text-on-background mb-6 flex items-center gap-2 text-lg">
            <span className="material-symbols-outlined text-primary text-xl">
              add_business
            </span>
            Create New Brand
          </h3>
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                  Brand Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apple"
                  required
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                >
                  <option value="">Select Category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short description about this brand..."
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[80px] transition-all"
              />
            </div>

            <div className="p-5 rounded-2xl bg-surface-container-low/50 border border-outline-variant/20 space-y-5">
              <h4 className="text-xs font-bold text-on-background uppercase tracking-wider flex items-center gap-2 border-b border-outline-variant/10 pb-3">
                <span className="material-symbols-outlined text-[16px] text-primary">link</span>
                Links & Socials
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Website URL</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">language</span>
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-surface border border-outline-variant/20 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Instagram</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 font-bold">@</span>
                    <input
                      type="text"
                      value={instagramHandle}
                      onChange={(e) => setInstagramHandle(e.target.value)}
                      placeholder="handle"
                      className="w-full bg-surface border border-outline-variant/20 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">TikTok</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 font-bold">@</span>
                    <input
                      type="text"
                      value={tiktokHandle}
                      onChange={(e) => setTiktokHandle(e.target.value)}
                      placeholder="handle"
                      className="w-full bg-surface border border-outline-variant/20 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                Brand Logo
              </label>
              <div
                className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant/30 bg-surface hover:border-primary/50 hover:bg-surface-container-low"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => handleLogoDrop(e, false)}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => handleLogoChange(e, false)}
                />
                {logoPreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={logoPreview}
                      alt="Preview"
                      className="w-24 h-24 rounded-xl object-contain bg-gray-50 border border-outline-variant/20 shadow-sm"
                    />
                    <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full backdrop-blur-sm">Click or drag to replace</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center pointer-events-none">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-1">
                      add_photo_alternate
                    </span>
                    <p className="text-sm font-bold text-on-surface">Upload Brand Logo</p>
                    <p className="text-xs text-on-surface-variant">Drag and drop or click to browse</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-surface-variant/50 rounded-lg text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                      <span className="material-symbols-outlined text-[14px]">aspect_ratio</span>
                      Recommended: Square 400x400px
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 emerald-gradient text-on-primary px-8 py-3.5 rounded-xl font-headline font-extrabold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[20px]">
                    check_circle
                  </span>
                )}
                Create Brand Profile
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
                    <div className="flex items-center gap-2 mt-0.5">
                      {b.category && (
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container px-2 py-0.5 rounded-md">
                          {b.category}
                        </span>
                      )}
                      {b.website_url && (
                        <a
                          href={b.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline text-xs flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            link
                          </span>
                        </a>
                      )}
                    </div>
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
              <form id="edit-brand-form" onSubmit={handleUpdate} className="space-y-6">
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                      Brand Name *
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                      Category
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                    >
                      <option value="">Select Category</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none min-h-[100px] transition-all"
                  />
                </div>

                <div className="p-5 rounded-2xl bg-surface-container-low/50 border border-outline-variant/20 space-y-4">
                  <h4 className="text-xs font-bold text-on-background uppercase tracking-wider flex items-center gap-2 border-b border-outline-variant/10 pb-3">
                    <span className="material-symbols-outlined text-[16px] text-primary">link</span>
                    Links & Socials
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Website URL</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[18px]">language</span>
                        <input
                          type="url"
                          value={editWebsiteUrl}
                          onChange={(e) => setEditWebsiteUrl(e.target.value)}
                          className="w-full bg-surface border border-outline-variant/20 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Instagram</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 font-bold text-sm">@</span>
                          <input
                            type="text"
                            value={editInstagramHandle}
                            onChange={(e) => setEditInstagramHandle(e.target.value)}
                            className="w-full bg-surface border border-outline-variant/20 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">TikTok</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 font-bold text-sm">@</span>
                          <input
                            type="text"
                            value={editTiktokHandle}
                            onChange={(e) => setEditTiktokHandle(e.target.value)}
                            className="w-full bg-surface border border-outline-variant/20 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                    Update Logo
                  </label>
                  <div
                    className={`relative flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-2xl transition-all ${
                      isEditDragging
                        ? "border-primary bg-primary/5"
                        : "border-outline-variant/30 bg-surface hover:border-primary/50 hover:bg-surface-container-low"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsEditDragging(true);
                    }}
                    onDragLeave={() => setIsEditDragging(false)}
                    onDrop={(e) => handleLogoDrop(e, true)}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => handleLogoChange(e, true)}
                    />
                    {editLogoPreview ? (
                      <div className="flex flex-col items-center gap-3">
                        <img
                          src={editLogoPreview}
                          alt="Preview"
                          className="w-20 h-20 rounded-xl object-contain bg-gray-50 border border-outline-variant/20 shadow-sm"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">Click to replace</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center pointer-events-none">
                        <div className="w-16 h-16 rounded-xl bg-gray-100 border border-outline-variant/20 flex items-center justify-center mb-1">
                          <span className="font-headline font-extrabold text-xl text-gray-400">
                            {editName.substring(0,2).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant">Drag new logo here</p>
                      </div>
                    )}
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
                className="inline-flex items-center justify-center gap-2 emerald-gradient text-on-primary px-6 py-2.5 rounded-xl font-headline font-bold text-sm shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0 flex-1"
              >
                {updating ? (
                  <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-lg">save</span>
                )}
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}

export default AdminBrands;

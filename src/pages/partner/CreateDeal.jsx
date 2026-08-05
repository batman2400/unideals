import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import {
  getPartnerBrand,
  PARTNER_BRAND_REQUIRED_MESSAGE,
} from "../../lib/partnerBrand";
import {
  buildOfferLabel,
  getOfferValueLabel,
  getOfferValuePlaceholder,
  isOfferValueRequired,
  OFFER_TYPE_OPTIONS,
} from "../../lib/dealOffer";
import { uploadDealImage } from "../../lib/dealImageUpload";
import DealCard from "../../components/DealCard";

const CATEGORY_OPTIONS = [
  "Fashion",
  "Food & Drink",
  "Tech & Mobile",
  "Beauty & Care",
  "Learning",
  "Travel & Auto",
  "Health & Fitness",
  "Household",
  "Finance",
  "Events & Tickets",
];
const TYPE_OPTIONS = ["Online", "In-Store"];

const INITIAL_FORM = {
  title: "",
  brand: "",
  discount: "",
  type: "Online",
  category: "Fashion",
  description: "",
  start_time: "",
  end_time: "",
};

function CreateDeal() {
  const navigate = useNavigate();
  const {
    user,
    role,
    loading: roleLoading,
    impersonatedPartnerId,
  } = useRoleContext();
  const targetUserId = impersonatedPartnerId || user?.id;

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [offerType, setOfferType] = useState("percentage_off");
  const [offerValue, setOfferValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [partnerBrand, setPartnerBrand] = useState("");
  const [partnerBrandId, setPartnerBrandId] = useState(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const isMountedRef = useRef(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedImageFile) {
      setSelectedImagePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedImageFile);
    setSelectedImagePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImageFile]);

  useEffect(() => {
    let active = true;

    async function resolvePartnerBrand() {
      if (roleLoading) {
        return;
      }

      if (!user?.id) {
        if (!active) return;
        setPartnerBrand("");
        setPartnerBrandId(null);
        setBrandLoading(false);
        return;
      }

      setError("");

      if (role === "admin" && !impersonatedPartnerId) {
        if (!active) return;
        setError(
          "Admin View: Please impersonate a brand from the sidebar to create deals.",
        );
        setPartnerBrand("");
        setPartnerBrandId(null);
        setBrandLoading(false);
        return;
      }

      if (role !== "partner" && role !== "admin") {
        if (!active) return;
        setError("Access denied. Partner role required.");
        setPartnerBrand("");
        setPartnerBrandId(null);
        setBrandLoading(false);
        return;
      }

      if (!active) return;
      setBrandLoading(true);

      const {
        brandId,
        brandName,
        error: brandError,
      } = await getPartnerBrand(targetUserId);

      if (!active) return;

      if (brandError) {
        setError(brandError);
        setPartnerBrand("");
        setPartnerBrandId(null);
        setBrandLoading(false);
        return;
      }

      if (!brandName) {
        setError(PARTNER_BRAND_REQUIRED_MESSAGE);
        setPartnerBrand("");
        setPartnerBrandId(null);
        setBrandLoading(false);
        return;
      }

      setPartnerBrand(brandName);
      setPartnerBrandId(brandId);
      setFormData((prev) => ({ ...prev, brand: brandName }));
      setBrandLoading(false);
    }

    resolvePartnerBrand();

    return () => {
      active = false;
    };
  }, [role, roleLoading, targetUserId, impersonatedPartnerId]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const onOfferTypeChange = (event) => {
    const nextType = event.target.value;
    setOfferType(nextType);

    if (!isOfferValueRequired(nextType)) {
      setOfferValue("");
    }
  };

  const onImageFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedImageFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedImageFile(file);
    }
  };

  const offerPreview = buildOfferLabel(offerType, offerValue);

  const validate = () => {
    const requiredKeys = [
      "title",
      "brand",
      "type",
      "category",
    ];
    const hasOffer = String(offerPreview).trim().length > 0;
    const hasImage = !!selectedImageFile;

    return (
      requiredKeys.every((key) => String(formData[key]).trim().length > 0) &&
      hasOffer &&
      hasImage
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!user) {
      setError("You must be logged in to submit a deal.");
      return;
    }

    if (role === "admin" && !impersonatedPartnerId) {
      setError(
        "Admin View: Please impersonate a brand from the sidebar to create deals.",
      );
      return;
    }

    if (role !== "partner" && role !== "admin") {
      setError("Access denied. Partner role required.");
      return;
    }

    if (brandLoading) {
      setError("Please wait while we verify your partner brand.");
      return;
    }

    if (!offerPreview) {
      setError("Please choose the offer details.");
      return;
    }

    if (!selectedImageFile) {
      setError("Please upload a deal image.");
      return;
    }

    if (!validate()) {
      setError("Please complete all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      let effectiveBrand = partnerBrand;

      if (!effectiveBrand || !partnerBrandId) {
        setError(PARTNER_BRAND_REQUIRED_MESSAGE);
        return;
      }

      let effectiveImageUrl = "";
      const generatedRedemptionCode = "UD-" + Math.random().toString(36).substring(2, 8).toUpperCase();

      if (selectedImageFile) {
        const { publicUrl } = await uploadDealImage({
          file: selectedImageFile,
          userId: targetUserId,
          brandName: effectiveBrand,
        });

        effectiveImageUrl = publicUrl;
      }

      const payload = {
        title: formData.title.trim(),
        brand: effectiveBrand,
        brand_id: partnerBrandId,
        discount: offerPreview,
        type: formData.type,
        category: formData.category,
        image_url: effectiveImageUrl,
        description:
          formData.description.trim() ||
          `${formData.title.trim()} student offer.`,
        redemption_code: generatedRedemptionCode,
        partner_id: targetUserId,
        status: "approved",
        start_time: formData.start_time ? new Date(formData.start_time).toISOString() : new Date().toISOString(),
        end_time: formData.end_time ? new Date(formData.end_time).toISOString() : null,
      };

      const { error: insertError } = await supabase
        .from("deals")
        .insert([payload]);

      if (!isMountedRef.current) return;

      if (insertError) {
        throw insertError;
      }

      setFormData({ ...INITIAL_FORM, brand: effectiveBrand });
      setOfferType("percentage_off");
      setOfferValue("");
      setSelectedImageFile(null);
      setSuccessMessage(
        "Deal launched successfully. It is now active on the platform.",
      );
    } catch (submitError) {
      if (!isMountedRef.current) return;
      if (submitError?.code === "23505") {
        setError(
          "Promo code already exists for this brand. Please use a unique code.",
        );
      } else {
        setError(
          submitError?.message || "Could not submit deal. Please try again.",
        );
      }
    } finally {
      if (!isMountedRef.current) return;
      setSubmitting(false);
    }
  };

  const mockDeal = {
    id: "demo-preview",
    title: formData.title || "Your Deal Title",
    brand: partnerBrand || "Your Brand",
    discount: offerPreview || "Discount value",
    type: formData.type || "Online",
    category: formData.category || "Fashion",
    imageUrl:
      selectedImagePreviewUrl ||
      "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=800&auto=format&fit=crop&q=80",
    description: formData.description || "Deal description will appear here.",
  };

  return (
    <section className="max-w-screen-2xl w-full mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div>
          <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase block mb-2">
            Partner Portal
          </span>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background mb-2">
            Create a New Deal Submission
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base max-w-2xl">
            Complete all fields and launch your deal. It will be immediately
            available to students.
          </p>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-headline font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-base">
            arrow_back
          </span>
          {role === 'admin' ? 'Back to Admin Portal' : 'Back to Partner Portal'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form */}
        <div className="lg:col-span-8 bg-surface rounded-2xl border border-outline-variant/20 p-6 md:p-8 shadow-sm">


          {successMessage && (
            <div className="mb-6 flex items-start gap-2 bg-primary-container/30 border border-primary/20 rounded-lg px-4 py-3">
              <span className="material-symbols-outlined text-primary text-lg flex-shrink-0 mt-0.5">
                check_circle
              </span>
              <p className="text-primary text-sm font-bold">{successMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Deal Information */}
            <div>
              <h2 className="font-headline font-bold text-lg text-on-background mb-4 pb-2 border-b border-outline-variant/10">
                1. Deal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                    Title
                  </label>
                  <input
                    name="title"
                    type="text"
                    value={formData.title}
                    onChange={onChange}
                    disabled={submitting}
                    placeholder="TechNova Pro"
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 min-h-[44px] text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                    Brand
                  </label>
                  <div className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 min-h-[44px] text-sm font-body text-on-surface-variant flex items-center">
                    {brandLoading
                      ? "Loading partner brand..."
                      : partnerBrand || "Not Assigned"}
                  </div>
                  <p className="text-[11px] text-on-surface-variant/70 mt-2 font-bold tracking-wide uppercase">
                    Assigned by admin.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={onChange}
                    disabled={submitting}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 min-h-[44px] text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    name="description"
                    rows={4}
                    value={formData.description}
                    onChange={onChange}
                    disabled={submitting}
                    placeholder="Add short terms or leave empty."
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all resize-y"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Offer Details */}
            <div>
              <h2 className="font-headline font-bold text-lg text-on-background mb-4 pb-2 border-b border-outline-variant/10">
                2. Offer Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                    Offer Type
                  </label>
                  <select
                    name="offerType"
                    value={offerType}
                    onChange={onOfferTypeChange}
                    disabled={submitting}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 min-h-[44px] text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                  >
                    {OFFER_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                    {getOfferValueLabel(offerType)}
                  </label>
                  {isOfferValueRequired(offerType) ? (
                    <input
                      name="offerValue"
                      type="text"
                      value={offerValue}
                      onChange={(event) => setOfferValue(event.target.value)}
                      disabled={submitting}
                      placeholder={getOfferValuePlaceholder(offerType)}
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 min-h-[44px] text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                    />
                  ) : (
                    <div className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 min-h-[44px] text-sm font-body text-on-surface-variant flex items-center">
                      Buy 1 Get 1
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                    Type
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={onChange}
                    disabled={submitting}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 min-h-[44px] text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                <div>
                  <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    name="start_time"
                    value={formData.start_time}
                    onChange={onChange}
                    disabled={submitting}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 min-h-[44px] text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                  />
                  <p className="text-[11px] text-on-surface-variant/70 mt-2 font-bold tracking-wide uppercase">
                    Leave blank to activate immediately
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                    End Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    name="end_time"
                    value={formData.end_time}
                    onChange={onChange}
                    disabled={submitting}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 min-h-[44px] text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Deal Image */}
            <div>
              <h2 className="font-headline font-bold text-lg text-on-background mb-4 pb-2 border-b border-outline-variant/10">
                3. Deal Image
              </h2>
              <div
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={onImageFileChange}
                  disabled={submitting}
                  className="hidden"
                />

                {selectedImagePreviewUrl ? (
                  <div className="flex flex-col items-center">
                    <div className="w-48 h-32 rounded-lg overflow-hidden border border-outline-variant/20 shadow-sm mb-4 relative group">
                      <img
                        src={selectedImagePreviewUrl}
                        alt="Selected preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedImageFile(null);
                            if (fileInputRef.current)
                              fileInputRef.current.value = "";
                          }}
                          className="bg-error text-on-error p-2 rounded-full hover:scale-110 transition-transform shadow-sm flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined text-sm">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm font-headline font-bold text-primary hover:underline"
                    >
                      Change Image
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-3xl text-on-surface-variant">
                        cloud_upload
                      </span>
                    </div>
                    <p className="font-headline font-bold text-base text-on-background mb-1">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-on-surface-variant">
                      JPG, PNG or WEBP (max 5MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 bg-error/10 border border-error/20 rounded-lg px-4 py-3">
                <span className="material-symbols-outlined text-error text-lg flex-shrink-0 mt-0.5">
                  error
                </span>
                <p className="text-error text-sm font-bold">{error}</p>
              </div>
            )}

            <div className="pt-6 flex items-center justify-end">
              <button
                type="submit"
                disabled={
                  submitting ||
                  brandLoading ||
                  !formData.title.trim() ||
                  !partnerBrand ||
                  !offerPreview ||
                  !selectedImageFile
                }
                className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-8 py-3.5 rounded-xl font-headline font-bold text-base tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl">
                      rocket_launch
                    </span>
                    Launch Deal
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Preview */}
        <div className="lg:col-span-4">
          <div className="sticky top-24">
            <h2 className="font-headline font-bold text-lg text-on-background mb-4">
              Live Preview
            </h2>
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-4 shadow-sm relative pointer-events-none">
              <div className="absolute top-4 left-4 z-20">
                <span className="inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm bg-surface-container/80 text-on-surface border-outline-variant/20 shadow-sm">
                  Preview
                </span>
              </div>
              <DealCard deal={mockDeal} />
            </div>
            <p className="text-xs text-on-surface-variant mt-4 text-center px-4 leading-relaxed">
              This is exactly how your deal will appear to students on the
              platform.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CreateDeal;

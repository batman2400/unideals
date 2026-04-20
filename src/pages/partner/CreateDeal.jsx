import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../lib/useRole";
import {
  getPartnerBrandName,
  upsertPartnerBrandName,
} from "../../lib/partnerBrand";
import {
  buildOfferLabel,
  getOfferValueLabel,
  getOfferValuePlaceholder,
  isOfferValueRequired,
  OFFER_TYPE_OPTIONS,
} from "../../lib/dealOffer";
import { uploadDealImage } from "../../lib/dealImageUpload";

const CATEGORY_OPTIONS = ["Tech", "Coffee", "Clothing", "Fitness", "Home", "Creative"];
const TYPE_OPTIONS = ["Online", "In-Store"];

const INITIAL_FORM = {
  title: "",
  brand: "",
  discount: "",
  type: "Online",
  category: "Tech",
  imageUrl: "",
  description: "",
  redemptionCode: "",
};

function CreateDeal() {
  const { user, role, loading: roleLoading } = useRole();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [offerType, setOfferType] = useState("percentage_off");
  const [offerValue, setOfferValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [partnerBrand, setPartnerBrand] = useState("");
  const [brandSetupRequired, setBrandSetupRequired] = useState(false);
  const [brandLoading, setBrandLoading] = useState(true);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState("");
  const isMountedRef = useRef(true);

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
        setBrandSetupRequired(false);
        setBrandLoading(false);
        return;
      }

      if (role !== "partner" && role !== "admin") {
        if (!active) return;
        setError("Access denied. Partner role required.");
        setPartnerBrand("");
        setBrandSetupRequired(false);
        setBrandLoading(false);
        return;
      }

      if (!active) return;
      setBrandLoading(true);

      const { brandName, error: brandError } = await getPartnerBrandName(user.id);

      if (!active) return;

      if (brandError) {
        setError(brandError);
        setPartnerBrand("");
        setBrandSetupRequired(false);
        setBrandLoading(false);
        return;
      }

      if (!brandName) {
        setError(
          "No brand profile found yet. Set your brand name below to create your first offer."
        );
        setPartnerBrand("");
        setBrandSetupRequired(true);
        setFormData((prev) => ({ ...prev, brand: "" }));
        setBrandLoading(false);
        return;
      }

      setError("");
      setPartnerBrand(brandName);
      setBrandSetupRequired(false);
      setFormData((prev) => ({ ...prev, brand: brandName }));
      setBrandLoading(false);
    }

    resolvePartnerBrand();

    return () => {
      active = false;
    };
  }, [role, roleLoading, user?.id]);

  const onChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === "redemptionCode" ? value.toUpperCase() : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
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

  const offerPreview = buildOfferLabel(offerType, offerValue);

  const validate = () => {
    const requiredKeys = ["title", "brand", "type", "category", "redemptionCode"];
    const hasOffer = String(offerPreview).trim().length > 0;
    const hasImage = !!selectedImageFile || String(formData.imageUrl).trim().length > 0;

    return requiredKeys.every((key) => String(formData[key]).trim().length > 0) && hasOffer && hasImage;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!user) {
      setError("You must be logged in to submit a deal.");
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

    if (!selectedImageFile && !formData.imageUrl.trim()) {
      setError("Please upload an image or provide an image URL.");
      return;
    }

    if (!validate()) {
      setError("Please complete all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      let effectiveBrand = partnerBrand;

      if (!effectiveBrand) {
        const requestedBrand = formData.brand.trim();

        if (!requestedBrand) {
          setError("Please provide a brand name before submitting your first offer.");
          return;
        }

        const { brandName: savedBrand, error: brandSaveError } = await upsertPartnerBrandName(
          user.id,
          requestedBrand
        );

        if (brandSaveError) {
          throw new Error(brandSaveError);
        }

        effectiveBrand = savedBrand || requestedBrand;
        setPartnerBrand(effectiveBrand);
        setBrandSetupRequired(false);
      }

      let effectiveImageUrl = formData.imageUrl.trim();
      const normalizedRedemptionCode = formData.redemptionCode.trim().toUpperCase();

      if (selectedImageFile) {
        const { publicUrl } = await uploadDealImage({
          file: selectedImageFile,
          userId: user.id,
          brandName: effectiveBrand,
        });

        effectiveImageUrl = publicUrl;
      }

      const payload = {
        title: formData.title.trim(),
        brand: effectiveBrand,
        discount: offerPreview,
        type: formData.type,
        category: formData.category,
        image_url: effectiveImageUrl,
        description: formData.description.trim() || `${formData.title.trim()} student offer.`,
        redemption_code: normalizedRedemptionCode,
        partner_id: user.id,
        status: "pending",
      };

      const { error: insertError } = await supabase.from("deals").insert([payload]);

      if (!isMountedRef.current) return;

      if (insertError) {
        throw insertError;
      }

      setFormData({ ...INITIAL_FORM, brand: effectiveBrand });
      setOfferType("percentage_off");
      setOfferValue("");
      setSelectedImageFile(null);
      setSuccessMessage("Deal submitted successfully. It is now pending admin approval.");
    } catch (submitError) {
      if (!isMountedRef.current) return;
      if (submitError?.code === "23505") {
        setError("Promo code already exists for this brand. Please use a unique code.");
      } else {
        setError(submitError?.message || "Could not submit deal. Please try again.");
      }
    } finally {
      if (!isMountedRef.current) return;
      setSubmitting(false);
    }
  };

  return (
    <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div>
          <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase block mb-2">
            Partner Portal
          </span>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background mb-2">
            Create a New Deal Submission
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base max-w-2xl">
            Complete all fields and submit for review. The deal will remain pending
            until an admin approves it.
          </p>
        </div>

        <Link
          to="/partner"
          className="inline-flex items-center gap-1.5 text-sm font-headline font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-surface rounded-2xl border border-outline-variant/20 p-6 md:p-8 shadow-sm">
        {error && (
          <div className="mb-5 flex items-start gap-2 bg-error/10 border border-error/20 rounded-lg px-4 py-3">
            <span className="material-symbols-outlined text-error text-lg flex-shrink-0 mt-0.5">error</span>
            <p className="text-error text-sm font-bold">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 flex items-start gap-2 bg-primary-container/30 border border-primary/20 rounded-lg px-4 py-3">
            <span className="material-symbols-outlined text-primary text-lg flex-shrink-0 mt-0.5">check_circle</span>
            <p className="text-primary text-sm font-bold">{successMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
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
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
              Brand
            </label>
            <input
              name="brand"
              type="text"
              value={brandLoading ? "Loading partner brand..." : formData.brand}
              onChange={onChange}
              readOnly={!!partnerBrand && !brandSetupRequired}
              disabled={submitting || brandLoading || (!!partnerBrand && !brandSetupRequired)}
              placeholder={brandSetupRequired ? "Enter your brand name" : "Assigned by profile"}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
            />
            {brandSetupRequired ? (
              <p className="text-[11px] text-primary mt-2 font-bold tracking-wide uppercase">
                Set this once to create your brand profile.
              </p>
            ) : (
              <p className="text-[11px] text-on-surface-variant/70 mt-2 font-bold tracking-wide uppercase">
                Brand is locked to your partner profile.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
              Offer Type
            </label>
            <select
              name="offerType"
              value={offerType}
              onChange={onOfferTypeChange}
              disabled={submitting}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
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
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
              />
            ) : (
              <div className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body text-on-surface-variant">
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
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
              Upload Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={onImageFileChange}
              disabled={submitting}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm font-body"
            />
            <p className="text-[11px] text-on-surface-variant/70 mt-2 font-bold tracking-wide uppercase">
              Optional: Upload JPG, PNG, or WEBP (max 5MB).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
              Image URL (Optional)
            </label>
            <input
              name="imageUrl"
              type="url"
              value={formData.imageUrl}
              onChange={onChange}
              disabled={submitting}
              placeholder="https://example.com/deal-image.jpg"
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
              Offer Preview
            </label>
            <input
              type="text"
              value={offerPreview || "Complete offer type/value to preview"}
              readOnly
              disabled
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body"
            />
          </div>

          {(selectedImagePreviewUrl || formData.imageUrl) && (
            <div className="md:col-span-2">
              <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
                Image Preview
              </label>
              <div className="w-full max-w-md overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low">
                <img
                  src={selectedImagePreviewUrl || formData.imageUrl}
                  alt="Offer preview"
                  className="w-full h-52 object-cover"
                />
              </div>
            </div>
          )}

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

          <div className="md:col-span-2">
            <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
              Redemption Code
            </label>
            <input
              name="redemptionCode"
              type="text"
              value={formData.redemptionCode}
              onChange={onChange}
              disabled={submitting}
              placeholder="TECHNOVA20"
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
            />
            <p className="text-[11px] text-on-surface-variant/70 mt-2 font-bold tracking-wide uppercase">
              Must be unique for your brand.
            </p>
          </div>

          <div className="md:col-span-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={
                submitting ||
                brandLoading ||
                !formData.title.trim() ||
                !formData.brand.trim() ||
                !formData.redemptionCode.trim() ||
                !offerPreview ||
                (!selectedImageFile && !formData.imageUrl.trim())
              }
              className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-6 py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">send</span>
                  Submit for Approval
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default CreateDeal;

import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../lib/useRole";
import { getPartnerBrandName, PARTNER_BRAND_REQUIRED_MESSAGE } from "../../lib/partnerBrand";
import {
  buildOfferLabel,
  getOfferValueLabel,
  getOfferValuePlaceholder,
  isOfferValueRequired,
  OFFER_TYPE_OPTIONS,
  parseOfferLabel,
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

function EditDeal() {
  const { id } = useParams();
  const { user, role, loading: roleLoading, error: roleError } = useRole();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [offerType, setOfferType] = useState("percentage_off");
  const [offerValue, setOfferValue] = useState("");
  const [partnerBrand, setPartnerBrand] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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

    async function fetchDealForEdit() {
      if (roleLoading) {
        return;
      }

      if (roleError) {
        setError(roleError || "Unable to verify role.");
        setLoading(false);
        return;
      }

      if (role !== "partner") {
        setError("Only partners can edit offers from this page.");
        setLoading(false);
        return;
      }

      if (!user?.id) {
        setError("Unable to load partner profile.");
        setLoading(false);
        return;
      }

      const dealId = Number(id);
      if (!Number.isFinite(dealId)) {
        setError("Invalid offer id.");
        setLoading(false);
        return;
      }

      const { brandName, error: brandError } = await getPartnerBrandName(user.id);

      if (!active) return;

      if (brandError) {
        setError(brandError || "Unable to resolve partner brand.");
        setLoading(false);
        return;
      }

      if (!brandName) {
        setError(PARTNER_BRAND_REQUIRED_MESSAGE);
        setLoading(false);
        return;
      }

      setPartnerBrand(brandName);

      const { data, error: fetchError } = await supabase
        .from("deals")
        .select("id, title, brand, discount, type, category, image_url, description, redemption_code")
        .eq("id", dealId)
        .eq("partner_id", user.id)
        .eq("brand", brandName)
        .maybeSingle();

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message || "Failed to load offer for editing.");
        setLoading(false);
        return;
      }

      if (!data) {
        setError("Offer not found or you do not have access to edit it.");
        setLoading(false);
        return;
      }

      setFormData({
        title: data.title || "",
        brand: data.brand || brandName,
        discount: data.discount || "",
        type: data.type || "Online",
        category: data.category || "Tech",
        imageUrl: data.image_url || "",
        description: data.description || "",
        redemptionCode: data.redemption_code || "",
      });

      const parsedOffer = parseOfferLabel(data.discount || "");
      setOfferType(parsedOffer.offerType);
      setOfferValue(parsedOffer.offerValue);
      setLoading(false);
    }

    fetchDealForEdit();

    return () => {
      active = false;
    };
  }, [id, role, roleError, roleLoading, user?.id]);

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

  const offerPreview = buildOfferLabel(offerType, offerValue);

  const validate = () => {
    const requiredKeys = ["title", "brand", "type", "category", "description", "redemptionCode"];
    const hasOffer = String(offerPreview).trim().length > 0;
    const hasImage = !!selectedImageFile || String(formData.imageUrl).trim().length > 0;

    return requiredKeys.every((key) => String(formData[key]).trim().length > 0) && hasOffer && hasImage;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (role !== "partner" || !user?.id) {
      setError("Access denied. Partner role required.");
      return;
    }

    if (!partnerBrand) {
      setError(PARTNER_BRAND_REQUIRED_MESSAGE);
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

    setSaving(true);

    try {
      let effectiveImageUrl = formData.imageUrl.trim();

      if (selectedImageFile) {
        const { publicUrl } = await uploadDealImage({
          file: selectedImageFile,
          userId: user.id,
          brandName: partnerBrand,
        });

        effectiveImageUrl = publicUrl;
      }

      const payload = {
        title: formData.title.trim(),
        brand: partnerBrand,
        discount: offerPreview,
        type: formData.type,
        category: formData.category,
        image_url: effectiveImageUrl,
        description: formData.description.trim(),
        redemption_code: formData.redemptionCode.trim(),
      };

      const { data, error: updateError } = await supabase
        .from("deals")
        .update(payload)
        .eq("id", Number(id))
        .eq("partner_id", user.id)
        .eq("brand", partnerBrand)
        .select("id")
        .maybeSingle();

      if (!isMountedRef.current) return;

      if (updateError) {
        throw updateError;
      }

      if (!data) {
        setError("Update blocked. You can only edit your own brand offers.");
        return;
      }

      setFormData((prev) => ({ ...prev, imageUrl: effectiveImageUrl }));
      setSelectedImageFile(null);

      setSuccessMessage("Offer updated successfully.");
    } catch (submitError) {
      if (!isMountedRef.current) return;
      setError(submitError?.message || "Could not update offer. Please try again.");
    } finally {
      if (!isMountedRef.current) return;
      setSaving(false);
    }
  };

  if (roleLoading || loading) {
    return (
      <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16 animate-fade-in">
        <div className="min-h-[45vh] flex items-center justify-center">
          <div className="flex items-center gap-3 text-on-surface-variant">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-headline font-bold">Loading offer editor...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div>
          <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase block mb-2">
            Partner Portal
          </span>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background mb-2">
            Edit Offer
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base max-w-2xl">
            Update your offer details for your assigned brand.
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
              disabled={saving}
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
              value={formData.brand}
              readOnly
              disabled
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body"
            />
            <p className="text-[11px] text-on-surface-variant/70 mt-2 font-bold tracking-wide uppercase">
              Brand is locked after creation.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
              Offer Type
            </label>
            <select
              name="offerType"
              value={offerType}
              onChange={onOfferTypeChange}
              disabled={saving}
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
                disabled={saving}
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
              disabled={saving}
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
              disabled={saving}
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
              Upload New Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={onImageFileChange}
              disabled={saving}
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
              disabled={saving}
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
              Description
            </label>
            <textarea
              name="description"
              rows={4}
              value={formData.description}
              onChange={onChange}
              disabled={saving}
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
              disabled={saving}
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <Link
              to="/partner"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-outline-variant/20 text-on-surface-variant font-headline font-bold text-sm tracking-tight hover:bg-surface-container-low transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !offerPreview || (!selectedImageFile && !formData.imageUrl.trim())}
              className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-6 py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">save</span>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default EditDeal;

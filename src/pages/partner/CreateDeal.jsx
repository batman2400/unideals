import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../lib/useRole";

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
  const { user } = useRole();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const requiredKeys = [
      "title",
      "brand",
      "discount",
      "type",
      "category",
      "imageUrl",
      "description",
      "redemptionCode",
    ];

    return requiredKeys.every((key) => String(formData[key]).trim().length > 0);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!user) {
      setError("You must be logged in to submit a deal.");
      return;
    }

    if (!validate()) {
      setError("Please complete all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        title: formData.title.trim(),
        brand: formData.brand.trim(),
        discount: formData.discount.trim(),
        type: formData.type,
        category: formData.category,
        image_url: formData.imageUrl.trim(),
        description: formData.description.trim(),
        redemption_code: formData.redemptionCode.trim(),
        partner_id: user.id,
        status: "pending",
      };

      const { error: insertError } = await supabase.from("deals").insert([payload]);

      if (!isMountedRef.current) return;

      if (insertError) {
        throw insertError;
      }

      setFormData(INITIAL_FORM);
      setSuccessMessage("Deal submitted successfully. It is now pending admin approval.");
    } catch (submitError) {
      if (!isMountedRef.current) return;
      setError(submitError?.message || "Could not submit deal. Please try again.");
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
              value={formData.brand}
              onChange={onChange}
              disabled={submitting}
              placeholder="TechNova"
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
              Discount
            </label>
            <input
              name="discount"
              type="text"
              value={formData.discount}
              onChange={onChange}
              disabled={submitting}
              placeholder="20% OFF"
              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
            />
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
              Image URL
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
              Description
            </label>
            <textarea
              name="description"
              rows={4}
              value={formData.description}
              onChange={onChange}
              disabled={submitting}
              placeholder="Describe the student offer and redemption rules."
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
          </div>

          <div className="md:col-span-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={submitting}
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

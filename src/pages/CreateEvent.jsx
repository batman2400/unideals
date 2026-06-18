import React, { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useRoleContext } from "../lib/RoleContext";
import { supabase } from "../lib/supabaseClient";
import { uploadEventImage } from "../lib/eventImageUpload";

function CreateEvent() {
  const { role, user, loading: roleLoading } = useRoleContext();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    location_name: "",
    category: "social",
    cover_image_url: "",
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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

  // Show a loading state briefly while checking roles
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Strict role check: if student (or unauthenticated without a bypass), deny access
  if (!role || role === "student") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center animate-fade-in">
        <span className="material-symbols-outlined text-6xl text-error mb-4">block</span>
        <h1 className="font-headline font-bold text-3xl text-on-background mb-2">Access Denied</h1>
        <p className="text-on-surface-variant mb-6">
          You do not have permission to create events. Only Verified Brands and Admins can access this portal.
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98]"
        >
          Return to Home
        </button>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      if (!user) throw new Error("You must be logged in to create an event.");

      let finalImageUrl = formData.cover_image_url;

      if (selectedImageFile) {
        const { publicUrl } = await uploadEventImage({
          file: selectedImageFile,
          userId: user.id,
        });
        finalImageUrl = publicUrl;
      }

      const eventData = {
        ...formData,
        cover_image_url: finalImageUrl,
        organizer_id: user.id,
      };

      // Optional: convert end_time to null if empty
      if (!eventData.end_time) {
        delete eventData.end_time;
      }

      const { error: insertError } = await supabase.from("events").insert([eventData]);
      
      if (insertError) throw insertError;

      setSuccess(true);
      // Reset form on success
      setFormData({
        title: "",
        description: "",
        start_time: "",
        end_time: "",
        location_name: "",
        category: "social",
        cover_image_url: "",
      });
      setSelectedImageFile(null);
      setSelectedImagePreviewUrl("");

    } catch (err) {
      console.error("Error creating event:", err);
      setError(err.message || "Failed to create event. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 animate-fade-in">
      <div className="mb-8">
        <h1 className="font-headline font-extrabold text-3xl tracking-tighter text-on-background">
          Create New Event
        </h1>
        <p className="text-on-surface-variant mt-2">
          Publish an exclusive event to the UniDeals platform.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-outline-variant/20">
        {success && (
          <div className="mb-6 p-4 bg-primary/10 text-primary rounded-2xl flex items-center gap-3">
            <span className="material-symbols-outlined">check_circle</span>
            <p className="font-bold text-sm">Event successfully created and published!</p>
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-error/10 text-error rounded-2xl flex items-center gap-3">
            <span className="material-symbols-outlined">error</span>
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title & Category */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Event Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Campus Tech Fest 2026"
                required
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[48px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[48px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none cursor-pointer"
              >
                <option value="social">Social & Networking</option>
                <option value="academic">Academic & Career</option>
                <option value="sports">Sports & Wellness</option>
                <option value="entertainment">Entertainment</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Start Date & Time</label>
              <input
                type="datetime-local"
                name="start_time"
                value={formData.start_time}
                onChange={handleChange}
                required
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[48px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">End Date & Time (Optional)</label>
              <input
                type="datetime-local"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[48px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          {/* Location & Image */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Location</label>
              <input
                type="text"
                name="location_name"
                value={formData.location_name}
                onChange={handleChange}
                placeholder="e.g. Main Auditorium"
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[48px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Upload Cover Image</label>
              <div className="flex flex-col md:flex-row items-start gap-4">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setSelectedImageFile(file);
                      setFormData((prev) => ({ ...prev, cover_image_url: "" }));
                    }
                  }}
                  className="w-full md:w-auto text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer"
                />
                {(selectedImagePreviewUrl || formData.cover_image_url) && (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container flex-shrink-0">
                    <img src={selectedImagePreviewUrl || formData.cover_image_url} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-on-surface-variant/70 mt-2 uppercase tracking-wide">
                Optional: Upload JPG, PNG, or WEBP (Max 5MB).
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Event Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="5"
              placeholder="Provide the exciting details about your event..."
              className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-y"
            ></textarea>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Publishing...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">publish</span>
                  Publish Event
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateEvent;

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useRoleContext } from "../lib/RoleContext";
import { supabase } from "../lib/supabaseClient";
import { uploadEventImage } from "../lib/eventImageUpload";

function CreateEvent() {
  const { user, loading: roleLoading, isAuthenticated } = useRoleContext();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    publish_at: "",
    location_name: "",
    category: "social",
    university_name: "",
    club_name: "",
    cover_image_url: "",
    target_audience: "all_students",
    external_registration_url: "",
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

  // Show a loading state briefly while checking auth
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Auth check: user must be logged in to submit an event
  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center animate-fade-in">
        <span className="material-symbols-outlined text-6xl text-primary mb-4">login</span>
        <h1 className="font-headline font-bold text-3xl text-on-background mb-2">Sign In Required</h1>
        <p className="text-on-surface-variant mb-6">
          You need to be signed in to submit an event. Sign in or create an account to get started.
        </p>
        <button
          onClick={() => window.dispatchEvent(new Event("open-auth-modal"))}
          className="px-6 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98]"
        >
          Sign In
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

      // Prefer the live auth uid so organizer_id always matches RLS (auth.uid()).
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      const organizerId = authUser?.id || user.id;
      if (!organizerId) throw new Error("You must be logged in to create an event.");

      let finalImageUrl = formData.cover_image_url;

      if (selectedImageFile) {
        const { publicUrl } = await uploadEventImage({
          file: selectedImageFile,
          userId: organizerId,
        });
        finalImageUrl = publicUrl;
      }

      const eventData = {
        ...formData,
        cover_image_url: finalImageUrl,
        organizer_id: organizerId,
        status: "pending",
        publish_at: formData.publish_at
          ? new Date(formData.publish_at).toISOString()
          : new Date().toISOString(),
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
        publish_at: "",
        location_name: "",
        category: "social",
        university_name: "",
        club_name: "",
        cover_image_url: "",
        target_audience: "all_students",
        external_registration_url: "",
      });
      setSelectedImageFile(null);
      setSelectedImagePreviewUrl("");

      // Redirect to the events feed after a short delay
      setTimeout(() => {
        if (isMountedRef.current) {
          navigate('/events');
        }
      }, 2500);

    } catch (err) {
      console.error("Error creating event:", err);
      setError(err.message || "Failed to create event. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-screen-2xl w-full mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 animate-fade-in">
      <div className="mb-8">
        <button
          onClick={() => navigate('/events')}
          className="text-on-surface-variant/70 hover:text-on-background transition-colors cursor-pointer inline-flex items-center gap-1 mb-4 text-sm font-bold tracking-wider"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          Back to Events
        </button>
        <h1 className="font-headline font-extrabold text-3xl tracking-tighter text-on-background">
          Create New Event
        </h1>
        <p className="text-on-surface-variant mt-2">
          Submit your event for review. It will appear on the public feed once approved by an admin.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Form Column */}
        <div className="lg:col-span-7 xl:col-span-8">
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-outline-variant/20">
        {success && (
          <div className="mb-6 p-5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-emerald-600 mt-0.5">check_circle</span>
            <div>
              <p className="font-bold text-sm mb-1">Event Submitted Successfully!</p>
              <p className="text-xs text-emerald-700 leading-relaxed">Your event is currently under review and will appear on the public feed once approved by an admin. Redirecting to events...</p>
            </div>
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

          {/* University and Club */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">University Name</label>
              <input
                type="text"
                name="university_name"
                value={formData.university_name}
                onChange={handleChange}
                placeholder="e.g. University of Example"
                required
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[48px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Hosting Club / Society (Optional)</label>
              <input
                type="text"
                name="club_name"
                value={formData.club_name}
                onChange={handleChange}
                placeholder="e.g. Computer Science Society"
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[48px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Event Start Date & Time</label>
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
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Event End Date & Time (Optional)</label>
              <input
                type="datetime-local"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[48px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              Listing Go-Live / Publish At (Optional)
            </label>
            <input
              type="datetime-local"
              name="publish_at"
              value={formData.publish_at}
              onChange={handleChange}
              className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[48px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            <p className="text-[11px] text-on-surface-variant/70 mt-2 font-bold tracking-wide uppercase">
              Leave blank to publish when approved. A future date shows as Coming Soon until then.
            </p>
          </div>

          {/* Location & Audience */}
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
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Target Audience</label>
              <select
                name="target_audience"
                value={formData.target_audience}
                onChange={handleChange}
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[48px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none cursor-pointer"
              >
                <option value="all_students">All Students</option>
                <option value="university_only">University Only</option>
                <option value="high_school_only">High School Only</option>
              </select>
            </div>
          </div>

          {/* Ext Link & Image */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">External Registration Link (Optional)</label>
              <input
                type="url"
                name="external_registration_url"
                value={formData.external_registration_url}
                onChange={handleChange}
                placeholder="https://example.com/register"
                className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[48px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Upload Cover Image</label>
              <div className="relative border-2 border-dashed border-outline-variant/30 rounded-xl p-4 bg-surface-container/30 hover:bg-surface-container/50 transition-colors flex items-center justify-center min-h-[100px]">
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
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {!selectedImagePreviewUrl && !formData.cover_image_url ? (
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-on-surface-variant/50 text-3xl mb-1">cloud_upload</span>
                    <p className="text-sm font-bold text-on-surface-variant">Click or drag image to upload</p>
                    <p className="text-[10px] text-on-surface-variant/70 uppercase tracking-wide mt-1">JPG, PNG, WEBP (Max 5MB)</p>
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-between gap-4">
                     <div className="flex items-center gap-4 flex-1 min-w-0">
                       <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-outline-variant/30 bg-surface flex-shrink-0">
                         <img src={selectedImagePreviewUrl || formData.cover_image_url} alt="Preview" className="w-full h-full object-cover" />
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="text-sm font-bold text-on-background truncate">
                           {selectedImageFile ? selectedImageFile.name : "Cover Image"}
                         </p>
                         <p className="text-[10px] text-on-surface-variant uppercase tracking-wide mt-0.5">Click to replace</p>
                       </div>
                     </div>
                  </div>
                )}
              </div>
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

          <div className="pt-6 mt-8 border-t border-outline-variant/20 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-transparent hover:bg-surface-container text-on-surface-variant font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Submit for Review
                </>
              )}
            </button>
          </div>
        </form>
          </div>
        </div>

        {/* Right Live Preview Column */}
        <div className="lg:col-span-5 xl:col-span-4 hidden lg:block">
          <div className="sticky top-28">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Preview
            </h3>
            <div className="bg-white rounded-3xl p-6 border border-outline-variant/20 shadow-sm relative">
              <div className="pointer-events-none">
                <div className="bg-surface rounded-3xl overflow-hidden border border-outline-variant/20 shadow-sm flex flex-col h-full">
                  {/* Cover Image Placeholder or Real */}
                  <div className="relative w-full aspect-video bg-surface-container-high/30 overflow-hidden flex-shrink-0">
                    {(selectedImagePreviewUrl || formData.cover_image_url) ? (
                      <img src={selectedImagePreviewUrl || formData.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant/40">
                         <span className="material-symbols-outlined text-4xl mb-2">image</span>
                         <span className="text-xs font-bold uppercase tracking-wider">Cover Image</span>
                      </div>
                    )}
                    
                    {/* Category Badge over image */}
                    {formData.category && (
                      <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-on-background shadow-sm">
                        {formData.category.replace('_', ' ')}
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    {/* Date/Time */}
                    <div className="flex items-center gap-2 mb-3 text-primary text-xs font-bold uppercase tracking-wider">
                      <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                      <span>{formData.start_time ? new Date(formData.start_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}) : 'Date & Time'}</span>
                    </div>

                    {/* Title */}
                    <h3 className="font-headline font-bold text-xl text-on-background mb-2 line-clamp-2">
                      {formData.title || "Your Event Title"}
                    </h3>

                    {/* Location */}
                    <div className="flex items-center gap-2 text-on-surface-variant text-sm mb-4">
                      <span className="material-symbols-outlined text-[18px]">location_on</span>
                      <span className="truncate">{formData.location_name || "Event Location"}</span>
                    </div>

                    {/* Description (Preview) */}
                    <p className="text-on-surface-variant text-sm line-clamp-3 mb-6 flex-1 min-h-[60px]">
                      {formData.description || "Provide the exciting details about your event to attract students..."}
                    </p>

                    {/* Action button */}
                    <div className="mt-auto">
                      <div className="w-full py-3 rounded-xl bg-surface-container-low text-on-surface-variant font-bold text-sm border border-outline-variant/30 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">local_activity</span>
                        Get Tickets
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateEvent;

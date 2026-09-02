import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import PortalLayout from "../../layouts/PortalLayout";

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("new"); // "new" or "all"
  const [error, setError] = useState(null);
  const [actingId, setActingId] = useState(null);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    fetchInquiries();
    return () => {
      activeRef.current = false;
    };
  }, [filter]);

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      setError(null);
      let query = supabase.from("inquiries").select("*").order("created_at", { ascending: false });

      if (filter === "new") {
        query = query.eq("status", "new");
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (!activeRef.current) return;
      setInquiries(data || []);
    } catch (err) {
      console.error("Error fetching inquiries:", err);
      if (activeRef.current) setError("Failed to load inquiries.");
    } finally {
      if (activeRef.current) setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    if (actingId) return;
    setActingId(id);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("inquiries")
        .update({ status: newStatus })
        .eq("id", id);

      if (updateError) throw updateError;

      if (!activeRef.current) return;

      // Functional updates so concurrent status changes can't clobber each other.
      if (filter === "new" && newStatus !== "new") {
        setInquiries((prev) => prev.filter((inq) => inq.id !== id));
      } else {
        setInquiries((prev) =>
          prev.map((inq) => (inq.id === id ? { ...inq, status: newStatus } : inq))
        );
      }
    } catch (err) {
      console.error("Error updating status:", err);
      if (activeRef.current) setError("Failed to update status. Please try again.");
    } finally {
      if (activeRef.current) setActingId(null);
    }
  };

  const formatDateTime = (dateString) => {
    const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "new":
        return <span className="px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider rounded-md">New</span>;
      case "read":
        return <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-md">Read</span>;
      case "archived":
        return <span className="px-2 py-1 bg-gray-500/10 text-gray-600 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider rounded-md">Archived</span>;
      default:
        return null;
    }
  };

  const getTypeBadge = (type) => {
    const colors = {
      general: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      partner: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      event: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
      support: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    };
    const cssClass = colors[type] || colors.general;
    return (
      <span className={`px-2 py-1 ${cssClass} text-[10px] font-bold uppercase tracking-wider rounded-md`}>
        {type}
      </span>
    );
  };

  return (
    <PortalLayout portalType="admin">
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-headline font-black text-on-background">
            Inquiries Inbox
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Manage contact form submissions and partner applications.
          </p>
        </div>

        {/* Filter Toggle */}
        <div className="flex bg-surface-container-low border border-outline-variant/30 rounded-lg p-1">
          <button
            onClick={() => setFilter("new")}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
              filter === "new"
                ? "bg-surface shadow-sm text-on-background"
                : "text-on-surface-variant hover:text-on-background"
            }`}
          >
            New
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
              filter === "all"
                ? "bg-surface shadow-sm text-on-background"
                : "text-on-surface-variant hover:text-on-background"
            }`}
          >
            All History
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error/10 text-error px-4 py-3 rounded-xl text-sm font-medium mb-6">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-surface-container-low rounded-2xl w-full" />
          ))}
        </div>
      ) : inquiries.length === 0 ? (
        <div className="bg-surface-container-low border border-outline-variant/30 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant">
              inbox
            </span>
          </div>
          <h3 className="text-lg font-headline font-bold text-on-background mb-2">
            Inbox Zero
          </h3>
          <p className="text-on-surface-variant text-sm max-w-sm">
            {filter === "new"
              ? "You have no new inquiries. Enjoy the peace and quiet!"
              : "No inquiries have been submitted yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inquiry) => (
            <div
              key={inquiry.id}
              className={`bg-surface border ${
                inquiry.status === "new"
                  ? "border-primary/30 shadow-sm relative overflow-hidden"
                  : "border-outline-variant/20"
              } rounded-2xl p-5 md:p-6 transition-all hover:border-primary/40`}
            >
              {/* Highlight bar for new items */}
              {inquiry.status === "new" && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
              )}

              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left side: Meta info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {getStatusBadge(inquiry.status)}
                    {getTypeBadge(inquiry.inquiry_type)}
                    <span className="text-xs text-on-surface-variant font-medium">
                      {formatDateTime(inquiry.created_at)}
                    </span>
                  </div>

                  <h3 className="font-headline font-bold text-lg text-on-background mb-1">
                    {inquiry.name}
                  </h3>
                  
                  <div className="flex flex-col gap-1 mb-4">
                    <a
                      href={`mailto:${inquiry.email}`}
                      className="text-sm text-primary hover:underline flex items-center gap-1 w-fit"
                    >
                      <span className="material-symbols-outlined text-[14px]">mail</span>
                      {inquiry.email}
                    </a>
                    {inquiry.brand_name && (
                      <p className="text-sm text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">storefront</span>
                        Brand: <strong className="text-on-background">{inquiry.brand_name}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Middle: Message content */}
                <div className="flex-[2] bg-surface-container-low rounded-xl p-4">
                  <p className="text-sm text-on-background whitespace-pre-wrap leading-relaxed">
                    {inquiry.message}
                  </p>
                </div>

                {/* Right side: Actions */}
                <div className="flex lg:flex-col justify-end lg:justify-start gap-2 shrink-0">
                  <a
                    href={`mailto:${inquiry.email}?subject=Re: Uni Deals ${inquiry.inquiry_type.charAt(0).toUpperCase() + inquiry.inquiry_type.slice(1)} Inquiry`}
                    className="h-10 px-4 bg-primary text-on-primary font-bold text-sm rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-[18px]">reply</span>
                    Reply
                  </a>
                  
                  {inquiry.status === "new" && (
                    <button
                      onClick={() => updateStatus(inquiry.id, "read")}
                      disabled={actingId === inquiry.id}
                      className="h-10 px-4 bg-surface-container text-on-background font-bold text-sm rounded-lg flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[18px]">mark_email_read</span>
                      Mark Read
                    </button>
                  )}
                  
                  {inquiry.status !== "archived" && (
                    <button
                      onClick={() => updateStatus(inquiry.id, "archived")}
                      disabled={actingId === inquiry.id}
                      className="h-10 px-4 bg-surface-container text-on-background font-bold text-sm rounded-lg flex items-center justify-center gap-2 hover:bg-surface-container-high hover:text-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[18px]">archive</span>
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </PortalLayout>
  );
}

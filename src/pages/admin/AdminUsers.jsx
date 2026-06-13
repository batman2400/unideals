import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";

const ROLE_BADGE = {
  admin: "bg-purple-50 text-purple-700 border-purple-200",
  partner: "bg-primary-container/40 text-primary border-primary/20",
  student: "bg-surface-container text-on-surface-variant border-outline-variant/20",
};

const ROLE_FILTER_TABS = [
  { value: null, label: "All" },
  { value: "student", label: "Students" },
  { value: "partner", label: "Partners" },
  { value: "admin", label: "Admins" },
];

function AdminUsers() {
  const { role, loading: roleLoading } = useRoleContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [roleFilter, setRoleFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actingUserId, setActingUserId] = useState(null);
  const [brands, setBrands] = useState([]);

  // Promote form
  const [showPromote, setShowPromote] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoteBrandId, setPromoteBrandId] = useState("");
  const [promoting, setPromoting] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => () => { isMountedRef.current = false; }, []);

  const fetchUsers = useCallback(async () => {
    if (role !== "admin") return;
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase.rpc("list_users_with_roles", {
      search_query: searchQuery,
      role_filter: roleFilter,
      page_limit: 100,
      page_offset: 0,
    });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setUsers(data || []);
    setLoading(false);
  }, [role, searchQuery, roleFilter]);

  const fetchBrands = useCallback(async () => {
    if (role !== "admin") return;
    const { data } = await supabase.from("brands").select("id, name").order("name");
    setBrands(data || []);
  }, [role]);

  useEffect(() => {
    if (roleLoading) return;
    fetchUsers();
    fetchBrands();
  }, [roleLoading, fetchUsers, fetchBrands]);

  const showMsg = useCallback((text) => {
    setMessage(text);
    setTimeout(() => { if (isMountedRef.current) setMessage(""); }, 4000);
  }, []);

  const handlePromote = useCallback(async (e) => {
    e.preventDefault();
    if (!promoteEmail.trim() || !promoteBrandId) return;

    setPromoting(true);
    setError("");

    const { error: promoteError } = await supabase.rpc("promote_user_to_partner", {
      target_email: promoteEmail.trim(),
      target_brand_id: promoteBrandId,
    });

    if (!isMountedRef.current) return;

    if (promoteError) {
      setError(promoteError.message);
      setPromoting(false);
      return;
    }

    setPromoting(false);
    setShowPromote(false);
    setPromoteEmail("");
    setPromoteBrandId("");
    showMsg(`Promoted ${promoteEmail} to partner.`);
    fetchUsers();
  }, [promoteEmail, promoteBrandId, showMsg, fetchUsers]);

  const handleDemote = useCallback(async (userId, email) => {
    if (!window.confirm(`Demote ${email} back to student? Their partner profile will be removed.`)) return;

    setActingUserId(userId);
    const { error: demoteError } = await supabase.rpc("demote_user_to_student", {
      target_user_id: userId,
    });

    if (!isMountedRef.current) return;

    if (demoteError) {
      setError(demoteError.message);
      setActingUserId(null);
      return;
    }

    setActingUserId(null);
    showMsg(`${email} demoted to student.`);
    fetchUsers();
  }, [showMsg, fetchUsers]);

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
            User Management
          </h1>
          <p className="text-on-surface-variant text-sm">
            View all users, promote to partner, or demote back to student.
          </p>
        </div>
        <button
          onClick={() => setShowPromote(!showPromote)}
          className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-5 py-2.5 rounded-xl font-headline font-bold text-sm shadow-sm hover:shadow-md transition-all"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          Promote to Partner
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

      {/* Promote Form */}
      {showPromote && (
        <div className="mb-6 bg-surface rounded-2xl border border-primary/20 p-5 shadow-sm animate-slide-down">
          <h3 className="font-headline font-bold text-on-background mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">person_add</span>
            Promote User to Partner
          </h3>
          <form onSubmit={handlePromote} className="flex flex-col md:flex-row gap-3">
            <input
              type="email"
              value={promoteEmail}
              onChange={(e) => setPromoteEmail(e.target.value)}
              placeholder="User email address"
              required
              className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
            />
            <select
              value={promoteBrandId}
              onChange={(e) => setPromoteBrandId(e.target.value)}
              required
              className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
            >
              <option value="" disabled>Select Brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={promoting}
              className="inline-flex items-center justify-center gap-2 emerald-gradient text-on-primary px-6 py-3 rounded-xl font-headline font-bold text-sm shadow-sm disabled:opacity-60"
            >
              {promoting ? (
                <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-lg">check</span>
              )}
              Promote
            </button>
          </form>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by email or brand..."
            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
          />
        </div>
        <div className="flex bg-surface-container-low rounded-xl border border-outline-variant/15 p-1 gap-0.5">
          {ROLE_FILTER_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => setRoleFilter(tab.value)}
              className={`px-4 py-2 rounded-lg text-xs font-headline font-bold tracking-wide transition-all ${
                roleFilter === tab.value
                  ? "bg-surface text-on-background shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      {users.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">group_off</span>
          <p className="text-on-surface-variant text-sm">No users found.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-outline-variant/10 bg-surface-container-low/50">
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Role</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Verified</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Brand</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Joined</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/8">
                {users.map((u) => {
                  const badge = ROLE_BADGE[u.role] || ROLE_BADGE.student;
                  const isActing = actingUserId === u.user_id;

                  return (
                    <tr key={u.user_id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-on-background truncate max-w-[240px]">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${badge}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_verified ? (
                          <span className="material-symbols-outlined text-emerald-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                            verified
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-on-surface-variant/30 text-lg">
                            remove
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant">
                        {u.brand_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">
                        {new Date(u.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {u.role === "partner" && (
                            <button
                              onClick={() => handleDemote(u.user_id, u.email)}
                              disabled={isActing}
                              title="Demote to student"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">arrow_downward</span>
                              Demote
                            </button>
                          )}
                          {u.role === "admin" && (
                            <span className="text-xs text-on-surface-variant/50 py-1.5 px-3">Protected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}

export default AdminUsers;

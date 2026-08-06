import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import PortalLayout from "../../layouts/PortalLayout";

const ROLE_BADGE = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  partner: "bg-emerald-100 text-emerald-700 border-emerald-200",
  student: "bg-blue-100 text-blue-700 border-blue-200",
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
  const [inputValue, setInputValue] = useState("");
  const [actingUserId, setActingUserId] = useState(null);
  const [brands, setBrands] = useState([]);

  // Promote form
  const [showPromote, setShowPromote] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoteBrandId, setPromoteBrandId] = useState("");
  const [promoting, setPromoting] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const fetchUsers = useCallback(async () => {
    if (role !== "admin") return;
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase.rpc(
      "list_users_with_roles",
      {
        search_query: searchQuery,
        role_filter: roleFilter,
        page_limit: 100,
        page_offset: 0,
      },
    );

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
    const { data, error: brandsError } = await supabase
      .from("brands")
      .select("id, name")
      .order("name");

    if (brandsError) {
      console.error("Failed to load brands:", brandsError);
      setError("Couldn't load the brand list. Promotion is unavailable until this loads.");
      return;
    }

    setBrands(data || []);
  }, [role]);

  useEffect(() => {
    if (roleLoading) return;
    fetchUsers();
    fetchBrands();
  }, [roleLoading, fetchUsers, fetchBrands]);

  const showMsg = useCallback((text) => {
    setMessage(text);
    setTimeout(() => {
      if (isMountedRef.current) setMessage("");
    }, 4000);
  }, []);

  const handlePromote = useCallback(
    async (e) => {
      e.preventDefault();
      if (!promoteEmail.trim() || !promoteBrandId || promoting) return;

      const brandName =
        brands.find((b) => b.id === promoteBrandId)?.name || "the selected brand";
      if (
        !window.confirm(
          `Grant partner access for ${brandName} to ${promoteEmail.trim()}? They will be able to create deals and scan redemptions.`,
        )
      ) {
        return;
      }

      setPromoting(true);
      setError("");

      const { error: promoteError } = await supabase.rpc(
        "promote_user_to_partner",
        {
          target_email: promoteEmail.trim(),
          target_brand_id: promoteBrandId,
        },
      );

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
    },
    [promoteEmail, promoteBrandId, promoting, brands, showMsg, fetchUsers],
  );

  const handleDemote = useCallback(
    async (userId, email) => {
      if (
        !window.confirm(
          `Demote ${email} back to student? Their partner profile will be removed.`,
        )
      )
        return;

      setActingUserId(userId);
      const { error: demoteError } = await supabase.rpc(
        "demote_user_to_student",
        {
          target_user_id: userId,
        },
      );

      if (!isMountedRef.current) return;

      if (demoteError) {
        setError(demoteError.message);
        setActingUserId(null);
        return;
      }

      setActingUserId(null);
      showMsg(`${email} demoted to student.`);
      fetchUsers();
    },
    [showMsg, fetchUsers],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue]);

  if (roleLoading) {
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
            <span className="material-symbols-outlined text-primary text-lg">
              person_add
            </span>
            Promote User to Partner
          </h3>
          <form
            onSubmit={handlePromote}
            className="flex flex-col md:flex-row gap-3"
          >
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
              <option value="" disabled>
                Select Brand
              </option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
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
      {loading ? (
        <div className="h-96 rounded-2xl skeleton-shimmer" />
      ) : users.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">
            group_off
          </span>
          <p className="text-on-surface-variant text-sm">No users found.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full block md:table">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-outline-variant/10 bg-surface-container-low/50 block md:table-row">
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Verified
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Brand
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Joined
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-on-surface-variant uppercase block md:table-cell">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group divide-y divide-outline-variant/8">
                {users.map((u) => {
                  const badge = ROLE_BADGE[u.role] || ROLE_BADGE.student;
                  const isActing = actingUserId === u.user_id;

                  return (
                    <tr
                      key={u.user_id}
                      className="block md:table-row p-4 md:p-0 hover:bg-surface-container-low/30 transition-colors"
                    >
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Email
                        </span>
                        <div className="flex items-center justify-end md:justify-start gap-2 overflow-hidden w-full max-w-[200px] md:max-w-[240px]">
                          <p 
                            className="text-sm font-bold text-on-background truncate"
                            title={u.email}
                          >
                            {u.email}
                          </p>
                          <button 
                            onClick={() => navigator.clipboard.writeText(u.email)}
                            title="Copy Email"
                            className="text-on-surface-variant/40 hover:text-on-surface-variant transition-colors flex-shrink-0 flex"
                          >
                            <span className="material-symbols-outlined text-[14px]">content_copy</span>
                          </button>
                        </div>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Role
                        </span>
                        <span
                          className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${badge}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Verified
                        </span>
                        {u.is_verified ? (
                          <span
                            className="material-symbols-outlined text-emerald-500 text-lg"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            verified
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-on-surface-variant/30 text-lg">
                            remove
                          </span>
                        )}
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-sm text-on-surface-variant">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Brand
                        </span>
                        <span className="text-right md:text-left">
                          {u.brand_name || "—"}
                        </span>
                      </td>
                      <td className="flex justify-between items-center md:table-cell px-0 md:px-4 py-2 md:py-3 border-b border-outline-variant/5 md:border-none text-xs text-on-surface-variant">
                        <span className="md:hidden text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                          Joined
                        </span>
                        <span>
                          {new Date(u.created_at).toLocaleDateString(
                            undefined,
                            { dateStyle: "medium" },
                          )}
                        </span>
                      </td>
                      <td className="flex justify-end items-center md:table-cell px-0 md:px-4 py-3 md:py-3 mt-2 md:mt-0">
                        <div className="flex justify-end gap-1.5 w-full md:w-auto">
                          {u.role === "partner" && (
                            <button
                              onClick={() => handleDemote(u.user_id, u.email)}
                              disabled={isActing}
                              title="Demote to student"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">
                                arrow_downward
                              </span>
                              Demote
                            </button>
                          )}
                          {u.role === "student" && (
                            <button
                              onClick={() => {
                                setPromoteEmail(u.email);
                                setShowPromote(true);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              disabled={isActing}
                              title="Promote to Partner"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">
                                person_add
                              </span>
                              Promote
                            </button>
                          )}
                          {u.role === "admin" && (
                            <span className="text-xs font-bold text-on-surface-variant/50 py-1.5 px-3 uppercase tracking-wider">
                              Protected
                            </span>
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

import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * useRole
 *
 * Resolves the authenticated user and role from Supabase.
 * Role source of truth is the database helper function `get_user_role()`.
 */
export function useRole() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const roleChannelRef = useRef(null);

  useEffect(() => {
    let active = true;

    function detachRoleChannel() {
      if (roleChannelRef.current) {
        supabase.removeChannel(roleChannelRef.current);
        roleChannelRef.current = null;
      }
    }

    function attachRoleChannel(userId) {
      detachRoleChannel();

      if (!userId) {
        return;
      }

      roleChannelRef.current = supabase
        .channel(`user-role-sync-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_roles",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            resolveRole();
          }
        )
        .subscribe();
    }

    async function resolveRole(sessionOverride = null) {
      if (!active) return;

      setLoading(true);
      setError(null);

      try {
        let session = sessionOverride;

        if (!session) {
          const {
            data: { session: currentSession },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError) {
            throw sessionError;
          }

          session = currentSession;
        }

        const nextUser = session?.user ?? null;

        if (!active) return;

        setUser(nextUser);
        attachRoleChannel(nextUser?.id ?? null);

        if (!nextUser) {
          setRole(null);
          setLoading(false);
          return;
        }

        const { data: rpcRole, error: rpcError } = await supabase.rpc("get_user_role");

        if (!active) return;

        if (rpcError) {
          const { data: roleRow, error: roleQueryError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", nextUser.id)
            .maybeSingle();

          if (roleQueryError) {
            throw roleQueryError;
          }

          setRole(roleRow?.role ?? "student");
          setLoading(false);
          return;
        }

        setRole(rpcRole ?? "student");
        setLoading(false);
      } catch (err) {
        if (!active) return;
        // Preserve the last known role on transient failures.
        setError(err?.message || "Failed to load user role.");
        setLoading(false);
      }
    }

    resolveRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveRole(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      detachRoleChannel();
    };
  }, [refreshKey]);

  const refreshRole = () => {
    setRefreshKey((previous) => previous + 1);
  };

  return {
    user,
    role,
    loading,
    error,
    isAuthenticated: !!user,
    refreshRole,
  };
}

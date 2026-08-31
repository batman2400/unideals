import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  isStudentVerificationCurrent,
  isStudentVerificationExpired,
  isStudentVerificationExpiringSoon,
} from "./studentVerification";

/**
 * useRole
 *
 * Resolves the authenticated user and role from Supabase.
 * Role source of truth is the database helper function `get_user_role()`.
 */
export function useRole() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const hasInitialResolvedRef = useRef(false);
  const roleChannelRef = useRef(null);
  const roleChannelUserIdRef = useRef(null);
  const roleChannelSequenceRef = useRef(0);
  const roleChannelInstanceIdRef = useRef(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  );

  useEffect(() => {
    let active = true;

    function detachRoleChannel() {
      if (roleChannelRef.current) {
        supabase.removeChannel(roleChannelRef.current);
        roleChannelRef.current = null;
      }

      roleChannelUserIdRef.current = null;
    }

    function attachRoleChannel(userId) {
      if (!userId) {
        detachRoleChannel();
        return;
      }

      // Keep existing subscription when the authenticated user hasn't changed.
      if (roleChannelRef.current && roleChannelUserIdRef.current === userId) {
        return;
      }

      detachRoleChannel();

      roleChannelSequenceRef.current += 1;
      const channelName = [
        "user-role-sync",
        userId,
        roleChannelInstanceIdRef.current,
        roleChannelSequenceRef.current,
      ].join("-");

      roleChannelRef.current = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_roles",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            resolveRole(null, true);
          },
        )
        .subscribe((status) => {
          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            resolveRole(null, true);
          }
        });

      roleChannelUserIdRef.current = userId;
    }

    async function resolveRole(sessionOverride = null, isBackgroundRefresh = false) {
      if (!active) return;

      if (!isBackgroundRefresh && !hasInitialResolvedRef.current) {
        setLoading(true);
      }
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
          setIsVerified(false);
          setVerifiedAt(null);
          setLoading(false);
          hasInitialResolvedRef.current = true;
          return;
        }

        try {
          await supabase.rpc("expire_stale_student_verifications");
        } catch {
          // SQL may not be applied yet; client still enforces the 12-month window.
        }

        const { data: rpcRole, error: rpcError } =
          await supabase.rpc("get_user_role");

        if (!active) return;

        let resolvedRole = rpcRole ?? "student";
        let resolvedIsVerified = false;
        let resolvedVerifiedAt = null;

        let { data: roleRow, error: roleQueryError } = await supabase
          .from("user_roles")
          .select("role, is_verified, verified_at")
          .eq("user_id", nextUser.id)
          .maybeSingle();

        if (roleQueryError && /verified_at/i.test(roleQueryError.message ?? "")) {
          const retry = await supabase
            .from("user_roles")
            .select("role, is_verified")
            .eq("user_id", nextUser.id)
            .maybeSingle();
          roleRow = retry.data;
          roleQueryError = retry.error;
        }

        if (roleQueryError) {
          // Legacy fallback for environments where `is_verified` is not deployed yet.
          const { data: legacyRoleRow, error: legacyRoleError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", nextUser.id)
            .maybeSingle();

          if (legacyRoleError && rpcError) {
            throw legacyRoleError;
          }

          if (rpcError) {
            resolvedRole = legacyRoleRow?.role ?? "student";
          }
        } else {
          if (rpcError) {
            resolvedRole = roleRow?.role ?? "student";
          }
          resolvedVerifiedAt =
            typeof roleRow?.verified_at === "string" ? roleRow.verified_at : null;
          const verifiedFlag = !!roleRow?.is_verified;
          resolvedIsVerified =
            resolvedRole === "student"
              ? isStudentVerificationCurrent(verifiedFlag, resolvedVerifiedAt)
              : verifiedFlag;
        }

        setRole(resolvedRole);
        setIsVerified(resolvedIsVerified);
        setVerifiedAt(resolvedVerifiedAt);
        setLoading(false);
        hasInitialResolvedRef.current = true;
      } catch (err) {
        if (!active) return;
        // Preserve the last known role on transient failures.
        setError(err?.message || "Failed to load user role.");
        setLoading(false);
        hasInitialResolvedRef.current = true;
      }
    }

    resolveRole(null, false);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Prevent disruptive loading spinners on background token refreshes
      const isBackground = event === "TOKEN_REFRESHED" || event === "USER_UPDATED";
      resolveRole(session, isBackground);
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

  const isStudent = role === "student";
  const isVerificationExpired =
    isStudent && isStudentVerificationExpired(verifiedAt);
  const isVerificationExpiringSoon =
    isStudent && isStudentVerificationExpiringSoon(isVerified, verifiedAt);

  return {
    user,
    role,
    isVerified,
    verifiedAt,
    isVerificationExpired,
    isVerificationExpiringSoon,
    loading,
    error,
    isAuthenticated: !!user,
    refreshRole,
  };
}

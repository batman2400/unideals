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
 * Session is ready as soon as Auth returns. Role comes from public.user_roles
 * (same source as get_user_role()). Do not block first paint on the yearly
 * expiry sweep — cron plus client-side isStudentVerificationCurrent cover it.
 */
const ROLE_CACHE_KEY = "unideals_cached_role_v1";

function readRoleCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.role === "string") {
      return parsed;
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

function writeRoleCache(data) {
  if (typeof window === "undefined") return;
  try {
    if (!data) {
      sessionStorage.removeItem(ROLE_CACHE_KEY);
    } else {
      sessionStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore storage write errors
  }
}

function verificationFromRoleRow(roleName, row, previousVerifiedAt = null) {
  const verifiedAt =
    typeof row?.verified_at === "string" ? row.verified_at : previousVerifiedAt;
  const hasFlag =
    row != null && Object.prototype.hasOwnProperty.call(row, "is_verified");
  const verifiedFlag = hasFlag ? !!row.is_verified : false;
  const isVerified =
    roleName === "student"
      ? isStudentVerificationCurrent(verifiedFlag, verifiedAt)
      : verifiedFlag;
  return { isVerified, verifiedAt };
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function readRoleRow(userId) {
  let { data: roleRow, error: roleQueryError } = await supabase
    .from("user_roles")
    .select("role, is_verified, verified_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleQueryError && /verified_at/i.test(roleQueryError.message ?? "")) {
    const retry = await supabase
      .from("user_roles")
      .select("role, is_verified")
      .eq("user_id", userId)
      .maybeSingle();
    roleRow = retry.data;
    roleQueryError = retry.error;
  }

  if (roleQueryError) throw roleQueryError;
  return roleRow;
}

/**
 * The access token is stored before subscribers run, but a query started
 * inside onAuthStateChange can still go out anonymously. Wait until the
 * client session matches the user we just signed in.
 */
async function waitForAccessToken(userId) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id === userId && data.session.access_token) {
      return true;
    }
    await delay(80 * (attempt + 1));
  }
  return false;
}

function clearRoleState(setters) {
  writeRoleCache(null);
  setters.setUser(null);
  setters.setRole(null);
  setters.setIsVerified(false);
  setters.setVerifiedAt(null);
  setters.setError(null);
  setters.setLoading(false);
}

export function useRole() {
  const initialCache = readRoleCache();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(initialCache?.role || null);
  const [isVerified, setIsVerified] = useState(initialCache?.isVerified || false);
  const [verifiedAt, setVerifiedAt] = useState(initialCache?.verifiedAt || null);
  // Cache may seed chrome, but verification is not finished until user_roles is read.
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState(null);
  const [sessionUser, setSessionUser] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const userIdRef = useRef(null);
  const staleExpiryStartedRef = useRef(false);
  const channelRunRef = useRef(0);
  const roleChannelInstanceIdRef = useRef(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  );

  useEffect(() => {
    let active = true;
    let authEventSeen = false;

    function applySession(event, session) {
      const signedOut =
        event === "SIGNED_OUT" || event === "TOKEN_REFRESH_FAILED";
      const nextUser = signedOut ? null : session?.user ?? null;

      // A late INITIAL_SESSION from before sign-in can arrive with a null
      // session and wipe the user the SIGNED_IN event just stored. Refresh
      // then looks fine because storage already has the new session.
      if (!signedOut && !nextUser && userIdRef.current) return;

      const nextId = nextUser?.id ?? null;
      const changed = userIdRef.current !== nextId;
      userIdRef.current = nextId;

      setSessionUser((previous) => {
        if (!nextUser) return null;
        if (previous?.id === nextUser.id) return previous;
        return nextUser;
      });
      setUser((previous) => {
        if (!nextUser) return null;
        if (previous?.id === nextUser.id) return previous;
        return nextUser;
      });

      if (!nextUser) {
        clearRoleState({
          setUser,
          setRole,
          setIsVerified,
          setVerifiedAt,
          setError,
          setLoading,
        });
      } else if (changed) {
        const cache = readRoleCache();
        if (cache?.userId !== nextId) {
          setRole(null);
          setIsVerified(false);
          setVerifiedAt(null);
        }
        setLoading(true);
        setError(null);
      }

      setAuthReady(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      authEventSeen = true;
      // Only touch React state here. Querying user_roles from this callback
      // deadlocks the Supabase auth lock, so the portal never appears until
      // a full reload starts a fresh client.
      applySession(event, session);
    });

    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active || authEventSeen) return;
        if (sessionError?.message?.includes("Refresh Token")) {
          void supabase.auth.signOut({ scope: "local" }).catch(() => {});
          applySession("SIGNED_OUT", null);
          return;
        }
        applySession("INITIAL_SESSION", data.session ?? null);
      })
      .catch((err) => {
        if (!active || authEventSeen) return;
        if (err?.message?.includes("Refresh Token")) {
          void supabase.auth.signOut({ scope: "local" }).catch(() => {});
        }
        applySession("INITIAL_SESSION", null);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    let active = true;
    const userId = sessionUser?.id ?? null;
    let channel = null;

    async function loadRole(background) {
      if (!userId) {
        if (!active) return;
        clearRoleState({
          setUser,
          setRole,
          setIsVerified,
          setVerifiedAt,
          setError,
          setLoading,
        });
        return;
      }

      if (!background) {
        const cache = readRoleCache();
        if (cache?.userId !== userId) {
          setRole(null);
          setIsVerified(false);
          setVerifiedAt(null);
        }
        setLoading(true);
      }
      setError(null);

      try {
        await waitForAccessToken(userId);
        if (!active) return;

        if (!staleExpiryStartedRef.current) {
          staleExpiryStartedRef.current = true;
          void supabase.rpc("expire_stale_student_verifications").catch(() => {});
        }

        // An anonymous read returns no row, and get_user_role() then falls
        // back to "student", which hides Admin / Partner until a reload.
        let roleRow = null;
        let roleReadError = null;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          try {
            roleRow = await readRoleRow(userId);
            roleReadError = null;
            if (roleRow?.role) break;
          } catch (readError) {
            roleRow = null;
            roleReadError = readError;
          }
          if (attempt < 3) {
            await delay(150 * (attempt + 1));
            if (!active) return;
          }
        }

        let resolvedRole = roleRow?.role ?? null;
        let resolvedRow = roleRow;

        if (!resolvedRole) {
          const { data: rpcRole, error: rpcError } =
            await supabase.rpc("get_user_role");
          if (!active) return;
          if (rpcError) throw roleReadError || rpcError;
          resolvedRole = rpcRole || "student";
          resolvedRow = roleRow;
        }

        const fromRow = verificationFromRoleRow(resolvedRole, resolvedRow, null);
        if (!active) return;

        writeRoleCache({
          userId,
          role: resolvedRole,
          isVerified: fromRow.isVerified,
          verifiedAt: fromRow.verifiedAt,
        });
        setRole(resolvedRole);
        setIsVerified(fromRow.isVerified);
        setVerifiedAt(fromRow.verifiedAt);
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Failed to load user role.");
        setLoading(false);
      }
    }

    channelRunRef.current += 1;
    void loadRole(false);

    if (userId) {
      channel = supabase
        .channel(
          [
            "user-role-sync",
            userId,
            roleChannelInstanceIdRef.current,
            channelRunRef.current,
          ].join("-"),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_roles",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            if (active) void loadRole(true);
          },
        )
        .subscribe();
    }

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [authReady, sessionUser, refreshKey]);

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
    authReady,
    error,
    isAuthenticated: !!user,
    refreshRole,
  };
}

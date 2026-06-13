/**
 * RoleContext
 *
 * Provides a single, shared instance of the useRole() hook
 * to all components via React Context. This eliminates the
 * problem of each component independently opening its own
 * Supabase Realtime channel, polling loop, and network requests.
 *
 * Usage:
 *   // Wrap your app:
 *   <RoleProvider><App /></RoleProvider>
 *
 *   // In any component:
 *   const { role, isVerified, ... } = useRoleContext();
 */
import { createContext, useContext, useState } from "react";
import { useRole } from "./useRole";

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const roleState = useRole();
  const [impersonatedPartnerId, setImpersonatedPartnerId] = useState(null);

  return (
    <RoleContext.Provider
      value={{ ...roleState, impersonatedPartnerId, setImpersonatedPartnerId }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRoleContext() {
  const context = useContext(RoleContext);
  if (context === null) {
    throw new Error("useRoleContext must be used within a <RoleProvider>");
  }
  return context;
}

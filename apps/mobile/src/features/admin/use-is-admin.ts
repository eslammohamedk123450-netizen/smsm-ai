import { useEffect, useState } from "react";
import { useAuth } from "../auth/auth-provider";
import { supabase } from "../../lib/supabase/client";

/**
 * Read-only admin hint used only to decide whether to render the dashboard entry.
 * It is never the authorization boundary: the admin layout re-checks
 * `suly_is_admin()` and RLS/RPC still enforce every write.
 */
export function useIsAdmin(): boolean {
  const { user, status } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    if (status !== "authenticated" || !user) {
      setIsAdmin(false);
      return () => {
        active = false;
      };
    }
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("suly_is_admin");
        if (active) setIsAdmin(!error && data === true);
      } catch {
        if (active) setIsAdmin(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id, status]);

  return isAdmin;
}

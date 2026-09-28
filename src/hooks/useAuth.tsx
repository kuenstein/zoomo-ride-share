import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type DriverRow = Database["public"]["Tables"]["drivers"]["Row"];

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  driver: DriverRow | null;
  loading: boolean;
  isAdmin: boolean;
  isDriver: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      setRoles([]);
      setDriver(null);
      return;
    }
    const [p, r, d] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("drivers").select("*").eq("user_id", uid).maybeSingle(),
    ]);
    setProfile(p.data ?? null);
    setRoles((r.data ?? []).map((x) => x.role));
    setDriver(d.data ?? null);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => void load(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
        setDriver(null);
      }
    });
    void (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      await load(data.session?.user.id);
      setLoading(false);
    })();
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await load(data.session?.user.id);
  }, [load]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setRoles([]);
    setDriver(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      roles,
      driver,
      loading,
      isAdmin: roles.includes("admin"),
      isDriver: roles.includes("driver"),
      refresh,
      signOut,
    }),
    [session, profile, roles, driver, loading, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

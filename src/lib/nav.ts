import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppMode = "rider" | "driver";
const MODE_KEY = "zoomo-mode";

export type AppHome = "/ride" | "/driver" | "/admin";

/** Default landing screen for a user based on their roles. */
export function homeForRoles(roles: string[]): AppHome {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("driver")) return "/driver";
  return "/ride";
}

/** Look up the signed-in user's roles and return their home screen. */
export async function fetchHome(userId: string): Promise<AppHome> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return homeForRoles((data ?? []).map((r) => r.role));
}

/** Only allow same-app relative redirects (prevents open redirects). */
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  if (value.startsWith("/auth") || value.startsWith("/signup")) return undefined;
  return value;
}

export function getStoredMode(): AppMode | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(MODE_KEY);
  return v === "driver" || v === "rider" ? v : null;
}

export function setStoredMode(mode: AppMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MODE_KEY, mode);
  window.dispatchEvent(new Event("zoomo-mode"));
}

const DRIVER_PATHS = ["/driver"];
const RIDER_PATHS = ["/ride", "/activity", "/wallet", "/places", "/promos"];

/** Current app mode: derived from the page, falling back to the last mode used. */
export function useAppMode(pathname: string, isDriver: boolean): AppMode {
  const [stored, setStored] = useState<AppMode | null>(null);
  useEffect(() => {
    const sync = () => setStored(getStoredMode());
    sync();
    window.addEventListener("zoomo-mode", sync);
    return () => window.removeEventListener("zoomo-mode", sync);
  }, []);

  const fromPath: AppMode | null = DRIVER_PATHS.some((p) => pathname.startsWith(p))
    ? "driver"
    : RIDER_PATHS.some((p) => pathname.startsWith(p))
      ? "rider"
      : null;

  useEffect(() => {
    if (fromPath && fromPath !== getStoredMode()) setStoredMode(fromPath);
  }, [fromPath]);

  if (fromPath) return fromPath;
  if (stored) return stored === "driver" && !isDriver ? "rider" : stored;
  return isDriver ? "driver" : "rider";
}

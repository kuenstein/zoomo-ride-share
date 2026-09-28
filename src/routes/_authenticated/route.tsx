import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ActiveRideBanner } from "@/components/ActiveRideBanner";
import { useAuth } from "@/hooks/useAuth";
import { useAppMode } from "@/lib/nav";
import { useEffect } from "react";
import { ConsentGate } from "@/components/ConsentGate";
import { registerSW } from "@/lib/push-client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isDriver } = useAuth();
  const mode = useAppMode(pathname, isDriver);
  const isAdmin = pathname.startsWith("/admin");
  const showBanner = mode === "rider" && !isAdmin && pathname !== "/ride";
  useEffect(() => {
    void registerSW().catch(() => undefined);
  }, []);

  return (
    <div className={`min-h-screen bg-background ${isAdmin ? "" : "pb-[68px]"}`}>
      {showBanner && <ActiveRideBanner />}
      <Outlet />
      <ConsentGate />
      {!isAdmin && <BottomNav />}
    </div>
  );
}

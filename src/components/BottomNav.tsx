import { Link, useRouterState } from "@tanstack/react-router";
import { Car, Clock, Wallet, User, Gauge, History, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAppMode } from "@/lib/nav";

const RIDER_ITEMS = [
  { to: "/ride", label: "Book", icon: Car },
  { to: "/activity", label: "Activity", icon: Clock },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/account", label: "Account", icon: User },
] as const;

const DRIVER_ITEMS = [
  { to: "/driver", label: "Dashboard", icon: Gauge },
  { to: "/driver/trips", label: "Trips", icon: History },
  { to: "/driver/earnings", label: "Earnings", icon: TrendingUp },
  { to: "/account", label: "Account", icon: User },
] as const;

export function BottomNav() {
  const { isDriver } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mode = useAppMode(pathname, isDriver);
  const items = mode === "driver" ? DRIVER_ITEMS : RIDER_ITEMS;

  return (
    <nav
      aria-label={mode === "driver" ? "Driver navigation" : "Rider navigation"}
      className="fixed inset-x-0 bottom-0 z-[500] border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            // Exact match for /driver so Dashboard isn't active on /driver/trips
            activeOptions={{ exact: to === "/driver" }}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors"
            activeProps={{ className: "text-accent" }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

import { Link } from "@tanstack/react-router";
import { Car, Clock, Wallet, User, Gauge, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function BottomNav() {
  const { isDriver, isAdmin } = useAuth();

  const items = [
    { to: "/ride", label: "Ride", icon: Car },
    { to: "/activity", label: "Activity", icon: Clock },
    { to: "/wallet", label: "Wallet", icon: Wallet },
    ...(isDriver ? [{ to: "/driver", label: "Drive", icon: Gauge }] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield }] : []),
    { to: "/account", label: "Account", icon: User },
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[500] border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
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

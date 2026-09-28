import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-foreground">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 17h2m12 0h2M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm10 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />
          <path d="M3 13l2-5h11l3 5v4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      Zoomo
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-8 text-center">
      <p className="font-semibold">{title}</p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

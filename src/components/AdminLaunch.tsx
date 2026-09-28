import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Phone, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/Brand";
import { DOC_TYPES, openSignedDoc, type DriverDoc } from "@/components/DriverDocuments";
import { reportCategoryLabel } from "@/components/ReportProblem";
import { formatDateTime, formatMoney } from "@/lib/geo";
import { formatPhMobile } from "@/lib/locale";
import { getLaunchChecklist } from "@/lib/launch.functions";

/* ---------------- Driver documents review ---------------- */
export function DriverDocsReview({ userId, licenseExpiry, driverId }: { userId: string; licenseExpiry: string | null; driverId: string }) {
  const qc = useQueryClient();
  const [expiry, setExpiry] = useState(licenseExpiry ?? "");
  const { data: docs } = useQuery({
    queryKey: ["admin-docs", userId],
    queryFn: async () => ((await supabase.from("driver_documents").select("*").eq("user_id", userId)).data ?? []) as DriverDoc[],
  });
  const review = async (doc: DriverDoc, status: "approved" | "rejected") => {
    let notes: string | null = null;
    if (status === "rejected") {
      notes = window.prompt("Reason (shown to the driver)")?.trim() ?? "";
      if (!notes) return;
    }
    const { error } = await supabase.from("driver_documents").update({ status, reviewer_notes: notes }).eq("id", doc.id);
    if (error) return toast.error("Couldn't update document");
    toast.success(`Document ${status}`);
    void qc.invalidateQueries({ queryKey: ["admin-docs", userId] });
  };
  const saveExpiry = async () => {
    const { error } = await supabase.from("drivers").update({ license_expiry: expiry || null }).eq("id", driverId);
    if (error) return toast.error("Couldn't save expiry");
    toast.success("License expiry saved");
    void qc.invalidateQueries({ queryKey: ["admin-drivers"] });
  };
  const expired = !!expiry && expiry < new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  return (
    <div className="mt-2 space-y-1.5 rounded-xl bg-secondary/60 p-2">
      {DOC_TYPES.map((t) => {
        const d = docs?.find((x) => x.doc_type === t.type);
        return (
          <div key={t.type} className="flex items-center gap-2 text-xs">
            <span className="flex-1">{t.label}</span>
            {!d ? (
              <Badge variant="outline">missing</Badge>
            ) : (
              <>
                <Badge variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>{d.status}</Badge>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => void openSignedDoc(d.storage_path)} aria-label="Preview">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                {d.status !== "approved" && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-accent" onClick={() => void review(d, "approved")} aria-label="Approve document">
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                )}
                {d.status !== "rejected" && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => void review(d, "rejected")} aria-label="Reject document">
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        );
      })}
      <div className="flex items-center gap-2 pt-1 text-xs">
        <span className={expired ? "font-semibold text-destructive" : ""}>License expiry{expired ? " (expired)" : ""}</span>
        <Input type="date" className="h-8 flex-1" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        <Button size="sm" variant="outline" className="h-8" onClick={saveExpiry}>
          Save
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Safety incidents ---------------- */
export function useOpenIncidentCount() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["open-incidents-count"],
    queryFn: async () => {
      const { count } = await supabase.from("safety_incidents").select("id", { count: "exact", head: true }).neq("status", "resolved");
      return count ?? 0;
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel("admin-incidents")
      .on("postgres_changes", { event: "*", schema: "public", table: "safety_incidents" }, (p) => {
        void qc.invalidateQueries({ queryKey: ["open-incidents-count"] });
        void qc.invalidateQueries({ queryKey: ["admin-incidents"] });
        if (p.eventType === "INSERT") toast.error("New SOS alert!", { duration: 15000 });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);
  return q.data ?? 0;
}

export function SafetyAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-incidents"],
    queryFn: async () => {
      const { data: inc } = await supabase.from("safety_incidents").select("*").order("created_at", { ascending: false }).limit(100);
      const rideIds = [...new Set((inc ?? []).map((i) => i.ride_id))];
      const { data: rides } = rideIds.length ? await supabase.from("rides").select("*").in("id", rideIds) : { data: [] };
      const people = [...new Set((rides ?? []).flatMap((r) => [r.rider_id, r.driver_id]).filter(Boolean) as string[])];
      const { data: profiles } = people.length ? await supabase.from("profiles").select("id,full_name,phone").in("id", people) : { data: [] };
      const prof = (id: string | null) => (profiles ?? []).find((p) => p.id === id);
      const rank = (s: string) => (s === "open" ? 0 : s === "acknowledged" ? 1 : 2);
      return (inc ?? [])
        .map((i) => {
          const ride = (rides ?? []).find((r) => r.id === i.ride_id);
          return { ...i, ride, rider: prof(ride?.rider_id ?? null), driver: prof(ride?.driver_id ?? null) };
        })
        .sort((a, b) => rank(a.status) - rank(b.status) || b.created_at.localeCompare(a.created_at));
    },
  });
  const update = async (id: string, patch: { status?: string; notes?: string }) => {
    const { error } = await supabase
      .from("safety_incidents")
      .update({ ...patch, ...(patch.status === "resolved" ? { resolved_at: new Date().toISOString() } : {}) })
      .eq("id", id);
    if (error) return toast.error("Couldn't update incident");
    toast.success("Incident updated");
    void qc.invalidateQueries({ queryKey: ["admin-incidents"] });
    void qc.invalidateQueries({ queryKey: ["open-incidents-count"] });
  };
  if (isLoading) return <Skeleton className="h-24 w-full rounded-2xl" />;
  if (!data?.length) return <EmptyState title="No safety incidents" description="SOS alerts from riders and drivers show up here instantly." />;
  return (
    <div className="space-y-2">
      {data.map((i) => (
        <div key={i.id} className={`rounded-2xl border p-3 ${i.status === "open" ? "border-destructive bg-destructive/10" : "border-border"}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">SOS by {i.reporter_role} · {formatDateTime(i.created_at)}</p>
              <p className="text-xs text-muted-foreground">
                {i.ride?.pickup_address} → {i.ride?.dropoff_address}
              </p>
            </div>
            <Badge variant={i.status === "open" ? "destructive" : "secondary"}>{i.status}</Badge>
          </div>
          <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            {[
              ["Rider", i.rider],
              ["Driver", i.driver],
            ].map(([label, p]) => {
              const person = p as { full_name: string; phone: string | null } | undefined;
              return (
                <p key={label as string}>
                  <span className="text-muted-foreground">{label as string}:</span> {person?.full_name ?? "—"}{" "}
                  {person?.phone && (
                    <a href={`tel:${person.phone}`} className="inline-flex items-center gap-0.5 text-accent">
                      <Phone className="h-3 w-3" /> {formatPhMobile(person.phone)}
                    </a>
                  )}
                </p>
              );
            })}
          </div>
          {i.lat != null && (
            <a className="mt-1 inline-block text-xs text-accent" href={`https://maps.google.com/?q=${i.lat},${i.lng}`} target="_blank" rel="noreferrer">
              Open SOS location in Maps
            </a>
          )}
          <IncidentNotes initial={i.notes ?? ""} onSave={(notes) => update(i.id, { notes })} />
          <div className="mt-2 flex gap-2">
            {i.status === "open" && (
              <Button size="sm" variant="outline" className="flex-1" onClick={() => void update(i.id, { status: "acknowledged" })}>
                Acknowledge
              </Button>
            )}
            {i.status !== "resolved" && (
              <Button size="sm" className="flex-1" onClick={() => void update(i.id, { status: "resolved" })}>
                Resolve
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function IncidentNotes({ initial, onSave }: { initial: string; onSave: (n: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="mt-2 flex gap-2">
      <Textarea rows={1} value={v} onChange={(e) => setV(e.target.value)} placeholder="Admin notes" maxLength={2000} className="min-h-9 text-xs" />
      <Button size="sm" variant="outline" onClick={() => onSave(v)} disabled={v === initial}>
        Save
      </Button>
    </div>
  );
}

/* ---------------- Reports ---------------- */
export function ReportsAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data: reps } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
      const ids = [...new Set((reps ?? []).map((r) => r.reporter_id))];
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,full_name,phone").in("id", ids) : { data: [] };
      const rideIds = [...new Set((reps ?? []).map((r) => r.ride_id))];
      const { data: rides } = rideIds.length ? await supabase.from("rides").select("id,rider_id,driver_id,final_fare,dropoff_address,completed_at").in("id", rideIds) : { data: [] };
      return (reps ?? []).map((r) => {
        const ride = (rides ?? []).find((x) => x.id === r.ride_id);
        return {
          ...r,
          reporter: (profiles ?? []).find((p) => p.id === r.reporter_id),
          ride,
          role: ride?.driver_id === r.reporter_id ? "driver" : "rider",
        };
      });
    },
  });
  const resolve = async (id: string) => {
    const notes = window.prompt("Resolution notes (internal)") ?? "";
    const { error } = await supabase.from("reports").update({ status: "resolved", admin_notes: notes || null }).eq("id", id);
    if (error) return toast.error("Couldn't update report");
    toast.success("Report resolved");
    void qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };
  if (isLoading) return <Skeleton className="h-24 w-full rounded-2xl" />;
  if (!data?.length) return <EmptyState title="No reports yet" />;
  return (
    <div className="space-y-2">
      {data.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{reportCategoryLabel(r.category)}</p>
              <p className="text-xs text-muted-foreground">
                {r.reporter?.full_name ?? "User"} ({r.role}){r.reporter?.phone ? ` · ${formatPhMobile(r.reporter.phone)}` : ""} · {formatDateTime(r.created_at)}
              </p>
              {r.ride && (
                <p className="text-xs text-muted-foreground">
                  Trip to {r.ride.dropoff_address} · {formatMoney(r.ride.final_fare)}
                </p>
              )}
            </div>
            <Badge variant={r.status === "open" ? "destructive" : "secondary"}>{r.status}</Badge>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{r.details}</p>
          {r.admin_notes && <p className="mt-1 text-xs text-muted-foreground">Notes: {r.admin_notes}</p>}
          {r.status === "open" && (
            <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => void resolve(r.id)}>
              Mark resolved
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Launch checklist ---------------- */
export function LaunchChecklist() {
  const fn = useServerFn(getLaunchChecklist);
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ["launch-checklist"], queryFn: () => fn() });
  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (error) return <p className="text-sm text-destructive">Couldn't load checklist.</p>;
  const items = data?.items ?? [];
  const passed = items.filter((i) => i.ok).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          {passed}/{items.length} checks passing
        </p>
        <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          Re-check
        </Button>
      </div>
      {items.map((i) => (
        <div key={i.id} className={`rounded-2xl border p-3 ${i.ok ? "border-border" : "border-destructive/50"}`}>
          <div className="flex items-start gap-2">
            {i.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
            <div>
              <p className="text-sm font-medium">{i.label}</p>
              {i.detail && <p className="text-xs text-muted-foreground">{i.detail}</p>}
              {!i.ok && i.fix && <p className="mt-1 text-xs">How to fix: {i.fix}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

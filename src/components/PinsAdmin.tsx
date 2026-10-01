import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/geo";

type PinStatus = "pending" | "approved" | "rejected";

export function PinsAdmin() {
  const { data, refetch } = useQuery({
    queryKey: ["admin-community-pins"],
    queryFn: async () => {
      const { data: pins, error } = await supabase
        .from("community_pins")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const { data: reports } = await supabase
        .from("pin_reports")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      const ids = [...new Set([...(pins ?? []).map((p) => p.created_by), ...(reports ?? []).map((r) => r.reporter_id)])];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
      const names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name]));
      const rank = (s: string) => (s === "pending" ? 0 : s === "approved" ? 1 : 2);
      return (pins ?? [])
        .map((p) => ({
          ...p,
          creator: names[p.created_by] ?? "Unknown",
          reports: (reports ?? []).filter((r) => r.pin_id === p.id).map((r) => ({ ...r, reporter: names[r.reporter_id] ?? "User" })),
        }))
        .sort((a, b) => b.reports.length - a.reports.length || rank(a.status) - rank(b.status));
    },
  });

  const setStatus = async (id: string, status: PinStatus) => {
    const { error } = await supabase.from("community_pins").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(status === "approved" ? "Pin approved" : "Pin rejected");
    void refetch();
  };
  const setHidden = async (id: string, is_hidden: boolean) => {
    const { error } = await supabase.from("community_pins").update({ is_hidden }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(is_hidden ? "Pin hidden" : "Pin visible again");
    void refetch();
  };
  const resolveReports = async (pinId: string) => {
    const { error } = await supabase.from("pin_reports").update({ status: "resolved" }).eq("pin_id", pinId).eq("status", "open");
    if (error) toast.error(error.message);
    else toast.success("Reports resolved");
    void refetch();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this pin permanently?")) return;
    const { error } = await supabase.from("community_pins").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Pin deleted");
    void refetch();
  };

  if (!data?.length) return <p className="py-6 text-center text-sm text-muted-foreground">No community pins yet.</p>;
  const pending = data.filter((p) => p.status === "pending").length;
  const reported = data.filter((p) => p.reports.length).length;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {pending} awaiting approval · {reported} reported
      </p>
      <ul className="space-y-2">
        {data.map((p) => (
          <li key={p.id} className={`rounded-2xl border p-3 text-sm ${p.reports.length ? "border-destructive/50" : p.status === "pending" ? "border-accent" : "border-border"}`}>
            <div className="flex flex-wrap items-center gap-1">
              <p className="font-semibold">{p.name}</p>
              <Badge variant="secondary" className="capitalize">{p.category}</Badge>
              <Badge variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "outline"} className="capitalize">{p.status}</Badge>
              {p.is_hidden && <Badge variant="destructive">Hidden</Badge>}
              {p.reports.length > 0 && <Badge variant="destructive">{p.reports.length} report{p.reports.length > 1 ? "s" : ""}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              by {p.creator} · {formatDateTime(p.created_at)} ·{" "}
              <a className="text-accent" href={`https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">
                {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
              </a>
            </p>
            {p.reports.length > 0 && (
              <ul className="mt-2 space-y-1 rounded-xl bg-secondary/60 p-2 text-xs">
                {p.reports.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium">{r.reporter}:</span> {r.reason}{" "}
                    <span className="text-muted-foreground">· {formatDateTime(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {p.status !== "approved" && <Button size="sm" onClick={() => setStatus(p.id, "approved")}>Approve</Button>}
              {p.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => setStatus(p.id, "rejected")}>Reject</Button>}
              {p.status === "approved" && (
                <Button size="sm" variant="outline" onClick={() => setHidden(p.id, !p.is_hidden)}>{p.is_hidden ? "Unhide" : "Hide"}</Button>
              )}
              {p.reports.length > 0 && <Button size="sm" variant="outline" onClick={() => resolveReports(p.id)}>Dismiss reports</Button>}
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

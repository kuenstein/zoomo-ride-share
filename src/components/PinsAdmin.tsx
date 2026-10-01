import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/geo";

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
      const ids = [...new Set((pins ?? []).map((p) => p.created_by))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id,full_name").in("id", ids)
        : { data: [] };
      const names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name]));
      return (pins ?? []).map((p) => ({ ...p, creator: names[p.created_by] ?? "Unknown" }));
    },
  });

  const setHidden = async (id: string, is_hidden: boolean) => {
    const { error } = await supabase.from("community_pins").update({ is_hidden }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(is_hidden ? "Pin hidden" : "Pin visible again");
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
  return (
    <ul className="space-y-2">
      {data.map((p) => (
        <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border p-3 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {p.name} <Badge variant="secondary" className="ml-1 capitalize">{p.category}</Badge>
              {p.is_hidden && <Badge variant="destructive" className="ml-1">Hidden</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              by {p.creator} · {formatDateTime(p.created_at)} · {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setHidden(p.id, !p.is_hidden)}>
            {p.is_hidden ? "Unhide" : "Hide"}
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}>
            Delete
          </Button>
        </li>
      ))}
    </ul>
  );
}

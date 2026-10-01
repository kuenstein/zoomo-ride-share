import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CommunityPin = Database["public"]["Tables"]["community_pins"]["Row"];

/** Shared, voluntarily-saved static map points. Live-updated for every signed-in user. */
export function useCommunityPins(enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["community-pins"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_pins")
        .select("*")
        .eq("is_hidden", false)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel(`community-pins-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_pins" }, () => {
        void qc.invalidateQueries({ queryKey: ["community-pins"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [enabled, qc]);

  return query;
}

export const PIN_CATEGORIES = ["landmark", "gate", "meeting point", "other"] as const;

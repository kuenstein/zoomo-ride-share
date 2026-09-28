import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, Upload, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const DOC_TYPES = [
  { type: "license", label: "LTO driver's license (front)" },
  { type: "orcr", label: "OR/CR photo" },
  { type: "vehicle", label: "Vehicle photo (plate visible)" },
  { type: "selfie", label: "Selfie / profile photo" },
] as const;
export type DocType = (typeof DOC_TYPES)[number]["type"];
export type DriverDoc = {
  id: string;
  user_id: string;
  doc_type: string;
  storage_path: string;
  status: string;
  reviewer_notes: string | null;
  updated_at: string;
};

const MAX = 5 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

export function useDriverDocs(userId: string | undefined) {
  return useQuery({
    queryKey: ["driver-docs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_documents").select("*").eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as DriverDoc[];
    },
  });
}

export async function openSignedDoc(path: string) {
  const { data, error } = await supabase.storage.from("driver-documents").createSignedUrl(path, 300);
  if (error || !data) return void toast.error("Couldn't open file");
  window.open(data.signedUrl, "_blank", "noopener");
}

export function DriverDocuments({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: docs, isLoading } = useDriverDocs(userId);
  const [busy, setBusy] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const upload = async (type: DocType, file: File) => {
    if (file.size > MAX) return void toast.error("File must be under 5 MB");
    if (!OK_TYPES.includes(file.type)) return void toast.error("Use a photo (JPG, PNG, WEBP, HEIC) or a PDF");
    setBusy(type);
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${userId}/${type}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("driver-documents").upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(null);
      return void toast.error("Upload failed");
    }
    const existing = docs?.find((d) => d.doc_type === type);
    const { error } = existing
      ? await supabase.from("driver_documents").update({ storage_path: path }).eq("id", existing.id)
      : await supabase.from("driver_documents").insert({ user_id: userId, doc_type: type, storage_path: path });
    if (!error && existing) await supabase.storage.from("driver-documents").remove([existing.storage_path]);
    setBusy(null);
    if (error) return void toast.error("Couldn't save document");
    toast.success("Document uploaded");
    await qc.invalidateQueries({ queryKey: ["driver-docs", userId] });
  };

  return (
    <div className="space-y-2">
      {DOC_TYPES.map((d) => {
        const doc = docs?.find((x) => x.doc_type === d.type);
        const Icon = !doc ? Upload : doc.status === "approved" ? CheckCircle2 : doc.status === "rejected" ? XCircle : Clock;
        const color = !doc ? "text-muted-foreground" : doc.status === "approved" ? "text-accent" : doc.status === "rejected" ? "text-destructive" : "text-muted-foreground";
        return (
          <div key={d.type} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-3">
              <Icon className={`h-5 w-5 shrink-0 ${color}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">{d.label}</p>
                <p className="text-xs text-muted-foreground">
                  {isLoading ? "…" : !doc ? "Missing" : doc.status === "approved" ? "Approved" : doc.status === "rejected" ? "Rejected — please re-upload" : "Uploaded · awaiting review"}
                </p>
              </div>
              {doc && (
                <Button type="button" size="sm" variant="ghost" onClick={() => void openSignedDoc(doc.storage_path)}>
                  View
                </Button>
              )}
              {doc?.status !== "approved" && (
                <Button type="button" size="sm" variant="outline" disabled={busy === d.type} onClick={() => inputs.current[d.type]?.click()}>
                  {busy === d.type ? <Loader2 className="h-4 w-4 animate-spin" /> : doc ? "Replace" : "Upload"}
                </Button>
              )}
              <input
                ref={(el) => {
                  inputs.current[d.type] = el;
                }}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void upload(d.type, f);
                }}
              />
            </div>
            {doc?.status === "rejected" && doc.reviewer_notes && (
              <p className="mt-2 rounded-lg bg-destructive/10 px-2 py-1 text-xs text-destructive">Admin note: {doc.reviewer_notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

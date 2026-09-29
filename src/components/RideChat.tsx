import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Msg = Database["public"]["Tables"]["ride_messages"]["Row"];

const OPEN_STATUSES = ["accepted", "arriving", "in_progress"];
/** Chat is sendable only while a driver is assigned and the trip hasn't ended. */
export const isChatOpen = (status: string | null | undefined) => !!status && OPEN_STATUSES.includes(status);

export function RideChat({ rideId, userId, status }: { rideId: string; userId: string; status: string }) {
  const open = isChatOpen(status);
  const [closedByServer, setClosedByServer] = useState(false);
  const canSend = open && !closedByServer;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("ride_messages")
        .select("*")
        .eq("ride_id", rideId)
        .order("created_at", { ascending: true });
      if (active) setMessages(data ?? []);
    })();

    const channel = supabase
      .channel(`ride-chat-${rideId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ride_messages", filter: `ride_id=eq.${rideId}` },
        (payload) => setMessages((m) => [...m, payload.new as Msg]),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [rideId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const { error } = await supabase
      .from("ride_messages")
      .insert({ ride_id: rideId, sender_id: userId, body });
    setSending(false);
    if (error) {
      // RLS rejects inserts once the trip is no longer active
      if (error.code === "42501" || /row-level security/i.test(error.message)) {
        setClosedByServer(true);
        toast.message("Chat closed — this trip has ended");
      } else {
        toast.error("Message failed to send");
      }
      return;
    }
    setText("");
  };

  return (
    <div className="flex h-72 flex-col rounded-2xl border border-border">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted-foreground">
            {canSend ? "No messages yet. Say hello 👋" : "No messages on this trip."}
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                m.sender_id === userId
                  ? "ml-auto bg-accent text-accent-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {m.body}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      {canSend ? (
        <form onSubmit={send} className="flex gap-2 border-t border-border p-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message"
            aria-label="Message"
          />
          <Button type="submit" size="icon" disabled={sending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <p className="border-t border-border p-3 text-center text-xs text-muted-foreground">
          This trip has ended — chat is now closed.
        </p>
      )}
    </div>
  );
}

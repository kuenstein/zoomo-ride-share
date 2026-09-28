import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Called by the database when a notification row is inserted. It only accepts a
// notification id, and each notification is pushed at most once (pushed_at claim),
// so a replayed call can never send anything new.
export const Route = createFileRoute("/api/public/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("bad request", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: n } = await supabaseAdmin
          .from("notifications")
          .update({ pushed_at: new Date().toISOString() })
          .eq("id", parsed.data.id)
          .is("pushed_at", null)
          .gt("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
          .select("user_id, title, body, url")
          .maybeSingle();
        if (!n) return new Response("ok");
        const { notify } = await import("@/lib/notify.server");
        await notify(n.user_id, { title: n.title, body: n.body, url: n.url ?? "/", tag: parsed.data.id });
        return new Response("ok");
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

// ---------------------------------------------------------------------------
// MoMo webhook handling is currently DISABLED (commented out).
// Re-enable by restoring the implementation below.
// ---------------------------------------------------------------------------
// import {
//   momoEventSchema,
//   reconcileEvent,
//   timestampFresh,
//   verifySignature,
// } from "@/lib/momo.server";
//
// export const Route = createFileRoute("/api/public/momo/webhook")({
//   server: {
//     handlers: {
//       POST: async ({ request }) => {
//         const secret = process.env["MOMO_WEBHOOK_SECRET"] ?? "";
//         const raw = await request.text();
//         const signature =
//           request.headers.get("x-momo-signature") ?? request.headers.get("x-webhook-signature");
//
//         if (!timestampFresh(request.headers.get("x-momo-timestamp"))) {
//           return new Response("Stale timestamp", { status: 401 });
//         }
//         if (!verifySignature(raw, signature, secret)) {
//           return new Response("Invalid signature", { status: 401 });
//         }
//
//         let parsedJson: unknown;
//         try {
//           parsedJson = JSON.parse(raw);
//         } catch {
//           return new Response("Invalid JSON", { status: 400 });
//         }
//
//         const parsed = momoEventSchema.safeParse(parsedJson);
//         if (!parsed.success) {
//           return new Response("Invalid payload", { status: 422 });
//         }
//         const event = parsed.data;
//
//         const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
//
//         const { error: insertError } = await supabaseAdmin.from("webhook_events").insert({
//           provider: event.provider,
//           event_id: event.event_id,
//           event_type: event.event_type,
//           signature_valid: true,
//           payload: JSON.parse(raw),
//         });
//
//         if (insertError) {
//           if (insertError.code === "23505") {
//             return Response.json({ ok: true, duplicate: true });
//           }
//           return new Response("Storage error", { status: 500 });
//         }
//
//         try {
//           const result = await reconcileEvent(supabaseAdmin, event);
//           await supabaseAdmin
//             .from("webhook_events")
//             .update({ processed_at: new Date().toISOString() })
//             .eq("provider", event.provider)
//             .eq("event_id", event.event_id);
//           return Response.json({ ok: true, ...result });
//         } catch (err) {
//           const message = err instanceof Error ? err.message : "reconciliation failed";
//           await supabaseAdmin
//             .from("webhook_events")
//             .update({ error: message })
//             .eq("provider", event.provider)
//             .eq("event_id", event.event_id);
//           console.error("[momo webhook] reconcile failed", message);
//           return new Response("Reconciliation failed", { status: 500 });
//         }
//       },
//     },
//   },
// });

export const Route = createFileRoute("/api/public/momo/webhook")({
  server: {
    handlers: {
      POST: async () => new Response("MoMo webhook disabled", { status: 404 }),
    },
  },
});

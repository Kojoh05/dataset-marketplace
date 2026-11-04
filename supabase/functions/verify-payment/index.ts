// KOJOH: verify a Razorpay payment, capture it if needed, and hand out the license.
// Secrets needed: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const CODE_PCT = 10;      // reward code: % off MRP on the next project
const CODE_DAYS = 7;      // reward code lifetime
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode() {
  const b = new Uint8Array(6); crypto.getRandomValues(b);
  return "KOJOH-" + [...b].map((x) => ALPHA[x % ALPHA.length]).join("");
}

async function hmacHex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const auth = "Basic " + btoa(`${keyId}:${keySecret}`);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Please sign in again." }, 401);

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return json({ error: "Missing payment details." }, 400);

    const expected = await hmacHex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expected !== razorpay_signature) return json({ error: "Payment could not be verified." }, 400);

    const admin = createClient(url, service);
    const { data: p } = await admin.from("payments").select("*").eq("razorpay_order_id", razorpay_order_id).maybeSingle();
    if (!p || p.user_id !== user.id) return json({ error: "This payment does not belong to your account." }, 403);

    // Confirm with Razorpay and capture if the account is not on auto-capture.
    let pr = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, { headers: { Authorization: auth } });
    let pay = await pr.json();
    if (!pr.ok || pay.order_id !== razorpay_order_id || pay.amount !== p.amount_paise) return json({ error: "Payment details do not match." }, 400);
    if (pay.status === "authorized") {
      pr = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}/capture`, {
        method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: p.amount_paise, currency: "INR" }),
      });
      pay = await pr.json();
    }
    if (pay.status !== "captured") return json({ error: "Payment is not complete yet." }, 400);

    const alreadyPaid = p.status === "paid";
    await admin.from("payments").update({ razorpay_payment_id, status: "paid", paid_at: new Date().toISOString() }).eq("id", p.id);

    let lic: any = null, passExpires: string | null = null;
    if (p.kind === "pass") {
      // Extend from today, or from the current expiry if the pass is still running. Only once per payment.
      const { data: cur } = await admin.from("practice_passes").select("expires_at").eq("user_id", user.id).maybeSingle();
      passExpires = cur?.expires_at ?? null;
      if (!alreadyPaid) {
        const from = Math.max(Date.now(), cur ? new Date(cur.expires_at).getTime() : 0);
        passExpires = new Date(from + Number(p.pass_days || 30) * 86400000).toISOString();
        const up = await admin.from("practice_passes").upsert({ user_id: user.id, expires_at: passExpires });
        if (up.error) return json({ error: "Paid, but the pass could not be activated: " + up.error.message + ". Contact support with payment " + razorpay_payment_id }, 500);
      }
    } else {
      const g = await admin.rpc("grant_license", {
        p_user: user.id, p_dataset: p.dataset_id, p_price: p.amount_paise / 100, p_ref: razorpay_payment_id,
      });
      if (g.error) return json({ error: "Paid, but the license could not be issued: " + g.error.message + ". Contact support with payment " + razorpay_payment_id }, 500);
      lic = g.data;
    }

    // Mark the reward code used on this order as redeemed (only now that payment succeeded).
    if (p.discount_code_id) {
      await admin.from("discount_codes").update({ redeemed_at: new Date().toISOString(), redeemed_payment_id: p.id })
        .eq("id", p.discount_code_id).is("redeemed_at", null);
    }

    // Every paid purchase earns one new code: 1 use, valid for 7 days. One active code per user at a time.
    let reward: { code: string; percent: number; expires_at: string } | null = null;
    if (p.amount_paise > 0) {
      try {
        const { data: have } = await admin.from("discount_codes").select("code, percent, expires_at").eq("source_payment_id", p.id).maybeSingle();
        if (have) reward = have as any;
        else {
          await admin.from("discount_codes").delete().eq("user_id", user.id).is("redeemed_at", null);
          const expires_at = new Date(Date.now() + CODE_DAYS * 86400000).toISOString();
          for (let i = 0; i < 5 && !reward; i++) {
            const code = makeCode();
            const ins = await admin.from("discount_codes").insert({ code, user_id: user.id, source_payment_id: p.id, percent: CODE_PCT, expires_at });
            if (!ins.error) reward = { code, percent: CODE_PCT, expires_at };
          }
        }
      } catch (_) { /* never fail a paid order because of the reward */ }
    }
    return json({ ok: true, license_code: lic?.license_code, pass_expires_at: passExpires, reward });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

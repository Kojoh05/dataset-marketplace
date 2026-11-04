// KOJOH: create a Razorpay order for a paid dataset.
// Secrets needed (Supabase dashboard > Edge Functions > Secrets): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// Reward rules. Price never drops below the project's first-purchase offer price (datasets.price).
const MEMBER_PCT = 20; // Practice pass: % off MRP

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) return json({ error: "Payments are not configured yet." }, 500);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Please sign in again." }, 401);

    const { dataset_id, code, quote } = await req.json();
    const admin = createClient(url, service);
    const { data: ds } = await admin.from("datasets").select("id, title, price, is_free, is_published, meta").eq("id", dataset_id).maybeSingle();
    if (!ds || !ds.is_published) return json({ error: "Dataset not found." }, 404);
    if (ds.is_free || Number(ds.price) <= 0) return json({ error: "This dataset is free, no payment needed." }, 400);

    const { data: owned } = await admin.from("purchases").select("id").eq("user_id", user.id).eq("dataset_id", ds.id).maybeSingle();
    if (owned) return json({ owned: true });

    // First paid dataset at the offer price (datasets.price); every later one at MRP (datasets.meta.mrp).
    const { count: paidBefore } = await admin.from("purchases").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gt("price_paid", 0);
    const price = Number(ds.price);
    const mrp = Number((ds as any).meta?.mrp) || 0;
    const unit = (paidBefore && mrp > price) ? mrp : price;

    // Practice pass (member) discount and one-time reward code. They stack, but never go below the offer price.
    const nowIso = new Date().toISOString();
    const { data: pass } = await admin.from("practice_passes").select("expires_at").eq("user_id", user.id).gt("expires_at", nowIso).maybeSingle();
    const memberPct = pass ? MEMBER_PCT : 0;
    const calc = (pct: number) => (mrp > price && pct > 0)
      ? Math.min(unit, Math.max(price, Math.round(mrp * (100 - pct) / 100))) : unit;

    let codeRow: any = null, codeMsg = "";
    const codeIn = String(code ?? "").trim().toUpperCase();
    if (codeIn) {
      const { data: c } = await admin.from("discount_codes").select("*").eq("code", codeIn).maybeSingle();
      if (!c || c.user_id !== user.id) codeMsg = "That code is not valid for your account.";
      else if (c.redeemed_at) codeMsg = "This code has already been used.";
      else if (new Date(c.expires_at) <= new Date()) codeMsg = "This code has expired.";
      else codeRow = c;
    }
    const afterMember = calc(memberPct);
    let final = codeRow ? calc(memberPct + Number(codeRow.percent)) : afterMember;
    if (codeRow && final >= afterMember) {
      codeMsg = "This project is already at its lowest price, so the code was not needed. Your code is still saved.";
      codeRow = null; final = afterMember;
    }
    const amount = Math.round(final * 100);

    if (quote) {
      return json({
        quote: true, amount, list_price: unit, member: !!pass, member_pct: memberPct,
        member_saving: unit - afterMember, code_ok: !!codeRow, code_pct: codeRow ? Number(codeRow.percent) : 0,
        code_saving: afterMember - final, code_msg: codeMsg, first_offer: !paidBefore,
      });
    }
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) },
      body: JSON.stringify({ amount, currency: "INR", receipt: ("kojoh_" + crypto.randomUUID()).slice(0, 40),
                             notes: { user_id: user.id, dataset_id: ds.id, dataset: ds.title.slice(0, 200) } }),
    });
    const order = await res.json();
    if (!res.ok) return json({ error: order?.error?.description ?? "Could not create the order." }, 502);

    const ins = await admin.from("payments").insert({ user_id: user.id, dataset_id: ds.id, amount_paise: amount, razorpay_order_id: order.id, status: "created",
      discount_code_id: codeRow ? codeRow.id : null, discount_amount: unit - final });
    if (ins.error) return json({ error: ins.error.message }, 500);

    return json({ order_id: order.id, amount, currency: "INR", key_id: keyId, title: ds.title, email: user.email, first_offer: !paidBefore, code_msg: codeMsg });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

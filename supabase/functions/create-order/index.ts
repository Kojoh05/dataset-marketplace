// KOJOH: create a Razorpay order for a paid dataset.
// Secrets needed (Supabase dashboard > Edge Functions > Secrets): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
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

    const { dataset_id } = await req.json();
    const admin = createClient(url, service);
    const { data: ds } = await admin.from("datasets").select("id, title, price, is_free, is_published, meta").eq("id", dataset_id).maybeSingle();
    if (!ds || !ds.is_published) return json({ error: "Dataset not found." }, 404);
    if (ds.is_free || Number(ds.price) <= 0) return json({ error: "This dataset is free, no payment needed." }, 400);

    const { data: owned } = await admin.from("purchases").select("id").eq("user_id", user.id).eq("dataset_id", ds.id).maybeSingle();
    if (owned) return json({ owned: true });

    // First paid dataset at the offer price (datasets.price); every later one at MRP (datasets.meta.mrp).
    const { count: paidBefore } = await admin.from("purchases").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gt("price_paid", 0);
    const mrp = Number((ds as any).meta?.mrp) || 0;
    const unit = (paidBefore && mrp > Number(ds.price)) ? mrp : Number(ds.price);
    const amount = Math.round(unit * 100);
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) },
      body: JSON.stringify({ amount, currency: "INR", receipt: ("kojoh_" + crypto.randomUUID()).slice(0, 40),
                             notes: { user_id: user.id, dataset_id: ds.id, dataset: ds.title.slice(0, 200) } }),
    });
    const order = await res.json();
    if (!res.ok) return json({ error: order?.error?.description ?? "Could not create the order." }, 502);

    const ins = await admin.from("payments").insert({ user_id: user.id, dataset_id: ds.id, amount_paise: amount, razorpay_order_id: order.id, status: "created" });
    if (ins.error) return json({ error: ins.error.message }, 500);

    return json({ order_id: order.id, amount, currency: "INR", key_id: keyId, title: ds.title, email: user.email, first_offer: !paidBefore });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

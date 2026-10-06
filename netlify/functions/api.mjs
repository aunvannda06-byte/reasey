// Single Netlify Function (v2): /api/login, /api/admin, /api/ai
// Env vars: GEMINI_API_KEY, ADMIN_PASSWORD (required) | GEMINI_MODEL, ADMIN_EMAIL, SESSION_SECRET (optional)
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const LIMIT = 3, IP_LIMIT = 15;
const FEATURES = ["today","month","year","dream","travel","luck","house","car","biz","trade","feng","love","career","chuong","cal","chat"];
const ADMIN_EMAIL = () => (process.env.ADMIN_EMAIL || "aunvannda01@gmail.com").toLowerCase();
const SECRET = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
const CONTACT = "សូមទាក់ទង Admin: លោក អូន វណ្ណដា · aunvannda01@gmail.com · (+855) 968 471 250 (Telegram) ដើម្បីទទួលបានគណនីប្រើគ្មានដែនកំណត់។";
const SYSTEM = `អ្នកគឺជា "ហោរាសាស្ត្រខ្មែរ AI" ជាជំនួយការផ្តល់ការណែនាំតាមជំនឿប្រពៃណីខ្មែរ។
- ឆ្លើយជាភាសាខ្មែរធម្មជាតិ ងាយយល់ ខ្លី ច្បាស់ និងកក់ក្តៅ។
- បែងចែកឱ្យច្បាស់រវាង ហោរាសាស្ត្រខ្មែរ, តារានិករ, ឆ្នាំឆុងចិន, ហុងស៊ុយ, ការយល់សប្តិ និងការណែនាំជីវិតទូទៅ។
- មិនត្រូវអះអាងថាហោរាសាស្ត្រមានភស្តុតាងវិទ្យាសាស្ត្រឡើយ។
- បើពាក់ព័ន្ធហិរញ្ញវត្ថុ សុខភាព ច្បាប់ អចលនទ្រព្យ ឬអាជីវកម្ម ត្រូវបញ្ចប់ដោយចំណាំខ្លីថា នេះជាការណែនាំតាមប្រពៃណី ហើយគួរសម្រេចចិត្តដោយផ្អែកលើការពិត និងអ្នកជំនាញ។
- ប្រើចំណងជើងតូចៗដោយ "## " និងបញ្ជីដោយ "- "។ កុំធ្វើឱ្យភ័យខ្លាច។`;

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString("hex");
const sign = (p) => { const body = Buffer.from(JSON.stringify(p)).toString("base64url"); return body + "." + crypto.createHmac("sha256", SECRET()).update(body).digest("base64url"); };
function auth(req) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer /, ""); const [body, sig] = t.split(".");
  if (!body || !sig || !SECRET()) return null;
  const ok = crypto.createHmac("sha256", SECRET()).update(body).digest("base64url");
  if (!safeEq(sig, ok)) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
const users = () => getStore({ name: "users", consistency: "strong" });
const ukey = (u) => "u:" + encodeURIComponent(u);
const TTL = 1000 * 60 * 60 * 24 * 30;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  let b = {}; try { b = await req.json(); } catch {}
  const path = new URL(req.url).pathname.replace(/\/$/, "");
  try {
    if (path === "/api/login") return await login(b);
    if (path === "/api/admin") return await admin(req, b);
    if (path === "/api/ai") return await ai(req, b);
  } catch (e) { return json({ error: e.message }, 500); }
  return json({ error: "Not found" }, 404);
};
export const config = { path: "/api/*" };

async function login(b) {
  if (!process.env.ADMIN_PASSWORD) return json({ error: "មិនទាន់កំណត់ ADMIN_PASSWORD ក្នុង Netlify" }, 500);
  const u = String(b.username || "").trim().toLowerCase(), p = String(b.password || "");
  if ((u === ADMIN_EMAIL() || u === "admin") && safeEq(p, process.env.ADMIN_PASSWORD))
    return json({ token: sign({ u: "admin", role: "admin", exp: Date.now() + TTL }), role: "admin", name: "លោក អូន វណ្ណដា" });
  const rec = u ? await users().get(ukey(u), { type: "json" }) : null;
  if (!rec || !rec.active || !safeEq(hash(p, rec.salt), rec.hash)) return json({ error: "ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ" }, 401);
  return json({ token: sign({ u, role: "user", exp: Date.now() + TTL }), role: "user", name: rec.name || u });
}

async function admin(req, b) {
  const a = auth(req); if (!a || a.role !== "admin") return json({ error: "មិនមានសិទ្ធិ" }, 403);
  const st = users(), u = String(b.username || "").trim().toLowerCase();
  if (b.action === "list") {
    const { blobs } = await st.list({ prefix: "u:" });
    const out = [];
    for (const x of blobs) { const r = await st.get(x.key, { type: "json" }); if (r) out.push({ username: decodeURIComponent(x.key.slice(2)), name: r.name, active: r.active, created: r.created }); }
    return json({ users: out });
  }
  if (!u) return json({ error: "ត្រូវការឈ្មោះគណនី" }, 400);
  if (b.action === "create") {
    if (!/^[a-z0-9._@-]{3,40}$/.test(u)) return json({ error: "ឈ្មោះគណនីត្រូវជាអក្សរឡាតាំង/លេខ ៣–៤០ តួ" }, 400);
    if (String(b.password || "").length < 6) return json({ error: "ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ តួ" }, 400);
    const old = await st.get(ukey(u), { type: "json" }), salt = crypto.randomBytes(16).toString("hex");
    await st.setJSON(ukey(u), { name: String(b.name || "").slice(0, 60), salt, hash: hash(b.password, salt), active: true, created: old?.created || new Date().toISOString() });
    return json({ ok: true });
  }
  const rec = await st.get(ukey(u), { type: "json" }); if (!rec) return json({ error: "រកមិនឃើញគណនី" }, 404);
  if (b.action === "toggle") { rec.active = !rec.active; await st.setJSON(ukey(u), rec); return json({ ok: true }); }
  if (b.action === "delete") { await st.delete(ukey(u)); return json({ ok: true }); }
  return json({ error: "action" }, 400);
}

async function ai(req, b) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: "មិនទាន់កំណត់ GEMINI_API_KEY ក្នុង Netlify" }, 500);
  if (!FEATURES.includes(b.feature)) return json({ error: "feature មិនត្រឹមត្រូវ" }, 400);
  const a = auth(req); let unlimited = false;
  if (a) {
    if (a.role === "admin") unlimited = true;
    else { const r = await users().get(ukey(a.u), { type: "json" }); if (r && r.active) unlimited = true; else return json({ error: "គណនីរបស់អ្នកត្រូវបានបិទ ឬលុប។ " + CONTACT, logout: true }, 401); }
  }
  let remaining = null, kd, ki, cd, ci, us;
  if (!unlimited) {
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // Cambodia time
    const ip = encodeURIComponent(req.headers.get("x-nf-client-connection-ip") || "unknown");
    const dev = String(b.deviceId || "").replace(/[^\w-]/g, "").slice(0, 64) || "nodev";
    us = getStore({ name: "usage", consistency: "strong" });
    kd = `${day}/${b.feature}/d-${dev}`; ki = `${day}/${b.feature}/i-${ip}`;
    [cd, ci] = (await Promise.all([us.get(kd), us.get(ki)])).map(x => +x || 0);
    if (cd >= LIMIT || ci >= IP_LIMIT) return json({ error: `អ្នកបានប្រើមុខងារនេះគ្រប់ ${LIMIT} ដងសម្រាប់ថ្ងៃនេះហើយ។ ${CONTACT}`, limit: true }, 429);
    await Promise.all([us.set(kd, String(cd + 1)), us.set(ki, String(ci + 1))]);
    remaining = LIMIT - cd - 1;
  }
  const contents = (b.messages || []).slice(-12).map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: String(m.text).slice(0, 4000) }] }));
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const refund = async () => { if (us) await Promise.all([us.set(kd, String(cd)), us.set(ki, String(ci))]); };
  let r, d;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents, generationConfig: { temperature: 0.8, maxOutputTokens: 2048 } }),
    });
    d = await r.json();
  } catch (e) { await refund(); return json({ error: e.message }, 502); }
  if (!r.ok) { await refund(); return json({ error: d.error?.message || "Gemini error" }, 502); }
  const text = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
  return json({ text, remaining, unlimited });
}

// Netlify Function: proxy to Gemini. Set env GEMINI_API_KEY (optional: GEMINI_MODEL)
const SYSTEM = `អ្នកគឺជា "ហោរាសាស្ត្រខ្មែរ AI" ជាជំនួយការផ្តល់ការណែនាំតាមជំនឿប្រពៃណីខ្មែរ។
- ឆ្លើយជាភាសាខ្មែរធម្មជាតិ ងាយយល់ ខ្លី ច្បាស់ និងកក់ក្តៅ។
- បែងចែកឱ្យច្បាស់រវាង ហោរាសាស្ត្រខ្មែរ, ឆ្នាំឆុងចិន, ហុងស៊ុយ, ការយល់សប្តិ និងការណែនាំជីវិតទូទៅ។
- មិនត្រូវអះអាងថាហោរាសាស្ត្រមានភស្តុតាងវិទ្យាសាស្ត្រឡើយ។
- បើពាក់ព័ន្ធហិរញ្ញវត្ថុ សុខភាព ច្បាប់ អចលនទ្រព្យ ឬអាជីវកម្ម ត្រូវបញ្ចប់ដោយចំណាំខ្លីថា នេះជាការណែនាំតាមប្រពៃណី/ការកម្សាន្ត ហើយគួរសម្រេចចិត្តដោយផ្អែកលើការពិត និងអ្នកជំនាញ។
- ប្រើចំណងជើងតូចៗដោយ "## " និងបញ្ជីដោយ "- "។ កុំធ្វើឱ្យភ័យខ្លាច។`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(500, { error: "មិនទាន់កំណត់ GEMINI_API_KEY ក្នុង Netlify" });
  try {
    const { messages = [] } = JSON.parse(event.body || "{}");
    const contents = messages.slice(-12).map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: String(m.text).slice(0, 4000) }],
    }));
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
        }),
      }
    );
    const d = await r.json();
    if (!r.ok) return json(502, { error: d.error?.message || "Gemini error" });
    const text = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
    return json(200, { text });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
const json = (statusCode, o) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });

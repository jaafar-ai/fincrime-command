// FinCrime Command — Vercel serverless proxy (the Anthropic key lives ONLY here)
export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const required = process.env.ACCESS_CODE;
  if (required && req.headers["x-access-code"] !== required) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { prompt, useSearch } = req.body || {};
  if (!prompt || typeof prompt !== "string" || prompt.length > 20000) {
    return res.status(400).json({ error: "bad request" });
  }
  const payload = {
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  };
  if (useSearch) payload.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: (d.error && d.error.message) || "api error" });
    const text = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "proxy failure" });
  }
}

import "dotenv/config";
import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

// tsx auto-loads .env — no dotenv needed
if (!process.env.GEMINI_API_KEY) {
  console.error("FATAL: GEMINI_API_KEY is not set in environment variables.");
  process.exit(1);
}

// ✅ FIX 1: non-null assertion (!) tells TypeScript the key is definitely a string here
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.post("/api/extract", async (req, res) => {
    try {
      const { fileBase64, mimeType, fileUrl } = req.body;

      if (!fileBase64) return res.status(400).json({ error: "fileBase64 is required." });
      if (!mimeType)   return res.status(400).json({ error: "mimeType is required." });

      // ✅ FIX 2: Use gemini-2.0-flash (gemini-1.5-flash returns 404 NOT_FOUND)
      const MODEL = "gemini-2.5-flash";

      const prompt = `
        TASK: Extract EVERY SINGLE customer record from the provided document.

        CRITICAL: If the document contains no loan/debt/customer data, return an empty array [].

        For each customer extract:
        - name: Full name
        - mobile: Phone number
        - address: Full address
        - dueAmount: Amount due as a NUMBER only (no ₹, Rs, commas or text)
        - dueDate: Due date in YYYY-MM-DD format
        - loanId: Loan ID or Account Number
        - area: Locality or district
        - needsReview: true if data is unclear or fields are missing, else false

        Return ONLY a valid JSON array. No markdown, no code blocks, no explanation.
      `;

      // ✅ FIX 3: contents must be an ARRAY
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: fileBase64,
                  mimeType: mimeType,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name:        { type: Type.STRING },
                mobile:      { type: Type.STRING },
                address:     { type: Type.STRING },
                dueAmount:   { type: Type.NUMBER },
                dueDate:     { type: Type.STRING },
                loanId:      { type: Type.STRING },
                area:        { type: Type.STRING },
                needsReview: { type: Type.BOOLEAN },
              },
              required: ["name", "dueAmount", "needsReview"],
            },
          },
        },
      });

      // ✅ FIX 4: response.text is a GETTER (not a method) in @google/genai SDK
      // Access it as a property, then handle undefined with nullish coalescing
      const rawText: string = response.text ?? "";
      console.log("[Gemini] Response preview:", rawText.substring(0, 300));

      if (!rawText.trim()) return res.json([]);

      // Strip markdown fences in case Gemini wraps the JSON anyway
      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      let parsedData: any[];
      try {
        parsedData = JSON.parse(cleaned);
      } catch {
        console.error("[Gemini] JSON parse failed. Raw text:", cleaned);
        return res.status(500).json({ error: "AI returned malformed JSON. Try a clearer document." });
      }

      if (!Array.isArray(parsedData)) parsedData = [parsedData];

      const finalData = parsedData.map((item: any) => ({
        ...item,
        documentUrl: fileUrl || null,
      }));

      console.log(`[Gemini] ✅ Extracted ${finalData.length} record(s).`);
      return res.json(finalData);

    } catch (error: any) {
      const msg: string = error?.message || JSON.stringify(error) || "";
      console.error("[Gemini] Backend error:", msg);

      if (msg.includes("API_KEY") || msg.includes("403"))    return res.status(500).json({ error: "Gemini API key is invalid. Check your .env file." });
      if (msg.includes("quota") || msg.includes("429"))      return res.status(500).json({ error: "Gemini quota exceeded. Try again in a minute." });
      if (msg.includes("NOT_FOUND") || msg.includes("404"))  return res.status(500).json({ error: "Gemini model not found." });
      if (msg.includes("SAFETY"))                            return res.status(500).json({ error: "Document blocked by safety filters." });

      res.status(500).json({ error: "Failed to process document via AI." });
    }
  });

  const isProd = process.env.NODE_ENV === "production";
  console.log(`[Server] Starting in ${isProd ? "production" : "development"} mode.`);

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, _res) => {
      _res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
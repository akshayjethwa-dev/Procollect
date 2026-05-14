import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini on the server side securely
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // IMPORTANT: Increased the JSON payload limit to 100MB to handle large PDF Base64 strings
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // --- SECURE AI ENDPOINT ---
  app.post('/api/extract', async (req, res) => {
    try {
      const { fileBase64, mimeType } = req.body;

      if (!fileBase64 || !mimeType) {
        return res.status(400).json({ error: "fileBase64 and mimeType are required" });
      }

      // Using the more stable and cost-effective production model
      const model = "gemini-1.5-flash"; 
      
      const prompt = `
        TASK: Extract EVERY SINGLE customer record from the provided document.
        
        CRITICAL INSTRUCTION:
        IF THE DOCUMENT DOES NOT CONTAIN DEBT COLLECTION, LOAN, OR CUSTOMER DATA (e.g., it is a random picture, a receipt, or a blank page), YOU MUST STRICTLY RETURN AN EMPTY ARRAY: []
        
        EXTRACTION INSTRUCTIONS:
        1. Do not skip ANY records. Process all pages thoroughly.
        2. Extract the following fields for each customer:
           - name: Full name of the customer
           - mobile: Mobile or phone number
           - address: Full combined address (include area/pincode if available)
           - dueAmount: Total amount due (as a number)
           - dueDate: Next due date or installment date (format: YYYY-MM-DD or reasonable guess)
           - loanId: Loan ID, Account Number, or Reference ID
           - area: Specific locality or district mentioned
        
        3. If data is in a table, extract every row.
        4. If data is partial, extract as much as possible but do not invent data.
        5. Ensure the "dueAmount" is a valid number, not a string with currency symbols.
        
        Return the result strictly as a JSON array of objects.
      `;

      const response = await ai.models.generateContent({
        model,
        contents: {
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
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                mobile: { type: Type.STRING },
                address: { type: Type.STRING },
                dueAmount: { type: Type.NUMBER },
                dueDate: { type: Type.STRING },
                loanId: { type: Type.STRING },
                area: { type: Type.STRING },
              },
              required: ["name", "dueAmount"]
            }
          }
        }
      });

      const text = response.text;
      if (!text) return res.json([]);
      
      return res.json(JSON.parse(text));
      
    } catch (error) {
      console.error("Backend Gemini extraction error:", error);
      res.status(500).json({ error: "Failed to process document via AI." });
    }
  });

  // Determine mode
  const isProd = process.env.NODE_ENV === "production";
  console.log(`[Server] Starting. Production: ${isProd}`);

  if (!isProd) {
    // Development mode with Vite
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode serving static files from dist
    const distPath = path.join(process.cwd(), "dist");
    console.log(`[Prod] Serving from: ${distPath}`);
    
    app.use(express.static(distPath));
    
    // SPA Fallback
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`[Error] 404 on ${req.url}. index.html not found at ${indexPath}`);
          res.status(404).send("Application not initialized. Please try again soon.");
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
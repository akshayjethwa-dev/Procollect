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
      // Added fileUrl to destructuring to support the new storage pipeline
      const { fileBase64, mimeType, fileUrl } = req.body;

      if (!fileBase64 && !fileUrl) {
        return res.status(400).json({ error: "fileBase64 or fileUrl is required" });
      }

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
           - address: Full combined address
           - dueAmount: Total amount due (as a number)
           - dueDate: Next due date (format: YYYY-MM-DD or reasonable guess)
           - loanId: Loan ID, Account Number, or Reference ID
           - area: Specific locality or district
           - needsReview: Boolean flag
        
        3. QUALITY CONTROL: 
           Set "needsReview": true if:
           - The image is blurry or hard to read.
           - The text appears to be handwritten and is ambiguous.
           - Required fields like Name, LoanId, or Amount are missing and you had to guess.
           Otherwise, set it to false.
        
        4. Ensure "dueAmount" is a valid number, not a string with currency symbols.
        
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
                needsReview: { type: Type.BOOLEAN } // Added to schema
              },
              required: ["name", "dueAmount", "needsReview"]
            }
          }
        }
      });

      const text = response.text;
      if (!text) return res.json([]);
      
      const parsedData = JSON.parse(text);

      // Link the source document URL to each record if provided
      const finalData = parsedData.map((item: any) => ({
        ...item,
        documentUrl: fileUrl || null
      }));
      
      return res.json(finalData);
      
    } catch (error) {
      console.error("Backend Gemini extraction error:", error);
      res.status(500).json({ error: "Failed to process document via AI." });
    }
  });

  // Determine mode
  const isProd = process.env.NODE_ENV === "production";
  console.log(`[Server] Starting. Production: ${isProd}`);

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
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      res.sendFile(indexPath);
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
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function extractDataFromPDF(fileBase64: string, mimeType: string) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    TASK: Extract EVERY SINGLE customer record from the provided document.
    
    IMPORTANT INSTRUCTIONS:
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

  try {
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
    if (!text) return [];
    
    return JSON.parse(text);
  } catch (e) {
    console.error("Gemini extraction error:", e);
    return [];
  }
}

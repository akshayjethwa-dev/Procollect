/**
 * Extracts customer data from a document using the Gemini AI pipeline.
 * @param fileBase64 The base64 encoded file content.
 * @param mimeType The file's MIME type (e.g., 'application/pdf', 'image/jpeg').
 * @param fileUrl Optional Firebase Storage URL for the uploaded document.
 */
export async function extractDataFromPDF(fileBase64: string, mimeType: string, fileUrl?: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileBase64,
        mimeType,
        fileUrl // Include the storage URL to link the record to the source file
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 413) {
      throw new Error("The file is too large to process. Please upload a smaller document.");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with an error (${response.status}).`);
    }

    const data = await response.json();
    return data;
    
  } catch (e: any) {
    clearTimeout(timeoutId);
    
    if (e.name === 'AbortError') {
      throw new Error("Extraction timed out. The document might be too large or complex.");
    }
    
    console.error("Frontend extraction error:", e);
    throw new Error(e.message || "Failed to connect to the extraction service.");
  }
}
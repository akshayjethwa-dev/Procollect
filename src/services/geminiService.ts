/**
 * Extracts customer data from a document using the Gemini AI pipeline.
 * @param fileBase64 The base64 encoded file content.
 * @param mimeType The file's MIME type (e.g., 'application/pdf', 'image/jpeg')
 * @param fileUrl Optional Firebase Storage URL for the uploaded document.
 * @param onProgress Optional callback to report progress status to the UI.
 */
export async function extractDataFromPDF(
  fileBase64: string,
  mimeType: string,
  fileUrl?: string,
  onProgress?: (message: string) => void
) {
  const controller = new AbortController();

  // ✅ FIX: Increased from 60s → 5 minutes (300s)
  // Large PDFs with 30+ records can take 2-3 minutes to process
  const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Notify UI that processing has started
  onProgress?.("Uploading document to AI for analysis...");

  // Show a progress heartbeat every 15 seconds so user knows it's working
  const progressMessages = [
    "Reading document pages...",
    "Extracting customer records...",
    "Almost done, finalizing data...",
  ];
  let progressIndex = 0;
  const progressInterval = setInterval(() => {
    if (progressIndex < progressMessages.length) {
      onProgress?.(progressMessages[progressIndex++]);
    }
  }, 15000);

  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileBase64,
        mimeType,
        fileUrl,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    clearInterval(progressInterval);

    if (response.status === 413) {
      throw new Error("The file is too large to process. Please upload a smaller document.");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with an error (${response.status}).`);
    }

    onProgress?.("Processing complete!");
    const data = await response.json();
    return data;

  } catch (e: any) {
    clearTimeout(timeoutId);
    clearInterval(progressInterval);

    if (e.name === "AbortError") {
      throw new Error(
        "Extraction timed out after 5 minutes. The document may be too large — try splitting it into smaller files."
      );
    }

    console.error("Frontend extraction error:", e);
    throw new Error(e.message || "Failed to connect to the extraction service.");
  }
}
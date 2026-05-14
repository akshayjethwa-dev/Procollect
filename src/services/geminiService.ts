export async function extractDataFromPDF(fileBase64: string, mimeType: string) {
  // Create an AbortController to handle timeouts
  const controller = new AbortController();
  // Set a 60-second timeout threshold
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    // Make a POST request to our secure backend endpoint
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileBase64,
        mimeType
      }),
      signal: controller.signal // Attach the abort signal
    });

    // Clear the timeout if the request finishes successfully
    clearTimeout(timeoutId);

    // Handle specific HTTP errors gracefully
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
    
    // Catch the specific timeout error thrown by AbortController
    if (e.name === 'AbortError') {
      throw new Error("Extraction timed out. The document might be too large or complex. Please try breaking it into smaller files.");
    }
    
    console.error("Frontend extraction error:", e);
    // Rethrow to allow the UI to handle it (e.g., show error message in ImportScreen)
    throw new Error(e.message || "Failed to connect to the extraction service. Please check your connection.");
  }
}
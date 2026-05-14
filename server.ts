import express from "express";
import path from "path";
import { fileURLToPath } from "url";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
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

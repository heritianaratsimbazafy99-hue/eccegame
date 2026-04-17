require("dotenv/config");

const fs = require("node:fs");
const path = require("node:path");
const express = require("express");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.argv.includes("--prod") || process.env.NODE_ENV === "production";

async function createApp() {
  const sessionService = await import("./api/_lib/session-service.js");

  const app = express();
  app.use(express.json({ limit: "5mb" }));

  app.get("/api/state", async (_request, response) => {
    try {
      response.json(await sessionService.getSessionState());
    } catch (error) {
      response.status(error.status || 500).json({
        error: error.message || "Erreur serveur inattendue."
      });
    }
  });

  app.post("/api/snapshot", async (request, response) => {
    try {
      response.json(await sessionService.replaceSnapshot(request.body?.snapshot));
    } catch (error) {
      response.status(error.status || 500).json({
        error: error.message || "Erreur serveur inattendue."
      });
    }
  });

  app.post("/api/votes", async (request, response) => {
    try {
      response.json(await sessionService.createVote(request.body?.cardId, request.body?.choice));
    } catch (error) {
      response.status(error.status || 500).json({
        error: error.message || "Erreur serveur inattendue."
      });
    }
  });

  app.post("/api/votes/reset", async (_request, response) => {
    try {
      response.json(await sessionService.clearVotes());
    } catch (error) {
      response.status(error.status || 500).json({
        error: error.message || "Erreur serveur inattendue."
      });
    }
  });

  app.post("/api/intruders/guess", async (request, response) => {
    try {
      response.json(
        await sessionService.createIntruderGuess(
          request.body?.cardId,
          request.body?.suspectIds
        )
      );
    } catch (error) {
      response.status(error.status || 500).json({
        error: error.message || "Erreur serveur inattendue."
      });
    }
  });

  if (IS_PROD) {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get(/.*/, (_request, response) => {
      response.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa"
    });

    app.use(vite.middlewares);
    app.get(/.*/, async (request, response, next) => {
      try {
        const templatePath = path.join(__dirname, "index.html");
        const template = fs.readFileSync(templatePath, "utf8");
        const html = await vite.transformIndexHtml(request.originalUrl, template);
        response.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error);
        next(error);
      }
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`EcceGame server ready on http://${HOST}:${PORT}`);
  });
}

createApp().catch((error) => {
  console.error(error);
  process.exit(1);
});

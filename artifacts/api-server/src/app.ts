import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env.SERVE_FRONTEND === "true") {
  const frontendRoot = path.resolve(process.cwd(), "artifacts/nhlsnipes/dist/public");
  if (existsSync(frontendRoot)) {
    app.use(express.static(frontendRoot, { index: "index.html" }));
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api") && !path.extname(req.path)) {
        res.sendFile(path.join(frontendRoot, "index.html"));
        return;
      }
      next();
    });
  } else {
    logger.warn({ frontendRoot }, "Frontend build directory is missing");
  }
}

export default app;

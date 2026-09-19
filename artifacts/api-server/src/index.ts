import app from "./app";
import { logger } from "./lib/logger";
import { getNhlProvider } from "./providers/nhl";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  const intervalMs = Number(process.env.NHLSNIPES_SYNC_INTERVAL_MS ?? 0);
  if (Number.isFinite(intervalMs) && intervalMs > 0) {
    const provider = getNhlProvider();
    const runSync = () => {
      void provider.sync().catch((error) => {
        logger.error({ err: error }, "Scheduled NHL sync failed");
      });
    };
    runSync();
    const timer = setInterval(runSync, intervalMs);
    timer.unref();
    logger.info({ intervalMs }, "Scheduled NHL sync enabled");
  }
});

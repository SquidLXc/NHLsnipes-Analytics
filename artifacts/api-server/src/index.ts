import "dotenv/config";
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

  // Warm up caches on startup (don't block server start)
  const provider = getNhlProvider();
  setTimeout(() => {
    logger.info("Warming up data caches...");
    Promise.all([
      provider.getTeams().catch(e => logger.error({ err: e }, "Failed to warm up teams cache")),
      provider.getPlayers().catch(e => logger.error({ err: e }, "Failed to warm up players cache")),
      provider.getGames().catch(e => logger.error({ err: e }, "Failed to warm up games cache")),
    ]).then(() => {
      logger.info("Data cache warmup complete");
    }).catch(e => {
      logger.error({ err: e }, "Data cache warmup failed");
    });
  }, 1000);

  const intervalMs = Number(process.env.NHLSNIPES_SYNC_INTERVAL_MS ?? 0);
  if (Number.isFinite(intervalMs) && intervalMs > 0) {
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

// Dev server — runs Next.js dev mode + Socket.io on the same HTTP server
// Usage: npx tsx dev-server.ts

import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server as SocketServer } from "socket.io";
import {
  registerGatewayConfigUpdatedHandler,
  registerRpcHandler,
} from "./src/lib/rpc-registry";

const envLoader = (
  process as typeof process & {
    loadEnvFile?: (path?: string) => void;
  }
).loadEnvFile;

try {
  envLoader?.(process.env.DESKRPG_ENV_PATH || ".env.local");
  envLoader?.(".env");
} catch {
  // Ignore missing local env files in environments that inject env vars externally.
}

const hostname = process.env.HOSTNAME || "localhost";
const preferredPort = parseInt(process.env.PORT || "3000", 10);

async function findAvailablePort(
  start: number,
  maxAttempts = 10,
): Promise<number> {
  const net = await import("node:net");
  for (let p = start; p < start + maxAttempts; p++) {
    const available = await new Promise<boolean>((resolve) => {
      const srv = net.createServer();
      srv.once("error", () => resolve(false));
      srv.listen(p, () => {
        srv.close(() => resolve(true));
      });
    });
    if (available) return p;
  }
  throw new Error(
    `No available port found in range ${start}-${start + maxAttempts - 1}`,
  );
}

const app = next({ dev: true, hostname, port: preferredPort });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`⚠ Port ${preferredPort} in use, using ${port} instead`);
  }
  const {
    setupSocketHandlers,
    getOrConnectGateway,
    invalidateGatewayConnectionForChannel,
  } = await import("./src/server/socket-handlers");

  // Register in-process RPC handler so Next.js API routes can call the gateway
  // directly without HTTP — no port dependency.
  registerRpcHandler(async (channelId, method, params) => {
    const gateway = await getOrConnectGateway(channelId);
    if (!gateway) throw new Error("Gateway not connected");

    if (method === "agents.create")
      return gateway.agentsCreate(params.name, params.workspace);
    if (method === "agents.files.set")
      return gateway.agentsFileSet(params.agentId, params.name, params.content);
    if (method === "agents.files.get")
      return gateway.agentsFileGet(params.agentId, params.name);
    if (method === "agents.list") return gateway.agentsList();
    if (method === "agents.delete")
      return gateway.agentsDelete(params.agentId, params.deleteFiles);
    throw new Error(`Unknown RPC method: ${method}`);
  });

  registerGatewayConfigUpdatedHandler(async (channelId) => {
    await invalidateGatewayConnectionForChannel(channelId);
  });

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketServer(httpServer, {
    path: "/socket.io",
    maxHttpBufferSize: 20e6, // 20 MB — supports 3 × 5 MB file attachments
  });

  if (process.env.NODE_ENV !== "production") {
    io.engine.on("connection_error", (error) => {
      console.warn("[socket:engine] connection_error", {
        code: error.code,
        message: error.message,
        transport: error.context?.transport,
        url: error.req?.url,
        hasCookieHeader: !!error.req?.headers?.cookie,
        userAgent: error.req?.headers?.["user-agent"] || "",
      });
    });
  }

  setupSocketHandlers(io);

  // ─── Scheduled aggregate reports (per-channel daily summary) ───
  try {
    const { startReportScheduler } = await import("./src/lib/scheduled-reports");
    startReportScheduler();
  } catch (err) {
    console.warn("[reports] scheduler failed to start:", (err as Error).message);
  }

  // ─── AI Office Agents 통합 (dev 모드용) ───
  try {
    const path = await import("node:path");
    const url = await import("node:url");
    const patchPath = path.resolve(
      process.cwd(),
      "..",
      "deskrpg-integration",
      "server-patch.js",
    );
    const { setupAIOfficeAgents } = await import(url.pathToFileURL(patchPath).href);
    setupAIOfficeAgents(io, null, null, null, null);
  } catch (err) {
    console.warn("[AI-Office] dev 통합 로드 실패:", (err as Error).message);
  }

  httpServer.listen(port, () => {
    console.log(`> Dev server ready on http://${hostname}:${port}`);
  });
});

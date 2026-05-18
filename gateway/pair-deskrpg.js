#!/usr/bin/env node
/**
 * pair-deskrpg.js
 *
 * DeskRPG 의 openclaw-gateway 클라이언트를 직접 사용해
 * OpenClaw 게이트웨이와 ed25519 디바이스 페어링을 미리 수립한다.
 *
 * 실행: node gateway/pair-deskrpg.js
 *   ENV:
 *     OPENCLAW_URL   (default ws://127.0.0.1:18789)
 *     OPENCLAW_TOKEN (default openclaw config 의 token)
 */

const path = require("path");
process.env.DESKRPG_HOME = process.env.DESKRPG_HOME || path.join(require("os").homedir(), ".deskrpg");

const { testGatewayConnection } = require(
  path.resolve(__dirname, "..", "desk_rpg_model", "src", "lib", "openclaw-gateway.js"),
);

const URL = process.env.OPENCLAW_URL || "ws://127.0.0.1:18789";
const TOKEN = process.env.OPENCLAW_TOKEN || "";
if (!TOKEN) {
  console.error("[pair] OPENCLAW_TOKEN 환경변수가 비었습니다.");
  console.error("       .env.local 또는 ~/.openclaw/openclaw.json 의 gateway.auth.token 을 확인하세요.");
  process.exit(1);
}

(async () => {
  console.log(`[pair] connecting to ${URL} with token=${TOKEN.slice(0, 6)}…`);
  try {
    const { agents } = await testGatewayConnection(URL, TOKEN);
    console.log(`[pair] ✓ connected. existing agents:`, agents.length);
    process.exit(0);
  } catch (err) {
    console.error(`[pair] ✗ ${err.errorCode || err.code || "error"}: ${err.message}`);
    if (err.pairingRequired) {
      console.log("[pair] hint: run `openclaw devices approve --latest` in another terminal.");
    }
    process.exit(1);
  }
})();

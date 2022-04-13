// import { OWebSyncFramework } from "./frameworks/owebsync";

import { YjsFramework } from "./frameworks/yjs";
import { SyncFramework } from "./sync_framework";

// This code was in the old app.ts file, not sure what it does.
(window as any).WebComponents = {
  ready: true,
};
document.dispatchEvent(
  new CustomEvent("WebComponentsReady", { bubbles: true })
);

// WebSocket URL.
const WS_PORT = 8081;
const wsProtocol = location.protocol.replace(/^http/, "ws");
const wsURL = wsProtocol + "//" + location.hostname + ":" + WS_PORT;
console.log("wsURL: " + wsURL);

// Construct and start the SyncFramework indicated by the "framework"
// URL param.
const FRAMEWORKS = {
  // owebsync: OWebSyncFramework,
  yjs: YjsFramework,
};

const searchParams = new URLSearchParams(window.location.search);
if (!searchParams.has("framework")) {
  throw new Error("No framework specified in URL params");
}
const frameworkName = <keyof typeof FRAMEWORKS>searchParams.get("framework")!;

const framework: SyncFramework = new FRAMEWORKS[frameworkName](wsURL);
framework.start();

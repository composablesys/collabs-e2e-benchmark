import { startWebSocketServer } from "@collabs/ws-server";
import http = require("http");

const port = process.env.PORT || 8081;
const requestListener = function (req, res) {
  res.writeHead(200);
  res.end("Hello, World!");
};

const server = http.createServer(requestListener);
server.listen(port);

startWebSocketServer({ server });

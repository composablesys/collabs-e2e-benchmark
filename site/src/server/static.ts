import express = require("express");
import path = require("path");
import osu = require("node-os-utils");

const app = express();
const port = process.env.PORT || 8080;

// Serve build/site under /.
app.use("/", express.static(path.join(__dirname, "../site")));
app.listen(port, () => console.log(`Listening at http://localhost:${port}/`));

// Stats
setInterval(() => {
  console.log(
    "SERVER_CPU",
    new Date().toISOString(),
    JSON.stringify(osu.cpu.average())
  );
  osu.mem
    .info()
    .then((info) =>
      console.log(
        "SERVER_MEMORY",
        new Date().toISOString(),
        JSON.stringify(info)
      )
    );
  osu.netstat
    .stats()
    .then((info) =>
      console.log(
        "SERVER_NETWORK",
        new Date().toISOString(),
        JSON.stringify(info)
      )
    );
}, 1000);

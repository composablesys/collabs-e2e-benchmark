import express = require("express");
import path = require("path");

const app = express();
const port = process.env.PORT || 8080;

// Serve build/site under /.
app.use("/", express.static(path.join(__dirname, "../site")));
app.listen(port, () => console.log(`Listening at http://localhost:${port}/`));

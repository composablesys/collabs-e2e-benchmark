const puppeteer = require("puppeteer");
const osu = require("node-os-utils");

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    // executablePath: "chromium",
    // userDataDir: "/home/root",
    // args: [
    //   "--no-sandbox",
    //   "--disable-setuid-sandbox",
    //   "--disable-dev-shm-usage",
    //   "--ignore-certificate-errors",
    // ],
  });

  const page = await browser.newPage();

  page.on("console", (msg) =>
    console.log("APP", new Date().toISOString(), msg.text())
  );

  page.on("pageerror", (err) => {
    console.log("[ERROR] ", err.name, err.message, err.stack);
  });

  console.log(`Loading page: ${process.env.URL}`);
  await page.goto(process.env.URL);
  console.log("Loaded", new Date().toISOString());

  // Stats
  setInterval(() => {
    console.log(
      "CPU",
      new Date().toISOString(),
      JSON.stringify(osu.cpu.average())
    );
    osu.mem
      .info()
      .then((info) =>
        console.log("MEMORY", new Date().toISOString(), JSON.stringify(info))
      );
    osu.netstat
      .stats()
      .then((info) =>
        console.log("NETWORK", new Date().toISOString(), JSON.stringify(info))
      );
  }, 1000);

  process.on("SIGTERM", () => {
    browser.close();
    process.exit(0);
  });
})();

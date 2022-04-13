const puppeteer = require('puppeteer-core')

;(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'chromium',
    userDataDir: '/home/root',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
    ],
  })

  const page = await browser.newPage()

  page.on('console', msg => console.log(new Date().toISOString(), msg.text()))

  page.on('pageerror', err => {
    console.log('[ERROR] ', err.name, err.message, err.stack)
  })

  console.log(`Loading page: ${process.env.URL}`)
  await page.goto(process.env.URL)

  process.on('SIGTERM', () => {
    browser.close()
    process.exit(0)
  })
})()

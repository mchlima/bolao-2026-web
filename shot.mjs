// Reusable WSL screenshot helper. Usage:
//   node shot.mjs <path> <outfile> [width] [height]
// e.g. node shot.mjs / home.png 390 1400
import pw from '/home/michel/projects/codebase/assisty/site-assisty24h-cl/node_modules/playwright-core/index.js'
const { chromium } = pw

const [, , path = '/', out = 'shot.png', w = '390', h = '1600', click = ''] = process.argv
const exe = '/home/michel/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome'

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })
const ctx = await browser.newContext({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()
const url = `http://localhost:3001${path}`
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
await page.waitForTimeout(800)
if (click) {
  await page.click(click, { timeout: 5000 }).catch((e) => console.log('click fail', e.message))
  await page.waitForTimeout(500)
}
if (process.env.SCROLL) {
  await page.evaluate((y) => {
    const main = document.querySelector('main') || document.scrollingElement
    main.scrollTo({ top: y })
  }, Number(process.env.SCROLL))
  await page.waitForTimeout(500)
}
await page.screenshot({ path: out, fullPage: process.env.NOFULL ? false : true })
await browser.close()
console.log(`shot ${url} -> ${out}`)

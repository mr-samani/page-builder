const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 3000;

const CACHE_DURATION = 5 * 60 * 1000;
const MAX_BROWSERS = 3;
const PAGE_TIMEOUT = 30_000;
const DEFAULT_WAIT_TIME = 3_000;

const browserPool = [];
const cache = new Map();

let chromeExecutablePath = null;

/**
 * =========================================================
 * Middleware
 * =========================================================
 */

app.use(cors());

app.use(
  bodyParser.json({
    limit: '10mb',
  }),
);

/**
 * =========================================================
 * Find Chrome
 * =========================================================
 *
 * We intentionally use the Chrome already installed
 * on the user's machine.
 *
 * No Chrome for Testing download is required.
 */
function findChrome() {
  const candidates = [];

  /**
   * -------------------------------------------------------
   * Windows
   * -------------------------------------------------------
   */

  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';

    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');

    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');

    candidates.push(
      /**
       * Google Chrome - machine installation
       */
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),

      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),

      /**
       * Google Chrome - per-user installation
       */
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),

      /**
       * Some installations can be under AppData/Roaming
       */
      path.join(appData, 'Google', 'Chrome', 'Application', 'chrome.exe'),

      /**
       * Chromium
       */
      path.join(programFiles, 'Chromium', 'Application', 'chrome.exe'),

      path.join(localAppData, 'Chromium', 'Application', 'chrome.exe'),
    );
  }

  /**
   * -------------------------------------------------------
   * macOS
   * -------------------------------------------------------
   */

  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      path.join(process.env.HOME || '', 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
    );
  }

  /**
   * -------------------------------------------------------
   * Linux
   * -------------------------------------------------------
   */

  if (process.platform === 'linux') {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    );
  }

  /**
   * Remove duplicates / invalid values
   */
  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];

  for (const candidate of uniqueCandidates) {
    try {
      if (fs.existsSync(candidate)) {
        console.log(`Found Chrome: ${candidate}`);

        return candidate;
      }
    } catch {
      // Ignore invalid candidate
    }
  }

  return null;
}

/**
 * =========================================================
 * Find Chrome using Windows Registry
 * =========================================================
 *
 * This is an additional fallback for Windows.
 *
 * Some Chrome installations don't use the standard
 * Program Files path.
 */
function findChromeFromRegistry() {
  if (process.platform !== 'win32') {
    return null;
  }

  try {
    const { execFileSync } = require('child_process');

    const registryQueries = [
      ['HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe', '/ve', '/reg:64'],
      ['HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe', '/ve', '/reg:32'],
      ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe', '/ve'],
    ];

    for (const args of registryQueries) {
      try {
        const output = execFileSync('reg.exe', ['query', ...args], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });

        /**
         * Typical output:
         *
         * (Default)    REG_SZ    C:\...\chrome.exe
         */

        const match = output.match(/REG_SZ\s+(.+chrome\.exe)/i);

        if (match) {
          const executable = match[1].trim();

          if (fs.existsSync(executable)) {
            console.log(`Found Chrome from registry: ${executable}`);

            return executable;
          }
        }
      } catch {
        // Try next registry location
      }
    }
  } catch {
    // Ignore registry errors
  }

  return null;
}

/**
 * =========================================================
 * Resolve Chrome
 * =========================================================
 */

function resolveChrome() {
  if (chromeExecutablePath) {
    return chromeExecutablePath;
  }

  /**
   * First: standard locations
   */
  let executablePath = findChrome();

  /**
   * Second: Windows registry
   */
  if (!executablePath) {
    executablePath = findChromeFromRegistry();
  }

  if (!executablePath) {
    throw new Error(
      [
        'Chrome was not found on this machine.',
        '',
        'Please install Google Chrome.',
        '',
        'Checked standard Chrome installation paths',
        'and Windows registry.',
      ].join('\n'),
    );
  }

  chromeExecutablePath = executablePath;

  return executablePath;
}

/**
 * =========================================================
 * Browser
 * =========================================================
 */

async function getBrowser() {
  /**
   * Reuse browser from pool
   */
  while (browserPool.length > 0) {
    const browser = browserPool.pop();

    try {
      if (browser.connected) {
        return browser;
      }
    } catch {
      // Dead browser.
    }
  }

  const executablePath = resolveChrome();

  console.log(`Launching Chrome:\n${executablePath}`);

  return puppeteer.launch({
    /**
     * VERY IMPORTANT:
     *
     * Tell Puppeteer exactly which Chrome
     * executable to use.
     */
    executablePath,

    headless: true,

    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',

      '--disable-gpu',

      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });
}

/**
 * =========================================================
 * Release browser
 * =========================================================
 */

async function releaseBrowser(browser) {
  if (!browser) {
    return;
  }

  try {
    if (!browser.connected) {
      return;
    }

    if (browserPool.length < MAX_BROWSERS) {
      browserPool.push(browser);
    } else {
      await browser.close();
    }
  } catch (error) {
    console.warn('Error releasing browser:', error.message);

    try {
      await browser.close();
    } catch {
      // Ignore
    }
  }
}

/**
 * =========================================================
 * Create page
 * =========================================================
 */

async function createPage(browser) {
  const page = await browser.newPage();

  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  /**
   * Don't block CSS/fonts/images here.
   *
   * This is important for accurate SPA rendering.
   */
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/142.0.0.0 Safari/537.36',
  );

  return page;
}

/**
 * =========================================================
 * Wait for page
 * =========================================================
 */

async function waitForPageReady(page, { waitForSelector, waitTime = DEFAULT_WAIT_TIME } = {}) {
  if (waitForSelector) {
    try {
      await page.waitForSelector(waitForSelector, {
        timeout: waitTime,
      });

      return;
    } catch {
      console.warn(`Selector "${waitForSelector}" was not found ` + `within ${waitTime}ms.`);
    }
  }

  /**
   * Don't use page.waitForResponse(url).
   *
   * That does not mean the SPA finished rendering.
   */
  if (waitTime > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
}

/**
 * =========================================================
 * POST /api/render
 * =========================================================
 */

app.post('/api/render', async (req, res) => {
  const { url, waitForSelector, waitTime = DEFAULT_WAIT_TIME } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL الزامی است',
    });
  }

  const cacheKey = JSON.stringify({
    url,
    waitForSelector,
    waitTime,
  });

  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Returning from cache:', url);

    return res.json(cached.data);
  }

  let browser;
  let page;

  try {
    console.log(`Rendering: ${url}`);

    browser = await getBrowser();

    page = await createPage(browser);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: PAGE_TIMEOUT,
    });

    await waitForPageReady(page, {
      waitForSelector,
      waitTime,
    });

    const html = await page.content();

    const result = {
      success: true,
      html,
      url,
    };

    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return res.json(result);
  } catch (error) {
    console.error('Error rendering page:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        // Ignore
      }
    }

    if (browser) {
      await releaseBrowser(browser);
    }
  }
});

/**
 * =========================================================
 * POST /api/render-selector
 * =========================================================
 */

app.post('/api/render-selector', async (req, res) => {
  const { url, querySelector, waitTime = DEFAULT_WAIT_TIME } = req.body;

  if (!url || !querySelector) {
    return res.status(400).json({
      success: false,
      error: 'URL و querySelector الزامی هستند',
    });
  }

  let browser;
  let page;

  try {
    browser = await getBrowser();

    page = await createPage(browser);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: PAGE_TIMEOUT,
    });

    await page.waitForSelector(querySelector, {
      timeout: waitTime,
    });

    const html = await page.$eval(querySelector, (el) => el.outerHTML);

    const styles = await page.$eval(querySelector, (el) => {
      const computed = window.getComputedStyle(el);

      const result = {};

      for (let i = 0; i < computed.length; i++) {
        const property = computed[i];

        result[property] = computed.getPropertyValue(property);
      }

      return result;
    });

    return res.json({
      success: true,
      html,
      styles,
      url,
    });
  } catch (error) {
    console.error('Error rendering selector:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        // Ignore
      }
    }

    if (browser) {
      await releaseBrowser(browser);
    }
  }
});

/**
 * =========================================================
 * POST /api/screenshot
 * =========================================================
 */

app.post('/api/screenshot', async (req, res) => {
  const { url, selector, fullPage = false, waitForSelector, waitTime = DEFAULT_WAIT_TIME } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL الزامی است',
    });
  }

  let browser;
  let page;

  try {
    browser = await getBrowser();

    page = await createPage(browser);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: PAGE_TIMEOUT,
    });

    await waitForPageReady(page, {
      waitForSelector,
      waitTime,
    });

    let screenshot;

    if (selector) {
      const element = await page.$(selector);

      if (!element) {
        throw new Error(`Selector "${selector}" پیدا نشد`);
      }

      screenshot = await element.screenshot();
    } else {
      screenshot = await page.screenshot({
        fullPage,
        type: 'png',
      });
    }

    res.set('Content-Type', 'image/png');

    return res.send(screenshot);
  } catch (error) {
    console.error('Error taking screenshot:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        // Ignore
      }
    }

    if (browser) {
      await releaseBrowser(browser);
    }
  }
});

/**
 * =========================================================
 * GET /health
 * =========================================================
 */

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',

    browsers: browserPool.length,

    cache: cache.size,

    chrome: {
      executablePath: chromeExecutablePath,

      installed: !!chromeExecutablePath && fs.existsSync(chromeExecutablePath),
    },
  });
});

/**
 * =========================================================
 * POST /api/clear-cache
 * =========================================================
 */

app.post('/api/clear-cache', (req, res) => {
  cache.clear();

  return res.json({
    success: true,
    message: 'Cache cleared',
  });
});

/**
 * =========================================================
 * Shutdown
 * =========================================================
 */

async function shutdown(signal) {
  console.log(`${signal} received, closing browsers...`);

  await Promise.all(
    browserPool.map(async (browser) => {
      try {
        await browser.close();
      } catch {
        // Ignore
      }
    }),
  );

  browserPool.length = 0;

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('SIGINT', () => shutdown('SIGINT'));

/**
 * =========================================================
 * Start
 * =========================================================
 */

async function start() {
  try {
    /**
     * Resolve Chrome BEFORE starting API.
     *
     * This means we know Chrome is available
     * before accepting requests.
     */
    const executablePath = resolveChrome();

    console.log('');
    console.log('========================================');
    console.log('Chrome detected successfully');
    console.log(`Executable: ${executablePath}`);
    console.log('========================================');
    console.log('');

    app.listen(PORT, () => {
      console.log(`🚀 SPA Renderer API running on port ${PORT}`);

      console.log('📝 Endpoints:');

      console.log('     Render fullpage: POST /api/render');

      console.log('     Render special selector: POST /api/render-selector');

      console.log('     Take screenshot: POST /api/screenshot');

      console.log('     Check Server status: GET /health');
    });
  } catch (error) {
    console.error('');
    console.error('❌ Failed to start SPA Renderer API.');
    console.error('');
    console.error(error.message);
    console.error('');

    process.exit(1);
  }
}

start();

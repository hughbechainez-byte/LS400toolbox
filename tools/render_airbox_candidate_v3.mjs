#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/blowb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
function decode(value) {
  const match = /^data:.*?;base64,(.*)$/.exec(value);
  if (!match) throw new Error('Expected base64 PNG data URL');
  return Buffer.from(match[1], 'base64');
}

const root = path.resolve(arg('--root', process.cwd()));
const output = path.resolve(arg('--output', path.join(root, 'qa', 'airbox-candidate-v3')));
const reference = path.resolve(arg('--reference', 'C:/Users/blowb/Desktop/LS400toolbox/ls400_engine_bay_reference_exact.jpg'));
const browserExecutable = arg('--browser', process.env.LS400_BROWSER_EXE || 'C:/Program Files/Google/Chrome/Application/chrome.exe');
fs.mkdirSync(output, { recursive: true });

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer((request, response) => {
  try {
    const relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
let browser;
const consoleErrors = [];
const pageErrors = [];

try {
  browser = await chromium.launch({ headless: true, executablePath: browserExecutable, args: ['--use-angle=swiftshader', '--disable-gpu-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 484 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  await page.goto(`http://127.0.0.1:${port}/windows/interactive-3d-prototype/index.html?qa=airbox-candidate-v3&airboxMaf=baseline`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__LS400_QA__ && document.querySelector('canvas')), null, { timeout: 30000 });
  await page.evaluate(() => window.__LS400_QA__.setFrame(640, 484));

  async function capture(name, expression, value = undefined) {
    fs.writeFileSync(path.join(output, `${name}.png`), decode(await page.evaluate(expression, value)));
  }
  async function mode(value) { await page.evaluate(next => window.__LS400_QA__.setAirboxMafMode(next), value); }
  async function view(value) {
    await page.evaluate(next => window.__LS400_QA__.setViewpoint(next), value);
    await page.waitForTimeout(120);
  }

  await view('ENGINE_BAY_PHOTO_LAYOUT');
  const camera = await page.evaluate(() => window.__LS400_QA__.cameraState());
  for (const [label, fitId] of [['baseline', ['airbox', 'intake-duct']], ['v2', ['candidate-airbox-maf-v2']], ['v3', ['candidate-airbox-maf-v3']]]) {
    await mode(label === 'baseline' ? 'baseline' : `candidate-${label}`);
    await capture(`photo-${label}`, () => window.__LS400_QA__.renderDataUrl(false));
    await capture(`photo-${label}-mask`, ids => window.__LS400_QA__.renderPhotoFitMaskDataUrl(ids), fitId);
  }

  for (const [label, preset] of [['passenger-oblique', 'FRONT_PASSENGER_CORNER'], ['driver-oblique', 'FRONT_DRIVER_CORNER']]) {
    await view(preset);
    for (const variant of ['baseline', 'v2', 'v3']) {
      await mode(variant === 'baseline' ? 'baseline' : `candidate-${variant}`);
      await capture(`${label}-${variant}`, () => window.__LS400_QA__.renderDataUrl(false));
    }
  }

  await view('FRONT_PASSENGER_CORNER');
  await mode('candidate-v3');
  await page.evaluate(() => window.__LS400_QA__.setCandidateV3ThreeQuarterCamera(false));
  await page.waitForTimeout(100);
  await capture('isolated-v3-upper', () => window.__LS400_QA__.renderAirboxCandidateV3IsolatedDataUrl());
  await view('FRONT_PASSENGER_CORNER');
  await mode('candidate-v3');
  await page.evaluate(() => window.__LS400_QA__.setCandidateV3ThreeQuarterCamera(true));
  await page.waitForTimeout(100);
  await capture('isolated-v3-underside', () => window.__LS400_QA__.renderAirboxCandidateV3IsolatedDataUrl());

  fs.copyFileSync(reference, path.join(output, 'reference.jpg'));
  fs.writeFileSync(path.join(output, 'capture.json'), JSON.stringify({
    referencePath: reference,
    referenceSha256: 'f8d74eec1af9c3014c107e0be18fc1fb83f5aff5d50e7ccd34d2da5318bfb725',
    viewport: { width: 640, height: 484 },
    camera,
    modes: ['baseline', 'candidate-v1', 'candidate-v2', 'candidate-v3', 'both-isolated'],
    photoFitGenerators: await page.evaluate(() => window.__LS400_QA__.photoFitGenerators()),
    consoleErrors,
    pageErrors
  }, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  server.close();
}

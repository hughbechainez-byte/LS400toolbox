#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/blowb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function decodeDataUrl(value) {
  const match = /^data:.*?;base64,(.*)$/.exec(value);
  if (!match) throw new Error('QA capture was not a base64 data URL');
  return Buffer.from(match[1], 'base64');
}

const root = path.resolve(arg('--root', process.cwd()));
const output = path.resolve(arg('--output', path.join(root, 'qa', 'airbox-candidate')));
const reference = path.resolve(arg('--reference', 'C:/Users/blowb/Desktop/LS400toolbox/ls400_engine_bay_reference_exact.jpg'));
const browserExecutable = arg('--browser', process.env.LS400_BROWSER_EXE || 'C:/Program Files/Google/Chrome/Application/chrome.exe');
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon' };
const rootResolved = path.resolve(root);
const server = http.createServer((request, response) => {
  try {
    const relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    const filePath = path.resolve(rootResolved, relative);
    if (!filePath.startsWith(rootResolved + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(response);
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
  await page.goto(`http://127.0.0.1:${port}/windows/interactive-3d-prototype/index.html?qa=airbox-candidate&airboxMaf=baseline`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__LS400_QA__ && document.querySelector('canvas')), null, { timeout: 30000 });
  await page.evaluate(() => window.__LS400_QA__.setFrame(640, 484));

  async function capture(name, expression) {
    const data = await page.evaluate(expression);
    fs.writeFileSync(path.join(output, `${name}.png`), decodeDataUrl(data));
  }
  async function setView(id) {
    await page.evaluate(view => window.__LS400_QA__.setViewpoint(view), id);
    await page.waitForTimeout(160);
  }
  async function setMode(mode) { await page.evaluate(value => window.__LS400_QA__.setAirboxMafMode(value), mode); }

  await setView('ENGINE_BAY_PHOTO_LAYOUT');
  const camera = await page.evaluate(() => window.__LS400_QA__.cameraState());
  await setMode('baseline');
  await capture('photo-baseline', () => window.__LS400_QA__.renderDataUrl(false));
  await capture('photo-baseline-mask', () => window.__LS400_QA__.renderPhotoFitMaskDataUrl(['airbox', 'intake-duct']));
  await setMode('candidate');
  await capture('photo-candidate', () => window.__LS400_QA__.renderDataUrl(false));
  await capture('photo-candidate-mask', () => window.__LS400_QA__.renderAirboxCandidateMaskDataUrl());
  await capture('photo-candidate-isolated-mask', () => window.__LS400_QA__.renderAirboxCandidateMaskDataUrl());

  for (const [label, view] of [['passenger-oblique', 'FRONT_PASSENGER_CORNER'], ['driver-oblique', 'FRONT_DRIVER_CORNER']]) {
    await setView(view);
    await setMode('baseline');
    await capture(`${label}-baseline`, () => window.__LS400_QA__.renderDataUrl(false));
    await setMode('candidate');
    await capture(`${label}-candidate`, () => window.__LS400_QA__.renderDataUrl(false));
  }
  await setView('FRONT_PASSENGER_CORNER');
  await page.evaluate(() => window.__LS400_QA__.setCandidateThreeQuarterCamera());
  await page.waitForTimeout(100);
  await setMode('baseline');
  await capture('isolated-three-quarter-baseline', () => window.__LS400_QA__.renderAirboxBaselineIsolatedDataUrl());
  await setMode('candidate');
  await capture('isolated-three-quarter-candidate', () => window.__LS400_QA__.renderAirboxCandidateIsolatedDataUrl());
  // Restore the oblique viewpoint before returning to the locked camera.
  await setView('FRONT_PASSENGER_CORNER');
  await setMode('baseline');
  await capture('isolated-three-quarter-baseline', () => window.__LS400_QA__.renderDataUrl(false));
  await setView('ENGINE_BAY_PHOTO_LAYOUT');
  const generators = await page.evaluate(() => window.__LS400_QA__.photoFitGenerators());
  fs.copyFileSync(reference, path.join(output, 'reference.jpg'));
  fs.writeFileSync(path.join(output, 'capture.json'), JSON.stringify({
    referencePath: reference,
    referenceSha256: 'f8d74eec1af9c3014c107e0be18fc1fb83f5aff5d50e7ccd34d2da5318bfb725',
    viewport: { width: 640, height: 484 }, camera,
    modes: ['baseline', 'candidate', 'both-isolated'],
    candidateGenerator: generators.find(item => item.id === 'candidate-airbox-maf') || null,
    consoleErrors, pageErrors,
    generatedFiles: fs.readdirSync(output).filter(file => file.endsWith('.png') || file.endsWith('.jpg')).sort()
  }, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  server.close();
}

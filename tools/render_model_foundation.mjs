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

const root = path.resolve(arg('--root', process.cwd()));
const output = path.resolve(arg('--output', path.join(root, 'qa', 'model-foundation')));
const browserExecutable = arg('--browser', process.env.LS400_BROWSER_EXE || 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const privateReference = arg('--private-reference');
const landmarkPath = path.join(root, 'shared', 'photo-layout-landmarks.json');
const manifestPath = path.join(root, 'shared', 'model-manifest.json');
const photoLandmarks = JSON.parse(fs.readFileSync(landmarkPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
fs.mkdirSync(output, { recursive: true });

const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon',
};
const rootResolved = path.resolve(root);
function serve(request, response) {
  try {
    const requestUrl = new URL(request.url, 'http://127.0.0.1');
    if (privateReference && requestUrl.pathname.endsWith('/references/user-1990-ls400-inline1.jpg') && fs.existsSync(privateReference)) {
      response.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
      fs.createReadStream(privateReference).pipe(response);
      return;
    }
    const relative = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
    const filePath = path.resolve(rootResolved, relative);
    if (!filePath.startsWith(rootResolved + path.sep) && filePath !== rootResolved) {
      response.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
}

function decodeDataUrl(value) {
  const match = /^data:.*?;base64,(.*)$/.exec(value);
  if (!match) throw new Error('QA render did not return a base64 data URL');
  return Buffer.from(match[1], 'base64');
}

const server = http.createServer(serve);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
let browser;
const consoleErrors = [];
const pageErrors = [];
const failedResponses = [];
try {
  browser = await chromium.launch({ headless: true, executablePath: browserExecutable, args: ['--use-angle=swiftshader', '--disable-gpu-sandbox'] });
  const page = await browser.newPage({ viewport: { width: photoLandmarks.viewport.widthPx, height: photoLandmarks.viewport.heightPx }, deviceScaleFactor: 1, colorScheme: 'dark' });
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('response', response => { if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() }); });
  const buildKey = manifest.integrity?.sha256 || 'unknown';
  await page.goto(`http://127.0.0.1:${port}/windows/interactive-3d-prototype/index.html?qa=foundation&foundation=${encodeURIComponent(buildKey)}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__LS400_QA__ && window.__LS400_NATIVE_EXPORT__ && document.querySelector('canvas')), null, { timeout: 30000 });
  const canvasSize = await page.evaluate(viewport => window.__LS400_QA__.setFrame(viewport.widthPx, viewport.heightPx), photoLandmarks.viewport);
  const cameraState = await page.evaluate(() => window.__LS400_QA__.setPhotoCamera());
  await page.waitForTimeout(250);
  const bodyFeatures = photoLandmarks.landmarks.filter(item => item.category === 'body' && item.fit.includes('camera')).map(item => ({ id: item.id, pixel: item.referencePx, modelPointMm: item.worldAnchorMm }));
  const maskPoints = photoLandmarks.masks.map(item => ({ id: item.id, modelPolygonMm: item.modelPolygonMm }));
  const projectedBodyFeatures = await page.evaluate(features => ({
    features,
    points: window.__LS400_QA__.projectPoints(features.map(item => item.modelPointMm)),
  }), bodyFeatures);
  const projectedMasks = await page.evaluate(masks => masks.map(item => ({ id: item.id, points: window.__LS400_QA__.projectPoints(item.modelPolygonMm) })), maskPoints);
  const projectedLandmarks = await page.evaluate(landmarks => ({
    landmarks,
    points: window.__LS400_QA__.projectPoints(landmarks.map(item => item.modelPointMm)),
  }), photoLandmarks.landmarks.map(item => ({ ...item, modelPointMm: item.worldAnchorMm })));
  const anchorInspection = await page.evaluate(landmarks => window.__LS400_QA__.inspectLandmarks(landmarks), photoLandmarks.landmarks.map(item => ({ ...item, modelPointMm: item.worldAnchorMm })));
  const normalData = await page.evaluate(() => window.__LS400_QA__.renderDataUrl(false));
  const silhouetteData = await page.evaluate(() => window.__LS400_QA__.renderDataUrl(true));
  const bodySilhouetteData = await page.evaluate(() => window.__LS400_QA__.renderDataUrl('body'));
  const photoBodyComponentIds = photoLandmarks.masks.find(mask => mask.id === 'body-shell')?.modelComponentIds;
  if (!Array.isArray(photoBodyComponentIds) || !photoBodyComponentIds.length) throw new Error('Canonical body mask must identify its rendered components.');
  const photoBodyData = await page.evaluate(componentIds => window.__LS400_QA__.renderDataUrl(componentIds), photoBodyComponentIds);
  const validation = await page.evaluate(() => window.__LS400_QA__.validation());
  fs.writeFileSync(path.join(output, 'model-render.png'), decodeDataUrl(normalData));
  fs.writeFileSync(path.join(output, 'model-silhouette.png'), decodeDataUrl(silhouetteData));
  fs.writeFileSync(path.join(output, 'body-silhouette.png'), decodeDataUrl(bodySilhouetteData));
  fs.writeFileSync(path.join(output, 'photo-body-geometry-mask.png'), decodeDataUrl(photoBodyData));
  fs.writeFileSync(path.join(output, 'runtime.json'), JSON.stringify({
    buildKey,
    canvasSize,
    camera: cameraState,
    projectedBodyFeatures,
    projectedMasks,
    projectedLandmarks,
    anchorInspection,
    validation,
    environment: {
      browserExecutable,
      browserVersion: browser.version(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
      threeRevision: await page.evaluate(() => window.__LS400_QA__.threeRevision),
      localUrl: `http://127.0.0.1:${port}/windows/interactive-3d-prototype/index.html?qa=foundation&foundation=${buildKey}`,
    },
    consoleErrors,
    pageErrors,
    failedResponses,
  }, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  server.close();
}

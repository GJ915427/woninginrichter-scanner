#!/usr/bin/env node

/**
 * sync_web_assets.js
 *
 * Synchronizes web assets from the project root into the Capacitor distribution web directory (`www/`).
 * Specifically:
 * - Copies `scanner.html` to `www/index.html` (the primary Capacitor WebView entry point).
 * - Copies `scanner.html` to `www/scanner.html` (backward compatibility for direct browser testing).
 * - Preserves any static assets or subdirectories if present.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const WWW_DIR = path.join(ROOT_DIR, 'www');
const SCANNER_HTML_SRC = path.join(ROOT_DIR, 'scanner.html');

function syncAssets() {
  console.log('[sync_web_assets] Starting web asset synchronization...');

  if (!fs.existsSync(SCANNER_HTML_SRC)) {
    console.error(`[sync_web_assets] ERROR: Source file not found: ${SCANNER_HTML_SRC}`);
    process.exit(1);
  }

  // Ensure target www directory exists
  if (!fs.existsSync(WWW_DIR)) {
    console.log(`[sync_web_assets] Creating target web directory: ${WWW_DIR}`);
    fs.mkdirSync(WWW_DIR, { recursive: true });
  }

  const srcStats = fs.statSync(SCANNER_HTML_SRC);
  console.log(`[sync_web_assets] Source scanner.html size: ${srcStats.size} bytes`);

  // Target 1: www/index.html
  const indexDest = path.join(WWW_DIR, 'index.html');
  fs.copyFileSync(SCANNER_HTML_SRC, indexDest);
  console.log(`[sync_web_assets] Copied -> ${path.relative(ROOT_DIR, indexDest)} (${fs.statSync(indexDest).size} bytes)`);

  // Target 2: www/scanner.html
  const scannerDest = path.join(WWW_DIR, 'scanner.html');
  fs.copyFileSync(SCANNER_HTML_SRC, scannerDest);
  console.log(`[sync_web_assets] Copied -> ${path.relative(ROOT_DIR, scannerDest)} (${fs.statSync(scannerDest).size} bytes)`);

  // Copy any optional asset directories if present
  const optionalDirs = ['assets', 'icons', 'css', 'js'];
  for (const dirName of optionalDirs) {
    const srcSubDir = path.join(ROOT_DIR, dirName);
    const destSubDir = path.join(WWW_DIR, dirName);
    if (fs.existsSync(srcSubDir) && fs.statSync(srcSubDir).isDirectory()) {
      copyFolderRecursiveSync(srcSubDir, destSubDir);
      console.log(`[sync_web_assets] Synchronized directory -> ${dirName}/`);
    }
  }

  console.log('[sync_web_assets] Web assets synchronization completed successfully.');
}

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  for (const file of files) {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.statSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  }
}

syncAssets();

/**
 * Empirical Adversarial Test: Real Pixel 9 Pro XL vs Real Samsung S24 Ultra vs test 1.6 mock
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const scannerHtml = fs.readFileSync(path.join(__dirname, '../scanner.html'), 'utf-8');

// Extract scanner script logic or run mock
function runScannerDetection(mockDevices, trackCapabilities = {}) {
  // Simulate the heuristic logic from scanner.html lines 948-1002
  const videoDevices = mockDevices.filter(d => d.kind === 'videoinput');

  function scoreUltraWideLabel(label) {
    if (!label) return 0;
    const l = label.toLowerCase();
    if (l.includes('telephoto') || l.includes('tele') || l.includes('periscope') || /(?<![.\d])([2-9]|10)x\b/.test(l)) {
      return 0;
    }
    let score = 0;
    if (l.includes('ultra-wide') || l.includes('ultrawide') || l.includes('ultra wide')) score += 100;
    if (l.includes('0.5x') || l.includes('0.5 x') || l.includes('0,5x') || l.includes('.5x')) score += 95;
    if (l.includes('wide-angle') || l.includes('wide angle')) score += 40;
    if (l.includes('camera2 1') && l.includes('back')) score += 75;
    if (l.includes('camera2 2') && l.includes('back')) score += 70;
    if (l.includes('camera 2') && !l.includes('front')) score += 60;
    if (l.includes('back 1') || l.includes('rear 1')) score += 75;
    if (l.includes('back 2') || l.includes('rear 2')) score += 65;
    return score;
  }

  function scoreStandardLabel(label) {
    if (!label) return 0;
    const l = label.toLowerCase();
    if (l.includes('front') || l.includes('user') || l.includes('selfie')) return 0;
    if (l.includes('telephoto') || l.includes('tele') || l.includes('periscope') || /(?<![.\d])([2-9]|10)x\b/.test(l)) return 0;
    let score = 0;
    if (l.includes('camera2 0') && l.includes('back')) score += 100;
    if (l.includes('back 0') || l.includes('rear 0')) score += 95;
    if (l.includes('main') || l.includes('standard') || l.includes('primary')) score += 90;
    if (l.includes('1x') || l.includes('1.0x')) score += 85;
    if (l.includes('back') || l.includes('environment')) score += 50;
    return score;
  }

  let ultraWideDeviceId = null;
  let standardDeviceId = null;
  let hasUltraWide = false;
  let minZoom = 1.0;
  let maxZoom = 1.0;

  const allBackDevices = videoDevices.filter(d => {
    const l = (d.label || '').toLowerCase();
    const isFront = l.includes('front') || l.includes('user') || l.includes('selfie') || l.includes('facing front');
    const isTele = l.includes('telephoto') || l.includes('tele') || l.includes('periscope') || /(?<![.\d])([2-9]|10)x\b/.test(l);
    return !isFront && !isTele;
  });

  let bestUltraScore = 0;
  let bestStdScore = -1;

  for (const dev of videoDevices) {
    const uScore = scoreUltraWideLabel(dev.label);
    if (uScore > bestUltraScore) {
      bestUltraScore = uScore;
      ultraWideDeviceId = dev.deviceId;
    }
    const sScore = scoreStandardLabel(dev.label);
    if (sScore > bestStdScore) {
      bestStdScore = sScore;
      standardDeviceId = dev.deviceId;
    }
  }

  if (bestUltraScore >= 50 && ultraWideDeviceId) {
    hasUltraWide = true;
    minZoom = 0.5;
    if (!standardDeviceId) {
      const other = videoDevices.find(d => d.deviceId !== ultraWideDeviceId);
      if (other) standardDeviceId = other.deviceId;
    }
  } else if (allBackDevices.length >= 2 && !ultraWideDeviceId) {
    hasUltraWide = true;
    minZoom = 0.5;
    ultraWideDeviceId = allBackDevices[1].deviceId;
    standardDeviceId = allBackDevices[0].deviceId;
  }

  // Tier 2: Check trackCapabilities
  if (!hasUltraWide && trackCapabilities.zoom) {
    if (typeof trackCapabilities.zoom.min === 'number' && trackCapabilities.zoom.min <= 0.6) {
      hasUltraWide = true;
      minZoom = trackCapabilities.zoom.min;
      maxZoom = trackCapabilities.zoom.max || 1.0;
    }
  }

  return { hasUltraWide, ultraWideDeviceId, standardDeviceId, minZoom, maxZoom };
}

// 1. REAL Pixel 9 Pro XL in Chrome (per RCA report & Matrix)
const realPixelDevices = [
  { deviceId: 'pixel-back-main', kind: 'videoinput', label: 'camera2 0, facing back' },
  { deviceId: 'pixel-front-selfie', kind: 'videoinput', label: 'camera2 1, facing front' }
];
const realPixelCaps = { zoom: { min: 1.0, max: 8.0, step: 0.1 } }; // Clamped to 1.0 by Chromium VideoCaptureCamera2

const pixelResult = runScannerDetection(realPixelDevices, realPixelCaps);
console.log('REAL PIXEL 9 PRO XL DETECTION RESULT:');
console.log(pixelResult);

// 2. REAL Samsung Galaxy S24 Ultra in Chrome (per Matrix)
const realSamsungDevices = [
  { deviceId: 'samsung-main', kind: 'videoinput', label: 'camera2 0, facing back' },
  { deviceId: 'samsung-front', kind: 'videoinput', label: 'camera2 1, facing front' },
  { deviceId: 'samsung-uw', kind: 'videoinput', label: 'camera2 2, facing back' },
  { deviceId: 'samsung-tele3', kind: 'videoinput', label: 'camera2 3, facing back' },
  { deviceId: 'samsung-tele5', kind: 'videoinput', label: 'camera2 4, facing back' }
];
const realSamsungCaps = { zoom: { min: 1.0, max: 10.0, step: 0.1 } };

const samsungResult = runScannerDetection(realSamsungDevices, realSamsungCaps);
console.log('\nREAL SAMSUNG GALAXY S24 ULTRA DETECTION RESULT:');
console.log(samsungResult);

// 3. Mock in test 1.6
const mockTest16Devices = [
  { deviceId: 'cam-main-pixel', kind: 'videoinput', label: 'camera2 0, facing back' },
  { deviceId: 'cam-front-pixel', kind: 'videoinput', label: 'camera2 1, facing front' },
  { deviceId: 'cam-uw-pixel', kind: 'videoinput', label: 'camera2 2, facing back' },
  { deviceId: 'cam-tele-pixel', kind: 'videoinput', label: 'camera2 3, facing back' }
];
const mockTest16Result = runScannerDetection(mockTest16Devices, {});
console.log('\nTEST 1.6 MOCK RESULT:');
console.log(mockTest16Result);

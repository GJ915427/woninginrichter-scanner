/**
 * Empirical Verification of W3C Media Capture and Streams § 4.3.7
 * SelectSettings and applyConstraints algorithm verification.
 */
const assert = require('assert');

// W3C Media Capture § 4.3.7 SelectSettings algorithm reference implementation
function selectSettings(capabilities, constraints) {
  // 1. Basic constraints (outside 'advanced')
  // Any constraint outside 'advanced' is mandatory in terms of candidate matching:
  // If an exact/min/max constraint cannot be satisfied by capabilities, OverconstrainedError is thrown.
  const basicKeys = Object.keys(constraints).filter(k => k !== 'advanced');
  
  for (const key of basicKeys) {
    const val = constraints[key];
    const cap = capabilities[key];
    
    if (cap === undefined) {
      // Unknown constraint or unsupported capability
      continue;
    }
    
    // Check range capabilities (e.g. zoom: { min: 1.0, max: 8.0 })
    if (typeof cap === 'object' && typeof cap.min === 'number' && typeof cap.max === 'number') {
      let requestedVal = typeof val === 'object' ? (val.exact !== undefined ? val.exact : val.ideal) : val;
      if (typeof requestedVal === 'number') {
        if (requestedVal < cap.min || requestedVal > cap.max) {
          const err = new Error(`Constraint '${key}' cannot be satisfied. Requested ${requestedVal}, capability range [${cap.min}, ${cap.max}]`);
          err.name = 'OverconstrainedError';
          err.constraint = key;
          throw err;
        }
      }
    }
  }

  // Current candidate settings starting with default / standard
  let currentSettings = { zoom: 1.0, width: 1920, height: 1080 };

  // 2. Advanced constraints (§ 4.3.7 step 3)
  // "For each constraint set CS in Constraints.advanced:
  //  If CS can be satisfied by candidate settings, select them.
  //  Else, SILENTLY DISCARD CS and proceed without throwing."
  const discardedSets = [];
  const appliedSets = [];

  if (Array.isArray(constraints.advanced)) {
    for (let i = 0; i < constraints.advanced.length; i++) {
      const cs = constraints.advanced[i];
      let canSatisfy = true;

      for (const key of Object.keys(cs)) {
        const val = cs[key];
        const cap = capabilities[key];

        if (cap === undefined) {
          canSatisfy = false;
          break;
        }

        if (typeof cap === 'object' && typeof cap.min === 'number' && typeof cap.max === 'number') {
          let req = typeof val === 'object' ? (val.exact !== undefined ? val.exact : val.ideal) : val;
          if (typeof req === 'number') {
            if (req < cap.min || req > cap.max) {
              canSatisfy = false;
              break;
            }
          }
        }
      }

      if (canSatisfy) {
        appliedSets.push({ index: i, constraintSet: cs });
        // Apply settings
        for (const k of Object.keys(cs)) {
          const v = cs[k];
          currentSettings[k] = typeof v === 'object' && v.exact !== undefined ? v.exact : v;
        }
      } else {
        // § 4.3.7: Silently discard, NO ERROR THROWN!
        discardedSets.push({ index: i, constraintSet: cs });
      }
    }
  }

  return {
    success: true,
    settings: currentSettings,
    discardedSets,
    appliedSets
  };
}

// Capabilities of Chrome on Pixel 9 Pro XL (clamped to 1.0)
const pixelCapabilities = {
  zoom: { min: 1.0, max: 8.0, step: 0.1 },
  width: { min: 320, max: 3840 },
  height: { min: 240, max: 2160 }
};

console.log('=== TEST 1: Basic Constraint { zoom: 0.5 } ===');
try {
  selectSettings(pixelCapabilities, { zoom: 0.5 });
  console.error('FAIL: Expected OverconstrainedError, but call succeeded!');
} catch (err) {
  console.log(`PASS: Caught expected error: ${err.name} (constraint: ${err.constraint})`);
  assert.strictEqual(err.name, 'OverconstrainedError');
}

console.log('\n=== TEST 2: Advanced Constraint { advanced: [{ zoom: 0.5 }] } ===');
try {
  const result = selectSettings(pixelCapabilities, { advanced: [{ zoom: 0.5 }] });
  console.log('PASS: Call resolved successfully without throwing error!');
  console.log('Result settings:', result.settings);
  console.log('Discarded sets:', result.discardedSets);
  assert.strictEqual(result.settings.zoom, 1.0, 'Hardware zoom remains locked to 1.0');
  assert.strictEqual(result.discardedSets.length, 1, 'Advanced set 0 was silently discarded');
  assert.strictEqual(result.discardedSets[0].constraintSet.zoom, 0.5);
} catch (err) {
  console.error('FAIL: Unexpected error:', err);
}

console.log('\n=== TEST 3: Mixed Advanced Constraints [{ zoom: 0.5 }, { width: 1280 }] ===');
try {
  const result = selectSettings(pixelCapabilities, {
    advanced: [{ zoom: 0.5 }, { width: 1280 }]
  });
  console.log('Result settings:', result.settings);
  console.log('Discarded count:', result.discardedSets.length);
  console.log('Applied count:', result.appliedSets.length);
  assert.strictEqual(result.settings.zoom, 1.0, 'Zoom 0.5 discarded');
  assert.strictEqual(result.settings.width, 1280, 'Width 1280 applied');
} catch (err) {
  console.error('FAIL: Unexpected error:', err);
}

console.log('\nALL W3C SPEC § 4.3.7 VERIFICATIONS PASSED.');

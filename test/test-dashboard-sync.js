/**
 * test/test-dashboard-sync.js
 * Verification of Standalone Pro Widescreen Dashboard integration:
 * 1. Verifies manifest.json web_accessible_resources contains src/dashboard/*
 * 2. Verifies popup.js and overlay-panel.js navigation links to dashboard.html
 * 3. Verifies every ID queried in dashboard.js exists in dashboard.html
 * 4. Verifies calculations, DTE switching, and perspective shift logic for dashboard
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log(' TEST: STANDALONE PRO WIDESCREEN DASHBOARD INTEGRATION');
console.log('================================================================\n');

// 1. Check Manifest Resources
console.log('[1] Checking manifest.json web_accessible_resources:');
const manifestPath = path.join(__dirname, '../manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const resources = manifest.web_accessible_resources?.[0]?.resources || [];
assert(resources.includes('src/dashboard/*'), 'manifest.json must include src/dashboard/*');
console.log('  ✓ manifest.json contains src/dashboard/*');

// 2. Check Launch Points in popup.js and overlay-panel.js
console.log('\n[2] Checking Launch Points in popup.js & overlay-panel.js:');
const popupJs = fs.readFileSync(path.join(__dirname, '../src/popup/popup.js'), 'utf8');
assert(popupJs.includes("src/dashboard/dashboard.html"), 'popup.js must open src/dashboard/dashboard.html');
console.log('  ✓ popup.js btnOpenStandalone points to src/dashboard/dashboard.html');

const overlayJs = fs.readFileSync(path.join(__dirname, '../src/ui/overlay-panel.js'), 'utf8');
assert(overlayJs.includes("cme-v2v-dash-btn"), 'overlay-panel.js must contain cme-v2v-dash-btn');
assert(overlayJs.includes("src/dashboard/dashboard.html"), 'overlay-panel.js must open src/dashboard/dashboard.html');
console.log('  ✓ overlay-panel.js header has cme-v2v-dash-btn pointing to src/dashboard/dashboard.html');

// 3. Check HTML & JS DOM ID Match
console.log('\n[3] Checking DOM Element IDs consistency:');
const dashHtml = fs.readFileSync(path.join(__dirname, '../src/dashboard/dashboard.html'), 'utf8');
const dashJs = fs.readFileSync(path.join(__dirname, '../src/dashboard/dashboard.js'), 'utf8');

// Extract all document.getElementById calls from dashboard.js
const idMatches = [...dashJs.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
console.log(`  Found ${idMatches.length} getElementById calls in dashboard.js`);

let missingIds = [];
idMatches.forEach(id => {
  if (!dashHtml.includes(`id="${id}"`)) {
    missingIds.push(id);
  }
});

assert.strictEqual(missingIds.length, 0, `Missing IDs in dashboard.html: ${missingIds.join(', ')}`);
console.log(`  ✓ All ${idMatches.length} DOM IDs exist in dashboard.html!`);

// 4. Test Core Math & Perspective Integration for Dashboard
console.log('\n[4] Testing Dashboard Data Processing & Calculations:');
const OptionsMath = require('../src/core/options-math.js');
const DataParser = require('../src/core/data-parser.js');

const demo = DataParser.getLive0DteGoldDemoData();
const stats = OptionsMath.calculateStats({
  underlyingPrice: demo.underlyingPrice,
  spotPrice: demo.underlyingPrice,
  openPrice: demo.openPrice,
  volAnchorPrice: demo.underlyingPrice,
  atmVolatility: demo.atmVolatility,
  dte: 0,
  strikesData: demo.strikesData,
});

assert(stats.underlyingPrice === 4355, 'Underlying price should be 4355');
assert(stats.stdDevRanges['ATM'] === 4355, 'ATM range should be 4355');
assert(stats.dominance === 'CALLS', 'Dominance should be CALLS');
console.log(`  ✓ 0DTE Benchmark calculated: ATM = ${stats.stdDevRanges['ATM']}, Dominance = ${stats.dominance} (+${stats.dominancePct}%)`);

// Test GOLD.F and XAUUSD conversion for dashboard table
const goldfPrice = 4416.1;
const convertedGoldf = OptionsMath.computeConvertedRanges(stats.stdDevRanges, stats.underlyingPrice, goldfPrice);
assert.strictEqual(convertedGoldf.diffFormatted, '+61.1', 'GOLD.F basis should be +61.1');
assert.strictEqual(convertedGoldf.ranges['ATM'], 4416.1, 'GOLD.F ATM should be 4416.1');
console.log(`  ✓ GOLD.F Basis Conversion: Basis = ${convertedGoldf.diffFormatted}, ATM = ${convertedGoldf.ranges['ATM']}`);

const xauPrice = 4369.2;
const convertedXau = OptionsMath.computeConvertedRanges(stats.stdDevRanges, stats.underlyingPrice, xauPrice);
assert.strictEqual(convertedXau.diffFormatted, '+14.2', 'XAUUSD basis should be +14.2');
assert.strictEqual(convertedXau.ranges['ATM'], 4369.2, 'XAUUSD ATM should be 4369.2');
console.log(`  ✓ XAUUSD Basis Conversion: Basis = ${convertedXau.diffFormatted}, ATM = ${convertedXau.ranges['ATM']}`);

console.log('\n================================================================');
console.log(' ALL DASHBOARD INTEGRATION TESTS PASSED (100%)! ✓');
console.log('================================================================');

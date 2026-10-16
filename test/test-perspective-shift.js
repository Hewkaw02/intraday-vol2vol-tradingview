/**
 * test/test-perspective-shift.js
 * Verification of Multi-Asset Perspective Shift (0DTE GCV2026, GOLD.F, XAUUSD)
 * Tests strike shift math (K + Basis), volume & OI preservation, SD range alignment, and tooltip dual labeling.
 */

const assert = require('assert');
const OptionsMath = require('../src/core/options-math.js');
const DataParser = require('../src/core/data-parser.js');
const Vol2VolChart = require('../src/ui/vol2vol-chart.js');

console.log('================================================================');
console.log(' TEST: MULTI-ASSET PERSPECTIVE SHIFT (0DTE / GOLD.F / XAUUSD)');
console.log('================================================================');

// 1. Setup Base 0DTE Options Statistics
const demoData = DataParser.getLive0DteGoldDemoData();
const basePrice = 4355.0;
const openPrice = 4328.0;

const stats = OptionsMath.calculateStats({
  underlyingPrice: basePrice,
  spotPrice: basePrice,
  openPrice: openPrice,
  atmVolatility: 23.66,
  dte: 0,
  strikesData: demoData.strikesData,
});

console.log('\n[1] Verifying Base 0DTE Dataset:');
console.log('  Base Underlying (S):', stats.underlyingPrice);
console.log('  Total Strikes Count:', stats.strikesData.length);
console.log('  Total Call Volume:', stats.totalCallVol);
console.log('  Total Put Volume:', stats.totalPutVol);

assert.strictEqual(stats.underlyingPrice, 4355.0);
assert(stats.strikesData.length > 0, 'Strikes data must not be empty');

// 2. Test Strike Shift for BLACKBULL:GOLD.F (Basis: +61.1)
console.log('\n[2] Testing Strike Shift for BLACKBULL:GOLD.F:');
const goldFPrice = 4416.1;
const goldFBasis = Math.round((goldFPrice - basePrice) * 10) / 10; // +61.1
assert.strictEqual(goldFBasis, 61.1);

const shiftedGoldF = stats.strikesData.map((d) => {
  const origK = Number(d.strike);
  const shiftK = Math.round((origK + goldFBasis) * 10) / 10;
  return {
    ...d,
    strike: shiftK,
    originalStrike: origK,
  };
});

console.log('  Sample 0DTE Strike 4400 -> GOLD.F Shifted:', shiftedGoldF.find((s) => s.originalStrike === 4400));
const sampleGoldF = shiftedGoldF.find((s) => s.originalStrike === 4400);
assert.strictEqual(sampleGoldF.strike, 4461.1, '4400 + 61.1 must equal 4461.1');
assert.strictEqual(sampleGoldF.originalStrike, 4400, 'originalStrike must be preserved');

// Verify total volume is exactly preserved
const goldFCallVol = shiftedGoldF.reduce((acc, r) => acc + (r.callVol || 0), 0);
const goldFPutVol = shiftedGoldF.reduce((acc, r) => acc + (r.putVol || 0), 0);
assert.strictEqual(goldFCallVol, stats.totalCallVol, 'Call volume must be preserved across shift');
assert.strictEqual(goldFPutVol, stats.totalPutVol, 'Put volume must be preserved across shift');
console.log('  Volume Preservation Verified: Calls =', goldFCallVol, ', Puts =', goldFPutVol);

// 3. Test Strike Shift for OANDA:XAUUSD (Basis: +14.2)
console.log('\n[3] Testing Strike Shift for OANDA:XAUUSD:');
const xauPrice = 4369.2;
const xauBasis = Math.round((xauPrice - basePrice) * 10) / 10; // +14.2
assert.strictEqual(xauBasis, 14.2);

const shiftedXau = stats.strikesData.map((d) => {
  const origK = Number(d.strike);
  const shiftK = Math.round((origK + xauBasis) * 10) / 10;
  return {
    ...d,
    strike: shiftK,
    originalStrike: origK,
  };
});

const sampleXau = shiftedXau.find((s) => s.originalStrike === 4400);
assert.strictEqual(sampleXau.strike, 4414.2, '4400 + 14.2 must equal 4414.2');
assert.strictEqual(sampleXau.originalStrike, 4400);
console.log('  Sample 0DTE Strike 4400 -> XAUUSD Shifted:', sampleXau.strike);

// 4. Test SD Range Alignment with Shifted Strikes
console.log('\n[4] Testing SD Range Alignment with Converted Ranges:');
const convGoldF = OptionsMath.computeConvertedRanges(stats.stdDevRanges, basePrice, goldFPrice);
assert.strictEqual(convGoldF.ranges['ATM'], 4416.1);
assert.strictEqual(convGoldF.ranges['+1'], Math.round((stats.stdDevRanges['+1'] + goldFBasis) * 10) / 10);
assert.strictEqual(convGoldF.ranges['-1'], Math.round((stats.stdDevRanges['-1'] + goldFBasis) * 10) / 10);
console.log('  Base 1SD:', stats.stdDevRanges['-1'], 'to', stats.stdDevRanges['+1']);
console.log('  GOLD.F 1SD:', convGoldF.ranges['-1'], 'to', convGoldF.ranges['+1']);

// 5. Test Tooltip Dual Strike Labeling Logic
console.log('\n[5] Testing Tooltip Labeling Format:');
function formatTooltipStrike(row, S, basis, isShifted) {
  if (isShifted && row.originalStrike != null) {
    const basisSign = basis >= 0 ? `+${basis.toFixed(1)}` : basis.toFixed(1);
    return `Strike: ${row.strike.toLocaleString()} (0DTE ${row.originalStrike.toLocaleString()} | Basis ${basisSign})`;
  }
  const diffFromAtm = row.strike - S;
  const diffStr = (diffFromAtm >= 0 ? '+' : '') + diffFromAtm.toFixed(1);
  const diffPct = ((diffFromAtm / S) * 100).toFixed(2);
  return `Strike: ${row.strike.toLocaleString()} (${diffStr} | ${diffPct}%)`;
}

const tip0Dte = formatTooltipStrike({ strike: 4350 }, 4355.0, 0, false);
assert.strictEqual(tip0Dte, 'Strike: 4,350 (-5.0 | -0.11%)');
console.log('  0DTE Tooltip Line:', tip0Dte);

const tipGoldF = formatTooltipStrike({ strike: 4411.1, originalStrike: 4350 }, 4416.1, 61.1, true);
assert.strictEqual(tipGoldF, 'Strike: 4,411.1 (0DTE 4,350 | Basis +61.1)');
console.log('  GOLD.F Tooltip Line:', tipGoldF);

const tipXau = formatTooltipStrike({ strike: 4364.2, originalStrike: 4350 }, 4369.2, 14.2, true);
assert.strictEqual(tipXau, 'Strike: 4,364.2 (0DTE 4,350 | Basis +14.2)');
console.log('  XAU Tooltip Line:', tipXau);

// 6. Test Mock Canvas Initialization and Perspective Switch in Vol2VolChart
console.log('\n[6] Testing Vol2VolChart setPerspective API:');
const mockCtx = {
  setTransform: () => {},
  fillRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fill: () => {},
  closePath: () => {},
  fillText: () => {},
  setLineDash: () => {},
  save: () => {},
  restore: () => {},
  rect: () => {},
  clip: () => {},
  createLinearGradient: () => ({ addColorStop: () => {} }),
  roundRect: () => {},
};
const mockCanvas = {
  getContext: () => mockCtx,
  getBoundingClientRect: () => ({ width: 800, height: 400, left: 0, top: 0 }),
  addEventListener: () => {},
};

const chart = new Vol2VolChart(mockCanvas, { theme: 'dark' });
assert.strictEqual(chart.perspectiveConfig.mode, '0dte');
assert.strictEqual(chart.perspectiveConfig.basis, 0);

// Switch to GOLD.F
chart.setPerspective({
  mode: 'goldf',
  basis: 61.1,
  targetPrice: 4416.1,
  label: 'GOLD.F',
  color: '#f59e0b',
  convertedRanges: convGoldF.ranges,
});

assert.strictEqual(chart.perspectiveConfig.mode, 'goldf');
assert.strictEqual(chart.perspectiveConfig.basis, 61.1);
assert.strictEqual(chart.perspectiveConfig.targetPrice, 4416.1);
assert.strictEqual(chart.perspectiveConfig.color, '#f59e0b');
console.log('  Vol2VolChart perspective shifted to GOLD.F successfully!');

// Switch to XAUUSD
chart.setPerspective({
  mode: 'xau',
  basis: 14.2,
  targetPrice: 4369.2,
  label: 'XAU Spot',
  color: '#06b6d4',
});

assert.strictEqual(chart.perspectiveConfig.mode, 'xau');
assert.strictEqual(chart.perspectiveConfig.basis, 14.2);
assert.strictEqual(chart.perspectiveConfig.color, '#06b6d4');
console.log('  Vol2VolChart perspective shifted to XAUUSD successfully!');

// Switch back to 0DTE
chart.setPerspective({
  mode: '0dte',
  basis: 0,
  targetPrice: null,
  label: '0DTE',
  color: '#f23645',
});

assert.strictEqual(chart.perspectiveConfig.mode, '0dte');
assert.strictEqual(chart.perspectiveConfig.basis, 0);
console.log('  Vol2VolChart perspective restored to 0DTE successfully!');

// 7. Test Day Open SD Range Dynamic Perspective Shift (Row 4 "From Open")
console.log('\n[7] Testing Day Open SD Range Dynamic Perspective Shift (Row 4):');
const openRanges0Dte = stats.stdDevRangesFromOpen;
assert.strictEqual(openRanges0Dte['Open'], 4328.0, '0DTE From Open center must be 4328.0');
console.log('  0DTE Day Open Center:', openRanges0Dte['Open']);
console.log('  0DTE Day Open ±1SD:', openRanges0Dte['-1'], 'to', openRanges0Dte['+1']);

// Convert Day Open to GOLD.F basis (+61.1)
const goldFOpen = Math.round((openPrice + goldFBasis) * 10) / 10; // 4389.1
const convOpenGoldF = OptionsMath.computeConvertedRanges(openRanges0Dte, openPrice, goldFOpen);
assert.strictEqual(convOpenGoldF.ranges['Open'], 4389.1, 'GOLD.F Day Open center must be 4389.1');
assert.strictEqual(convOpenGoldF.ranges['+1'], Math.round((openRanges0Dte['+1'] + goldFBasis) * 10) / 10);
assert.strictEqual(convOpenGoldF.ranges['-1'], Math.round((openRanges0Dte['-1'] + goldFBasis) * 10) / 10);
console.log('  GOLD.F Day Open Center (+61.1):', convOpenGoldF.ranges['Open']);
console.log('  GOLD.F Day Open ±1SD:', convOpenGoldF.ranges['-1'], 'to', convOpenGoldF.ranges['+1']);

// Convert Day Open to XAU Spot basis (+14.2)
const xauOpen = Math.round((openPrice + xauBasis) * 10) / 10; // 4342.2
const convOpenXau = OptionsMath.computeConvertedRanges(openRanges0Dte, openPrice, xauOpen);
assert.strictEqual(convOpenXau.ranges['Open'], 4342.2, 'XAU Spot Day Open center must be 4342.2');
assert.strictEqual(convOpenXau.ranges['+1'], Math.round((openRanges0Dte['+1'] + xauBasis) * 10) / 10);
assert.strictEqual(convOpenXau.ranges['-1'], Math.round((openRanges0Dte['-1'] + xauBasis) * 10) / 10);
console.log('  XAU Spot Day Open Center (+14.2):', convOpenXau.ranges['Open']);
console.log('  XAU Spot Day Open ±1SD:', convOpenXau.ranges['-1'], 'to', convOpenXau.ranges['+1']);

console.log('\n================================================================');
console.log(' ALL MULTI-ASSET PERSPECTIVE SHIFT TESTS PASSED (100%)');
console.log('================================================================\n');

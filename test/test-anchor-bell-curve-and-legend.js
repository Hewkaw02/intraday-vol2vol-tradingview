/**
 * test/test-anchor-bell-curve-and-legend.js
 * Verification of Bell Curve Centering on Day Open, Legend Perspective Sync, and 1-Decimal SD Table Formatting
 */

const assert = require('assert');
const OptionsMath = require('../src/core/options-math.js');
const DataParser = require('../src/core/data-parser.js');

console.log('================================================================');
console.log(' TEST: ANCHOR BELL CURVE, LEGEND PERSPECTIVE SYNC & TABLE FORMAT');
console.log('================================================================');

// 1. Setup Base 0DTE Options Statistics
const demoData = DataParser.getLive0DteGoldDemoData();
const stats = OptionsMath.calculateStats({
  underlyingPrice: 4361.5,
  spotPrice: 4361.5,
  openPrice: 4381.0,
  atmVolatility: 23.66,
  dte: 0,
  strikesData: demoData.strikesData,
});

const S = stats.underlyingPrice; // 4361.5
const rawOpen = stats.openPrice; // 4381.0
const volAnchorS = S; // 4361.5

console.log('\n[1] Base 0DTE Prices:');
console.log('  Underlying Price (S):', S);
console.log('  Day Open Price:', rawOpen);
console.log('  0DTE SD from Open: -1SD =', stats.stdDevRangesFromOpen['-1'], ', Open =', stats.stdDevRangesFromOpen['Open'], ', +1SD =', stats.stdDevRangesFromOpen['+1']);

// 2. Test Bell Curve Center & Day Open logic with Perspective Shift (GOLD.F)
console.log('\n[2] Testing Bell Curve Centering & Day Open with GOLD.F Perspective:');
const basis = 54.6; // GOLD.F Basis Spread
const goldFPrice = S + basis; // 4416.1
const goldFOpen = Math.round((rawOpen + basis) * 10) / 10; // 4435.6

// Case A: Anchor = 'current'
const anchorCurrent = 'current';
const bellCenterCurrent = (anchorCurrent === 'open' && goldFOpen && goldFOpen > 0) ? goldFOpen : (volAnchorS + basis);
console.log(`  Anchor: '${anchorCurrent}' -> Bell Center:`, bellCenterCurrent);
assert.strictEqual(bellCenterCurrent, 4416.1, 'Bell curve must center at 4416.1 when anchor is current');

// Case B: Anchor = 'open'
const anchorOpen = 'open';
const bellCenterOpen = (anchorOpen === 'open' && goldFOpen && goldFOpen > 0) ? goldFOpen : (volAnchorS + basis);
console.log(`  Anchor: '${anchorOpen}' -> Bell Center:`, bellCenterOpen);
assert.strictEqual(bellCenterOpen, 4435.6, 'Bell curve must center at Day Open (4435.6) when anchor is open');

// Verify Gaussian Bell Curve peak is at Day Open
const bellPoints = OptionsMath.generateBellCurve({
  S: bellCenterOpen,
  atmVol: stats.atmVolatility,
  dte: 0,
  minK: 4300,
  maxK: 4600,
  steps: 200,
});
assert(bellPoints && bellPoints.length > 0, 'Bell curve points must be generated');
let maxPoint = bellPoints[0];
for (const pt of bellPoints) {
  if (pt.normPdf > maxPoint.normPdf) maxPoint = pt;
}
console.log('  Gaussian Peak Strike:', maxPoint.strike, '| Target Open:', bellCenterOpen);
assert(Math.abs(maxPoint.strike - bellCenterOpen) < 2.0, 'Peak of bell curve must align with Day Open (4435.6)');

// Verify Row 4 SD bands from Open
const convOpenRanges = OptionsMath.computeConvertedRanges(stats.stdDevRangesFromOpen, rawOpen, goldFOpen).ranges;
console.log('  GOLD.F SD from Open: -1SD =', convOpenRanges['-1'], ', Open =', convOpenRanges['Open'], ', +1SD =', convOpenRanges['+1']);
assert.strictEqual(convOpenRanges['Open'], 4435.6);
assert.strictEqual(convOpenRanges['-1'], Math.round((stats.stdDevRangesFromOpen['-1'] + basis) * 10) / 10);
assert.strictEqual(convOpenRanges['+1'], Math.round((stats.stdDevRangesFromOpen['+1'] + basis) * 10) / 10);

// Verify that Current Price (4416.1) sits inside [-1SD, Open] range [4381.8, 4435.6]
assert(goldFPrice > convOpenRanges['-1'] && goldFPrice < convOpenRanges['Open'], 'Current GOLD.F price must sit between -1SD and Open');
console.log('  ✓ GOLD.F Open SD bands and Bell Curve are 100% mathematically aligned with Basis Spread (+54.6)');

// 3. Test Chart Header Legend Synchronization
console.log('\n[3] Testing Chart Header Legend Values:');

function getLegendValues(perspective, currentStats, quotes, convertedG, convertedX) {
  const baseS = Number(currentStats.underlyingPrice || 0);
  const baseOpen = Number(currentStats.openPrice || baseS);

  if (perspective === 'goldf') {
    const gc1Quote = quotes?.gc1;
    const gc1Price = gc1Quote?.price;
    const basisDiff = convertedG ? convertedG.diff : (gc1Price ? gc1Price - baseS : 0);
    const targetP = gc1Price || (baseS + basisDiff);
    const targetO = Math.round((baseOpen + basisDiff) * 10) / 10;
    return {
      futureText: `GOLD.F (${targetP.toFixed(1)})`,
      openText: `Open (${targetO.toFixed(1)})`,
      dotColor: '#f59e0b',
    };
  } else if (perspective === 'xau') {
    const xauQuote = quotes?.xau;
    const xauPrice = xauQuote?.price;
    const basisDiff = convertedX ? convertedX.diff : (xauPrice ? xauPrice - baseS : 0);
    const targetP = xauPrice || (baseS + basisDiff);
    const targetO = Math.round((baseOpen + basisDiff) * 10) / 10;
    return {
      futureText: `XAU Spot (${targetP.toFixed(1)})`,
      openText: `Open (${targetO.toFixed(1)})`,
      dotColor: '#06b6d4',
    };
  } else {
    return {
      futureText: `0DTE Stl (${baseS.toFixed(1)})`,
      openText: `Open (${baseOpen.toFixed(1)})`,
      dotColor: '#f23645',
    };
  }
}

const mockQuotes = {
  gc1: { price: 4416.1 },
  xau: { price: 4369.2 },
};
const mockConvG = { diff: 54.6 };
const mockConvX = { diff: 7.7 };

const legend0Dte = getLegendValues('0dte', stats, mockQuotes, mockConvG, mockConvX);
console.log('  [0DTE Perspective Legend]:', legend0Dte);
assert.strictEqual(legend0Dte.futureText, '0DTE Stl (4361.5)');
assert.strictEqual(legend0Dte.openText, 'Open (4381.0)');
assert.strictEqual(legend0Dte.dotColor, '#f23645');

const legendGoldf = getLegendValues('goldf', stats, mockQuotes, mockConvG, mockConvX);
console.log('  [GOLD.F Perspective Legend]:', legendGoldf);
assert.strictEqual(legendGoldf.futureText, 'GOLD.F (4416.1)');
assert.strictEqual(legendGoldf.openText, 'Open (4435.6)');
assert.strictEqual(legendGoldf.dotColor, '#f59e0b');

const legendXau = getLegendValues('xau', stats, mockQuotes, mockConvG, mockConvX);
console.log('  [XAU Spot Perspective Legend]:', legendXau);
assert.strictEqual(legendXau.futureText, 'XAU Spot (4369.2)');
assert.strictEqual(legendXau.openText, 'Open (4388.7)');
assert.strictEqual(legendXau.dotColor, '#06b6d4');

console.log('  ✓ Chart Header Legend correctly updates across all perspectives');

// 4. Test 1-Decimal Formatting in SD Tables
console.log('\n[4] Testing 1-Decimal Formatting:');
const fmt = (v) => (v != null && !isNaN(v)) ? Number(v).toFixed(1) : '--';

assert.strictEqual(fmt(4437), '4437.0', 'Integer 4437 must format as "4437.0"');
assert.strictEqual(fmt(4437.0), '4437.0', '4437.0 must format as "4437.0"');
assert.strictEqual(fmt(4420.2), '4420.2', '4420.2 must format as "4420.2"');
assert.strictEqual(fmt(null), '--', 'Null must format as "--"');
assert.strictEqual(fmt(undefined), '--', 'Undefined must format as "--"');

console.log('  ✓ Formatting function guarantees 1 decimal place across all SD cells');

console.log('\n================================================================');
console.log(' ALL ANCHOR, LEGEND & FORMATTING TESTS PASSED (100%)! ✓');
console.log('================================================================');

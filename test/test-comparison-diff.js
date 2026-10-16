/**
 * test/test-comparison-diff.js
 * Verification of GC1! Futures & XAUUSD CFD Basis Spread Diff & Converted SD Ranges
 */

const assert = require('assert');
const OptionsMath = require('../src/core/options-math.js');
const DataParser = require('../src/core/data-parser.js');

console.log('================================================================');
console.log(' TEST: GC1! & XAUUSD BASIS SPREAD DIFF & CONVERTED SD RANGES');
console.log('================================================================');

// 1. Setup Base 0DTE Options Statistics (Underlying: COMEX:GCV2026 at 4,355.0)
const demoData = DataParser.getLive0DteGoldDemoData();
const stats = OptionsMath.calculateStats({
  underlyingPrice: 4355.0,
  spotPrice: 4355.0,
  openPrice: 4328.0,
  atmVolatility: 23.66,
  dte: 0,
  strikesData: demoData.strikesData,
});

const baseRanges = stats.stdDevRanges;
const basePrice = stats.underlyingPrice; // 4355.0

console.log('\n[1] Base 0DTE Options Standard Deviation Ranges:');
console.log('  Underlying Price (S):', basePrice);
console.log('  -3 SD:', baseRanges['-3']);
console.log('  -2 SD:', baseRanges['-2']);
console.log('  -1 SD:', baseRanges['-1']);
console.log('  Center (ATM):', baseRanges['ATM']);
console.log('  +1 SD:', baseRanges['+1']);
console.log('  +2 SD:', baseRanges['+2']);
console.log('  +3 SD:', baseRanges['+3']);

assert.strictEqual(baseRanges['ATM'], 4355.0, 'ATM must equal 4355.0');
assert(typeof baseRanges['-1'] === 'number', '-1SD must be a number');
assert(typeof baseRanges['+1'] === 'number', '+1SD must be a number');

// 2. Test BlackBull Markets GOLD.F Futures Basis Spread Conversion
console.log('\n[2] Testing BLACKBULL:GOLD.F Futures Conversion:');
const goldFPrice = 4416.1;
const convGoldF = OptionsMath.computeConvertedRanges(baseRanges, basePrice, goldFPrice);

console.log('  Target GOLD.F Price:', goldFPrice);
console.log('  Computed Basis:', convGoldF.diff);
console.log('  Basis Formatted:', convGoldF.diffFormatted);
console.log('  Converted Ranges:', convGoldF.ranges);

assert.strictEqual(convGoldF.diff, 61.1, 'Basis must be exactly +61.1 (4416.1 - 4355.0)');
assert.strictEqual(convGoldF.diffFormatted, '+61.1', 'diffFormatted must be "+61.1"');
assert.strictEqual(convGoldF.ranges['ATM'], 4416.1, 'Converted Center must match GOLD.F price 4416.1');
assert.strictEqual(convGoldF.ranges['-1'], Number((baseRanges['-1'] + 61.1).toFixed(1)), 'Converted -1SD must match base + 61.1');
assert.strictEqual(convGoldF.ranges['+1'], Number((baseRanges['+1'] + 61.1).toFixed(1)), 'Converted +1SD must match base + 61.1');
assert.strictEqual(convGoldF.ranges['-3'], Number((baseRanges['-3'] + 61.1).toFixed(1)), 'Converted -3SD must match base + 61.1');
assert.strictEqual(convGoldF.ranges['+3'], Number((baseRanges['+3'] + 61.1).toFixed(1)), 'Converted +3SD must match base + 61.1');

// 3. Test OANDA:XAUUSD Spot CFD Basis Spread Conversion
console.log('\n[3] Testing OANDA:XAUUSD CFD Conversion:');
const xauPrice = 4369.2;
const convXau = OptionsMath.computeConvertedRanges(baseRanges, basePrice, xauPrice);

console.log('  Target XAUUSD Price:', xauPrice);
console.log('  Computed Diff:', convXau.diff);
console.log('  Diff Formatted:', convXau.diffFormatted);
console.log('  Converted Ranges:', convXau.ranges);

assert.strictEqual(convXau.diff, 14.2, 'Basis Diff must be +14.2 (4369.2 - 4355.0)');
assert.strictEqual(convXau.diffFormatted, '+14.2', 'diffFormatted must be "+14.2"');
assert.strictEqual(convXau.ranges['ATM'], 4369.2, 'Converted Center must match XAU price 4369.2');
assert.strictEqual(convXau.ranges['-1'], Number((baseRanges['-1'] + 14.2).toFixed(1)), 'Converted -1SD must match base + 14.2');
assert.strictEqual(convXau.ranges['+1'], Number((baseRanges['+1'] + 14.2).toFixed(1)), 'Converted +1SD must match base + 14.2');

// 4. Test Negative Spread (Discount)
console.log('\n[4] Testing Negative Spread Conversion (Target < Base):');
const lowerPrice = 4340.0;
const convNeg = OptionsMath.computeConvertedRanges(baseRanges, basePrice, lowerPrice);

console.log('  Target Lower Price:', lowerPrice);
console.log('  Diff Formatted:', convNeg.diffFormatted);
assert.strictEqual(convNeg.diff, -15.0, 'Diff must be -15.0');
assert.strictEqual(convNeg.diffFormatted, '-15.0', 'diffFormatted must be "-15.0"');
assert.strictEqual(convNeg.ranges['ATM'], 4340.0, 'Converted Center must match 4340.0');
assert.strictEqual(convNeg.ranges['+1'], Number((baseRanges['+1'] - 15.0).toFixed(1)), 'Converted +1SD must subtract 15.0');

// 5. Test Edge Cases (Invalid inputs)
console.log('\n[5] Testing Edge Cases:');
const nullBase = OptionsMath.computeConvertedRanges(null, 4355.0, 4406.0);
assert.strictEqual(nullBase, null, 'Null base ranges should return null');

const zeroTarget = OptionsMath.computeConvertedRanges(baseRanges, 4355.0, 0);
assert.strictEqual(zeroTarget, null, 'Zero target price should return null');

// 6. Test Multi-Asset Copy Text Formatting
console.log('\n[6] Testing Multi-Asset Journal Export Format:');
const copyLines = [
  `[CME Vol2Vol™] Multi-Asset Expected Range (0 DTE Intraday)`,
  `Symbol: COMEX:GCV2026`,
  `0DTE Underlying: 4355.0 | Day Open: 4328.0 | ATM Vol: 23.66%`,
  `----------------------------------------`,
  `[1] 0DTE Underlying (GCV2026)`,
  `+3 SD: ${baseRanges['+3']}`,
  `+2 SD: ${baseRanges['+2']}`,
  `+1 SD: ${baseRanges['+1']}`,
  `Center: ${baseRanges['ATM']}`,
  `-1 SD: ${baseRanges['-1']}`,
  `-2 SD: ${baseRanges['-2']}`,
  `-3 SD: ${baseRanges['-3']}`,
  `----------------------------------------`,
  `[2] BLACKBULL:GOLD.F Futures (Basis: ${convGoldF.diffFormatted} | Ref: ${goldFPrice.toFixed(1)})`,
  `+3 SD: ${convGoldF.ranges['+3']}`,
  `+2 SD: ${convGoldF.ranges['+2']}`,
  `+1 SD: ${convGoldF.ranges['+1']}`,
  `Center: ${convGoldF.ranges['ATM']}`,
  `-1 SD: ${convGoldF.ranges['-1']}`,
  `-2 SD: ${convGoldF.ranges['-2']}`,
  `-3 SD: ${convGoldF.ranges['-3']}`,
  `----------------------------------------`,
  `[3] OANDA:XAUUSD Spot CFD (Basis: ${convXau.diffFormatted} | Ref: ${xauPrice.toFixed(1)})`,
  `+3 SD: ${convXau.ranges['+3']}`,
  `+2 SD: ${convXau.ranges['+2']}`,
  `+1 SD: ${convXau.ranges['+1']}`,
  `Center: ${convXau.ranges['ATM']}`,
  `-1 SD: ${convXau.ranges['-1']}`,
  `-2 SD: ${convXau.ranges['-2']}`,
  `-3 SD: ${convXau.ranges['-3']}`,
  `----------------------------------------`,
  `1SD Expected Move: ±$${stats.oneStdDevValue} (${stats.oneStdDevPct}%)`,
];

const journalText = copyLines.join('\n');
console.log(journalText);

assert(journalText.includes('[1] 0DTE Underlying (GCV2026)'), 'Must include 0DTE Underlying section');
assert(journalText.includes('[2] BLACKBULL:GOLD.F Futures (Basis: +61.1 | Ref: 4416.1)'), 'Must include BLACKBULL:GOLD.F section with +61.1 Basis');
assert(journalText.includes('[3] OANDA:XAUUSD Spot CFD (Basis: +14.2 | Ref: 4369.2)'), 'Must include XAUUSD section with +14.2 Basis');

console.log('\n================================================================');
console.log(' ALL GC1! & XAUUSD COMPARISON TESTS PASSED SUCCESSFULLY! ✓');
console.log('================================================================\n');

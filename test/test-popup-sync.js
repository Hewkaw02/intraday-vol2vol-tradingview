/**
 * test/test-popup-sync.js
 * Verification of Non-Full Dashboard (Popup & Minimized Mode) Live Sync Engine
 */

const assert = require('assert');
const DataParser = require('../src/core/data-parser.js');
const OptionsMath = require('../src/core/options-math.js');

console.log('================================================================');
console.log(' TEST: POPUP & COMPACT HUD LIVE SYNC & USABILITY VERIFICATION');
console.log('================================================================');

// 1. Verify Benchmark Demo Data matches active 0DTE contract
const demoData = DataParser.getLive0DteGoldDemoData();
console.log('\n[1] Default 0DTE Demo Data:');
console.log('  Symbol:', demoData.symbol);
console.log('  Future Stl:', demoData.underlyingPrice);
console.log('  Open Price:', demoData.openPrice);
console.log('  ATM IV:', demoData.atmVolatility);

assert.strictEqual(demoData.symbol, 'COMEX:GCV2026', 'Popup default symbol must be GCV2026');
assert.strictEqual(demoData.underlyingPrice, 4355.0, 'Popup default Future Stl must be 4355.0');
assert.strictEqual(demoData.openPrice, 4328.0, 'Popup default Open price must be 4328.0');

// 2. Calculate 0DTE stats (as would be sent to storage by OverlayPanel)
const stats0 = OptionsMath.calculateStats({
  underlyingPrice: demoData.underlyingPrice,
  spotPrice: demoData.underlyingPrice,
  openPrice: demoData.openPrice,
  volAnchorPrice: demoData.underlyingPrice,
  atmVolatility: demoData.atmVolatility,
  dte: 0,
  strikesData: demoData.strikesData,
});

console.log('\n[2] 0DTE Stats Calculation for Popup:');
console.log('  Dominance:', stats0.dominance, `(+${stats0.dominancePct}%)`);
console.log('  PCR:', stats0.pcr, '| CPR:', stats0.callPutRatio);
console.log('  Mean Call:', stats0.meanCall);
console.log('  Mean Put:', stats0.meanPut);
console.log('  1SD Move:', `±$${stats0.oneStdDevValue} (${stats0.oneStdDevPct}%)`);
console.log('  ATM Center Range:', stats0.stdDevRanges['ATM']);
console.log('  -1 SD:', stats0.stdDevRanges['-1'], '| +1 SD:', stats0.stdDevRanges['+1']);

assert.strictEqual(stats0.is0DTE, true, 'is0DTE must be true');
assert.strictEqual(stats0.dominance, 'CALLS', 'Volume dominance must be CALLS');
assert.strictEqual(stats0.stdDevRanges['ATM'], 4355.0, 'ATM center must be 4355.0');
assert.strictEqual(stats0.stdDevRanges['-1'], 4301.1, '-1SD must match math model 4301.1');
assert.strictEqual(stats0.stdDevRanges['+1'], 4408.9, '+1SD must match math model 4408.9');

// 3. Test Dynamic DTE Switching (0DTE -> 7DTE -> 30DTE)
console.log('\n[3] Testing Dynamic DTE Switching in Popup:');
const dteModes = [0, 1, 7, 14, 30];
dteModes.forEach((dte) => {
  const s = OptionsMath.calculateStats({
    underlyingPrice: demoData.underlyingPrice,
    openPrice: demoData.openPrice,
    atmVolatility: demoData.atmVolatility,
    dte: dte,
    strikesData: demoData.strikesData,
  });
  console.log(`  DTE ${dte}: 1SD Move = ±$${s.oneStdDevValue} (${s.oneStdDevPct}%) | 1SD Band: ${s.stdDevRanges['-1']} to ${s.stdDevRanges['+1']}`);
  assert.ok(s.stdDevRanges['-1'] < s.stdDevRanges['ATM'], '-1SD must be below ATM');
  assert.ok(s.stdDevRanges['+1'] > s.stdDevRanges['ATM'], '+1SD must be above ATM');
});

// 4. Test Dominance Share Visual Bar Calculation
const totalVol = stats0.totalCallVol + stats0.totalPutVol;
const callShare = Math.round((stats0.totalCallVol / totalVol) * 100);
const putShare = 100 - callShare;
console.log('\n[4] Dominance Progress Bar Shares:');
console.log(`  Calls: ${stats0.totalCallVol} (${callShare}%) | Puts: ${stats0.totalPutVol} (${putShare}%)`);
assert.strictEqual(callShare + putShare, 100, 'Sum of shares must be 100%');
assert.ok(callShare > putShare, 'Call share must dominate');

// 5. Test Anchor Toggle (Current Stl vs Open)
console.log('\n[5] Anchor Toggle Verification:');
console.log('  From Current Stl Center:', stats0.stdDevRanges['ATM']);
console.log('  From Day Open Center:   ', stats0.stdDevRangesFromOpen['Open']);
assert.strictEqual(stats0.stdDevRanges['ATM'], 4355.0, 'From Stl center must be 4355.0');
assert.strictEqual(stats0.stdDevRangesFromOpen['Open'], 4328.0, 'From Open center must be 4328.0');

// 6. Test Compact Minimized HUD Text Serialization
const compact1sdText = `${stats0.stdDevRanges['-1']} — ${stats0.stdDevRanges['+1']}`;
const compactPriceText = Number(stats0.underlyingPrice).toFixed(1);
const compactDomText = `${stats0.dominance} (+${stats0.dominancePct}%)`;
console.log('\n[6] Compact Minimized HUD Serialization:');
console.log('  Price:', compactPriceText);
console.log('  1SD Range:', compact1sdText);
console.log('  Dominance:', compactDomText);
assert.strictEqual(compactPriceText, '4355.0');
assert.strictEqual(compact1sdText, '4301.1 — 4408.9');

console.log('\n>>> ALL POPUP & COMPACT HUD SYNC TESTS PASSED (100%)! <<<');

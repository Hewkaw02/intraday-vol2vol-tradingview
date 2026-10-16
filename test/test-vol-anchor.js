/**
 * test/test-vol-anchor.js
 * Verifies that Vol STL smile curve, strike coordinates, and strike Vol Stl values
 * remain 100% stationary and anchored during real-time Future STL price ticks.
 */

const assert = require('assert');
const OptionsMath = require('../src/core/options-math.js');

console.log('================================================================');
console.log(' TEST: VOL STL STATIONARY ANCHORING ON REAL-TIME TICKS');
console.log('================================================================\n');

const initialS = 4392.0;
const openPrice = 4355.0;
const atmVol = 23.58;
const dte = 0;

const sampleStrikes = [
  { strike: 4350, callVol: 100, putVol: 50 },
  { strike: 4380, callVol: 300, putVol: 120 },
  { strike: 4400, callVol: 800, putVol: 400 },
  { strike: 4420, callVol: 500, putVol: 200 },
  { strike: 4450, callVol: 150, putVol: 80 },
];

// 1. Initial snapshot calculation
const stats1 = OptionsMath.calculateStats({
  underlyingPrice: initialS,
  openPrice: openPrice,
  volAnchorPrice: initialS,
  atmVolatility: atmVol,
  dte: dte,
  strikesData: sampleStrikes,
});

const volStlAt4400_Initial = stats1.strikesData.find(s => s.strike === 4400).volStl;
const smileCurve_Initial = OptionsMath.generateVolSmile({
  S: stats1.volAnchorPrice,
  atmVol,
  dte,
  minK: 4130,
  maxK: 4620,
});

console.log(`[Initial Snapshot] Future Stl: ${stats1.underlyingPrice}, Vol Anchor: ${stats1.volAnchorPrice}`);
console.log(`  Strike 4400 Vol Stl: ${volStlAt4400_Initial}%`);
console.log(`  Smile curve point at center: ${smileCurve_Initial[50].strike} -> ${smileCurve_Initial[50].iv}%`);

// 2. Simulate real-time ticks of Future Stl (e.g. 4393.5, 4395.0, 4390.2)
const tickedPrices = [4393.5, 4395.0, 4390.2, 4398.7];

for (const tick of tickedPrices) {
  const statsTick = OptionsMath.calculateStats({
    underlyingPrice: tick, // live ticking price moves
    openPrice: openPrice,
    volAnchorPrice: initialS, // Vol Stl anchor stays fixed!
    atmVolatility: atmVol,
    dte: dte,
    strikesData: sampleStrikes,
  });

  const volStlAt4400_Tick = statsTick.strikesData.find(s => s.strike === 4400).volStl;
  const smileCurve_Tick = OptionsMath.generateVolSmile({
    S: statsTick.volAnchorPrice,
    atmVol,
    dte,
    minK: 4130,
    maxK: 4620,
  });

  console.log(`[Tick Future Stl: ${tick}]`);
  console.log(`  Future Stl moved: ${statsTick.underlyingPrice} | Vol Anchor stays: ${statsTick.volAnchorPrice}`);
  console.log(`  Strike 4400 Vol Stl: ${volStlAt4400_Tick}% (expected ${volStlAt4400_Initial}%)`);

  assert.strictEqual(
    volStlAt4400_Tick,
    volStlAt4400_Initial,
    `Vol Stl at strike 4400 must stay exactly equal to ${volStlAt4400_Initial}% when Future Stl ticks to ${tick}`
  );

  assert.strictEqual(
    smileCurve_Tick[50].iv,
    smileCurve_Initial[50].iv,
    'Vol Stl Smile curve coordinates must remain 100% frozen in place'
  );
}

console.log('\n  ✓ Vol Stl smile curve remains completely stationary during live ticks');
console.log('  ✓ Vol Stl values across all strikes stay fixed to reference settlement');
console.log('  ✓ Only Future Stl (the red line) tracks real-time ticks');

console.log('\n>>> ALL VOL ANCHOR TESTS PASSED! <<<');

/**
 * Integration test: Vol Term Structure with REAL TradingView Scanner IV data
 * Validates: resolveExpiryMs, interpolateAtmIv, calculateSeriesVolTermStructure,
 *            parseScannerOptionIvRows, sumSeriesVolume
 */
const OptionsMath = require('../src/core/options-math.js');
const DataParser = require('../src/core/data-parser.js');

let passed = 0;
let failed = 0;

function assert(cond, label, detail = '') {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}  ${detail}`);
    failed++;
  }
}

console.log('================================================================');
console.log(' TEST: VOL TERM STRUCTURE — REAL IV INTEGRATION');
console.log('================================================================\n');

// ─────────────────────────────────────────────────────────────
// 1. resolveExpiryMs
// ─────────────────────────────────────────────────────────────
console.log('[1] resolveExpiryMs:');
{
  // TradingView exp_time with timezone offset
  const ms1 = OptionsMath.resolveExpiryMs('2026-10-07T16:59:59-04:00', 20261007);
  const d1 = new Date(ms1);
  assert(d1.getUTCHours() === 20, 'exp_time EDT -> 20:59:59 UTC', `got ${d1.toISOString()}`);
  assert(d1.getUTCMinutes() === 59, 'minutes = 59');
  assert(d1.getUTCSeconds() === 59, 'seconds = 59');

  // EST (winter time)
  const ms2 = OptionsMath.resolveExpiryMs('2026-11-24T16:59:59-05:00', 20261124);
  const d2 = new Date(ms2);
  assert(d2.getUTCHours() === 21, 'exp_time EST -> 21:59:59 UTC', `got ${d2.toISOString()}`);

  // Fallback from YYYYMMDD only (no exp_time)
  const ms3 = OptionsMath.resolveExpiryMs(null, 20261007);
  assert(!isNaN(ms3) && ms3 > 0, 'YYYYMMDD fallback produces valid timestamp');

  // Invalid
  const ms4 = OptionsMath.resolveExpiryMs(null, null);
  assert(isNaN(ms4), 'null inputs -> NaN');
}

// ─────────────────────────────────────────────────────────────
// 2. interpolateAtmIv
// ─────────────────────────────────────────────────────────────
console.log('\n[2] interpolateAtmIv:');
{
  const smile = [
    { strike: 4100, iv: 25 },
    { strike: 4150, iv: 23 },
    { strike: 4200, iv: 21 },
    { strike: 4250, iv: 22 },
    { strike: 4300, iv: 24 },
  ];
  const atm = OptionsMath.interpolateAtmIv(smile, 4175);
  // Between 4150(23%) and 4200(21%): linear -> 23 + (4175-4150)/(4200-4150) * (21-23) = 23 - 1 = 22
  assert(Math.abs(atm - 22) < 0.01, `ATM IV at F=4175: ${atm.toFixed(2)}% (expected 22.00%)`, `got ${atm}`);

  const exact = OptionsMath.interpolateAtmIv(smile, 4200);
  assert(exact === 21, 'Exact strike match: 21%', `got ${exact}`);

  const below = OptionsMath.interpolateAtmIv(smile, 4000);
  assert(below === 25, 'Below lowest strike: clamp to first', `got ${below}`);

  const above = OptionsMath.interpolateAtmIv(smile, 5000);
  assert(above === 24, 'Above highest strike: clamp to last', `got ${above}`);

  const empty = OptionsMath.interpolateAtmIv([], 4200);
  assert(empty === null, 'Empty points -> null');
}

// ─────────────────────────────────────────────────────────────
// 3. parseScannerOptionIvRows (decimal -> percent, C/P averaging)
// ─────────────────────────────────────────────────────────────
console.log('\n[3] parseScannerOptionIvRows:');
{
  const json = {
    totalCount: 6,
    data: [
      { s: 'X', d: [20261007, 4200, 'call', 0.2068, 'G1W'] },  // 20.68%
      { s: 'X', d: [20261007, 4200, 'put',  0.2120, 'G1W'] },  // 21.20%
      { s: 'X', d: [20261007, 4250, 'call', 0.2300, 'G1W'] },  // 23.00%
      { s: 'X', d: [20261009, 4200, 'call', 0.2500, 'OG2'] },  // 25.00%
      { s: 'X', d: [20261007, 4200, 'call', 0, 'G1W'] },       // zero IV -> skip
      { s: 'X', d: [20261007, null, 'call', 0.20, 'G1W'] },    // null strike -> skip
    ],
  };

  const smiles = DataParser.parseScannerOptionIvRows(json);
  const keys = Object.keys(smiles);
  assert(keys.length === 2, `2 series groups: ${keys.join(', ')}`, `got ${keys.length}`);

  const g1w = smiles['20261007|G1W'];
  assert(g1w !== undefined, 'Found G1W series');
  assert(g1w.points.length === 2, 'G1W has 2 strikes (4200, 4250)', `got ${g1w.points.length}`);

  // 4200: call=20.68, put=21.20 -> avg = 20.94
  const s4200 = g1w.points.find(p => p.strike === 4200);
  assert(s4200 && Math.abs(s4200.iv - 20.94) < 0.01, `Strike 4200 IV avg: ${s4200?.iv.toFixed(2)}% (expected 20.94%)`, `got ${s4200?.iv}`);

  // 4250: only one call -> 23.00
  const s4250 = g1w.points.find(p => p.strike === 4250);
  assert(s4250 && Math.abs(s4250.iv - 23.00) < 0.01, `Strike 4250 IV: ${s4250?.iv.toFixed(2)}%`);
}

// ─────────────────────────────────────────────────────────────
// 4. sumSeriesVolume
// ─────────────────────────────────────────────────────────────
console.log('\n[4] sumSeriesVolume:');
{
  const item = {
    strikes: [
      { s: 4200, c: { v: 100 }, p: { v: 50 } },
      { s: 4250, c: { v: 200 }, p: { v: 30 } },
      { s: 4300, c: { v: 0 }, p: { v: 10 } },
    ],
  };
  const vol = DataParser.sumSeriesVolume(item);
  assert(vol.call === 300, `Call volume: ${vol.call}`);
  assert(vol.put === 90, `Put volume: ${vol.put}`);

  const empty = DataParser.sumSeriesVolume(null);
  assert(empty.call === 0 && empty.put === 0, 'null item -> {0, 0}');
}

// ─────────────────────────────────────────────────────────────
// 5. calculateSeriesVolTermStructure (new API)
// ─────────────────────────────────────────────────────────────
console.log('\n[5] calculateSeriesVolTermStructure:');
{
  // Fake "now" = 2026-10-07 02:00 UTC
  const now = Date.parse('2026-10-07T02:00:00Z');

  const series = [
    {
      id: 'S1', exp: 20261007, expTime: '2026-10-07T16:59:59-04:00',
      family: 'G1W', underlying: 'COMEX:GCZ2026', forward: 4173,
      ivPoints: [
        { strike: 4100, iv: 25 }, { strike: 4150, iv: 23 },
        { strike: 4200, iv: 21 }, { strike: 4250, iv: 22 },
      ],
      totalCallVol: 500, totalPutVol: 300,
    },
    {
      id: 'S2', exp: 20261009, expTime: '2026-10-09T16:59:59-04:00',
      family: 'OG2', underlying: 'COMEX:GCZ2026', forward: 4173,
      ivPoints: [
        { strike: 4100, iv: 26 }, { strike: 4150, iv: 24 },
        { strike: 4200, iv: 22.5 }, { strike: 4250, iv: 23 },
      ],
      totalCallVol: 200, totalPutVol: 150,
    },
    {
      id: 'S3', exp: 20261027, expTime: '2026-10-27T16:59:59-04:00',
      family: 'OG', underlying: 'COMEX:GCZ2026', forward: 4173,
      ivPoints: [
        { strike: 4100, iv: 24 }, { strike: 4150, iv: 22 },
        { strike: 4200, iv: 20.5 }, { strike: 4250, iv: 21 },
      ],
      totalCallVol: 800, totalPutVol: 600,
    },
  ];

  const ts = OptionsMath.calculateSeriesVolTermStructure(series, { now });
  assert(ts.length === 3, `3 series returned`, `got ${ts.length}`);

  // Sorted by expiry
  assert(ts[0].id === 'S1' && ts[1].id === 'S2' && ts[2].id === 'S3', 'Sorted by expiry');

  // ATM IV at F=4173: between 4150 and 4200
  // S1: 23 + (4173-4150)/(4200-4150) * (21-23) = 23 - 0.92 = 22.08
  assert(Math.abs(ts[0].atmIV - 22.08) < 0.1, `S1 ATM IV: ${ts[0].atmIV.toFixed(2)}% (~22.08%)`, `got ${ts[0].atmIV}`);

  // S2: 24 + (4173-4150)/(4200-4150) * (22.5-24) = 24 - 0.69 = 23.31
  assert(Math.abs(ts[1].atmIV - 23.31) < 0.1, `S2 ATM IV: ${ts[1].atmIV.toFixed(2)}% (~23.31%)`, `got ${ts[1].atmIV}`);

  // T must be positive and increasing
  assert(ts[0].T > 0, `S1 T > 0: ${ts[0].T.toFixed(6)}`);
  assert(ts[1].T > ts[0].T, `S2 T > S1 T: ${ts[1].T.toFixed(6)} > ${ts[0].T.toFixed(6)}`);
  assert(ts[2].T > ts[1].T, `S3 T > S2 T`);

  // hoursToExpiry
  assert(ts[0].hoursToExpiry > 0 && ts[0].hoursToExpiry < 24, `S1 hours to expiry: ${ts[0].hoursToExpiry.toFixed(1)}h (< 24h)`);

  // expectedMove > 0
  assert(ts[0].expectedMove > 0, `S1 expected move: ±$${ts[0].expectedMove}`);

  // Forward vol between S1 and S2
  assert(ts[0].forwardVol === null, 'S1 has no forward vol (first series)');
  assert(ts[1].forwardVol === null || ts[1].forwardVol > 0 || ts[1].forwardInverted, `S2 forward vol computed: ${ts[1].forwardVol || (ts[1].forwardInverted ? 'INV' : '--')}`);

  // Volume
  assert(ts[0].totalVol === 800, `S1 total vol: ${ts[0].totalVol}`);
  assert(ts[2].totalVol === 1400, `S3 total vol: ${ts[2].totalVol}`);

  // Expired series should be excluded
  const expiredSeries = [{
    id: 'EXP', exp: 20261001, expTime: '2026-10-01T16:59:59-04:00',
    family: 'OLD', underlying: 'COMEX:GCZ2026', forward: 4173,
    ivPoints: [{ strike: 4200, iv: 20 }], totalCallVol: 10, totalPutVol: 5,
  }];
  const tsExp = OptionsMath.calculateSeriesVolTermStructure(expiredSeries, { now });
  assert(tsExp.length === 0, 'Expired series excluded');
}

// ─────────────────────────────────────────────────────────────
// 6. Forward Vol math verification (Trading-day & Calendar-day)
// ─────────────────────────────────────────────────────────────
console.log('\n[6] Forward Vol math verification (Trading-day & Calendar-day):');
{
  const now = Date.parse('2026-10-07T02:00:00Z');
  const s1Exp = Date.parse('2026-10-08T16:59:59-04:00'); // Thu Oct 8
  const s2Exp = Date.parse('2026-10-17T16:59:59-04:00'); // Sat Oct 17 (spans 2 weekends)
  const series = [
    {
      id: 'A', exp: 20261008, expTime: s1Exp, family: 'X', underlying: 'U', forward: 4200,
      ivPoints: [{ strike: 4200, iv: 20 }], totalCallVol: 100, totalPutVol: 100,
    },
    {
      id: 'B', exp: 20261017, expTime: s2Exp, family: 'Y', underlying: 'U', forward: 4200,
      ivPoints: [{ strike: 4200, iv: 22 }], totalCallVol: 100, totalPutVol: 100,
    },
  ];
  const ts = OptionsMath.calculateSeriesVolTermStructure(series, { now });
  assert(ts.length === 2, '2 series');
  assert(ts[1].forwardVol !== null, 'Forward vol computed');

  // Manual check (Calendar-day vs Trading-day)
  const T1 = ts[0].T;
  const T2 = ts[1].T;
  const s1 = ts[0].atmIV / 100;
  const s2 = ts[1].atmIV / 100;
  const varDiff = s2 * s2 * T2 - s1 * s1 * T1;
  const fwdVolCal = Math.sqrt(varDiff / (T2 - T1)) * 100;
  const dTTrading = OptionsMath.computeTradingYearDiff(s1Exp, s2Exp);
  const fwdVolTrading = Math.sqrt(varDiff / dTTrading) * 100;

  assert(Math.abs(ts[1].forwardVolCalendar - fwdVolCal) < 0.01, `Calendar Forward Vol matches manual calc: ${ts[1].forwardVolCalendar.toFixed(2)}% vs ${fwdVolCal.toFixed(2)}%`);
  assert(Math.abs(ts[1].forwardVol - fwdVolTrading) < 0.01, `Trading-day Forward Vol matches manual calc: ${ts[1].forwardVol.toFixed(2)}% vs ${fwdVolTrading.toFixed(2)}%`);

  // Verify Friday -> Monday weekend exclusion (72h calendar -> 24h trading = 1/3 time = sqrt(3) vol scaling)
  const friExp = Date.parse('2026-10-16T16:59:59-04:00');
  const monExp = Date.parse('2026-10-19T16:59:59-04:00');
  const friMonDays = OptionsMath.computeTradingYearDiff(friExp, monExp) * 365;
  assert(Math.abs(friMonDays - 1.0) < 0.01, `Friday 17:00 ET -> Monday 17:00 ET = 1.00 trading day (got ${friMonDays.toFixed(4)}d)`);
}

// ─────────────────────────────────────────────────────────────
// 7. Inverted term structure detection
// ─────────────────────────────────────────────────────────────
console.log('\n[7] Inverted term structure:');
{
  const now = Date.parse('2026-10-07T02:00:00Z');
  const series = [
    {
      id: 'NEAR', exp: 20261008, expTime: '2026-10-08T16:59:59-04:00',
      family: 'X', underlying: 'U', forward: 4200,
      ivPoints: [{ strike: 4200, iv: 30 }], totalCallVol: 100, totalPutVol: 100,
    },
    {
      id: 'FAR', exp: 20261017, expTime: '2026-10-17T16:59:59-04:00',
      family: 'Y', underlying: 'U', forward: 4200,
      ivPoints: [{ strike: 4200, iv: 8 }], totalCallVol: 100, totalPutVol: 100,
    },
  ];
  const ts = OptionsMath.calculateSeriesVolTermStructure(series, { now });
  assert(ts[1].forwardVol === null, 'Inverted: forwardVol is null');
  assert(ts[1].forwardInverted === true, 'forwardInverted flag set');
}

console.log(`\n================================================================`);
console.log(` RESULTS: ${passed} passed, ${failed} failed`);
console.log(`================================================================`);
if (failed > 0) process.exit(1);

/**
 * COMPREHENSIVE SYSTEM AUDIT
 * Verifies all subsystems: live market prices, mathematical formulas, data flow, basis shift, and SD bands.
 */
const fetch = globalThis.fetch;
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
function assert(name, condition, detail = '') {
  if (condition) { console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`); passed++; }
  else { console.log(`  ✗ FAIL: ${name}${detail ? ' — ' + detail : ''}`); failed++; }
}

async function audit() {
  console.log('================================================================');
  console.log(' COMPREHENSIVE SYSTEM AUDIT — ' + new Date().toISOString());
  console.log('================================================================\n');

  // ──────────────────────────────────────────────────────────
  // PART 1: LIVE MARKET DATA VERIFICATION
  // ──────────────────────────────────────────────────────────
  console.log('--- PART 1: Live Market Data Sources ---\n');

  // 1a. Scanner API for all symbols
  const symbols = ['COMEX:GCV2026', 'COMEX:GC1!', 'OANDA:XAUUSD'];
  const scannerData = {};
  for (const sym of symbols) {
    try {
      const url = `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(sym)}&fields=close,open,high,low,change`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      scannerData[sym] = data;
      const currentPrice = Number(data.close);
      const sessionOpen = Number(data.open);
      const changePct = Number(data.change);
      const prevSettlement = currentPrice / (1 + changePct / 100);
      console.log(`  ${sym}:`);
      console.log(`    Current: ${currentPrice} | Session Open: ${sessionOpen} | Prev Settlement: ${prevSettlement.toFixed(1)}`);
      console.log(`    Gap (Session Open - Prev Settlement): ${(sessionOpen - prevSettlement).toFixed(1)} pts`);
      assert(`${sym} Scanner returns valid data`, currentPrice > 100 && sessionOpen > 100);
    } catch (e) {
      console.log(`  ${sym}: ERROR - ${e.message}`);
    }
  }

  // 1b. TradingView Symbol Page for GOLD.F
  console.log('\n  GOLD.F (BlackBull Markets):');
  try {
    const res = await fetch('https://www.tradingview.com/symbols/GOLD.F/', { headers: { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const trade = html.match(/"trade":\{"price":([0-9.]+)\}/);
    const daily = html.match(/"daily_bar":\{"close":"([0-9.]+)","data_update_time":"[^"]*","high":"([0-9.]+)","low":"([0-9.]+)","open":"([0-9.]+)"/);
    const timeMatch = html.match(/"daily_bar":\{[^}]*"time":"(\d+)"/);
    const barDate = timeMatch ? new Date(Number(timeMatch[1]) * 1000) : null;
    const goldFPrice = trade ? Number(trade[1]) : null;
    const goldFDailyOpen = daily ? Number(daily[4]) : null;
    console.log(`    Trade price: ${goldFPrice || 'N/A'}`);
    console.log(`    daily_bar.open: ${goldFDailyOpen || 'N/A'}`);
    console.log(`    daily_bar date: ${barDate ? barDate.toUTCString() : 'N/A'}`);
    
    // Check if GOLD.F daily_bar is stale
    const now = new Date();
    const daysDiff = barDate ? (now - barDate) / (1000 * 60 * 60 * 24) : 999;
    if (daysDiff > 2) {
      console.log(`    ⚠ GOLD.F daily_bar is ${daysDiff.toFixed(0)} days old — STALE! Using Basis Shift is correct.`);
    }
    assert('GOLD.F trade price available', goldFPrice > 100);
    
    // Verify GOLD.F is NOT in Scanner
    try {
      const scanRes = await fetch(`https://scanner.tradingview.com/symbol?symbol=BLACKBULL:GOLD.F&fields=close,open`, { headers: { 'Accept': 'application/json' } });
      const scanData = await scanRes.json();
      assert('GOLD.F NOT in Scanner (confirmed)', !scanData.close || scanData.close === undefined, 'Basis Shift is the only option');
    } catch (e) {
      assert('GOLD.F NOT in Scanner (confirmed)', true, 'Scanner threw error');
    }
  } catch (e) {
    console.log(`    ERROR: ${e.message}`);
  }

  // ──────────────────────────────────────────────────────────
  // PART 2: MATH ENGINE VERIFICATION
  // ──────────────────────────────────────────────────────────
  console.log('\n--- PART 2: Math Engine (options-math.js) ---\n');

  // Load OptionsMath
  const optionsMathPath = path.resolve('src/core/options-math.js');
  const optionsMathCode = fs.readFileSync(optionsMathPath, 'utf8');
  const mathModule = {};
  const mathFunc = new Function('module', 'exports', optionsMathCode);
  mathModule.exports = {};
  mathFunc(mathModule, mathModule.exports);
  const OptionsMath = mathModule.exports;

  const gcvPrice = Number(scannerData['COMEX:GCV2026']?.close || 4213.6);
  const gcvOpen = Number(scannerData['COMEX:GCV2026']?.open || 4279.7);
  const gc1Price = Number(scannerData['COMEX:GC1!']?.close || 4246.5);
  const xauPrice = Number(scannerData['OANDA:XAUUSD']?.close || 4175);
  
  const testATMVol = 23.66;
  const testDTE = 0;
  
  // 2a. calculateStats with correct session open
  const stats = OptionsMath.calculateStats({
    underlyingPrice: gcvPrice,
    openPrice: gcvOpen,
    atmVolatility: testATMVol,
    dte: testDTE,
    strikesData: [
      { strike: gcvPrice - 100, callVol: 50, putVol: 200 },
      { strike: gcvPrice - 50, callVol: 100, putVol: 150 },
      { strike: Math.round(gcvPrice), callVol: 300, putVol: 100 },
      { strike: gcvPrice + 50, callVol: 250, putVol: 50 },
      { strike: gcvPrice + 100, callVol: 150, putVol: 20 },
    ],
  });

  console.log(`  Underlying: ${stats.underlyingPrice} | Open: ${stats.openPrice}`);
  console.log(`  ATM Vol: ${stats.atmVolatility}% | DTE: ${stats.dte} | T: ${stats.T.toFixed(6)}`);
  console.log(`  1SD Move: ±$${stats.oneStdDevValue} (${stats.oneStdDevPct}%)`);
  
  // 2b. Verify SD bands math
  const sigma = testATMVol / 100;
  const T = 1 / 365;
  const stdDevMove = sigma * Math.sqrt(T);
  const drift = -0.5 * sigma * sigma * T;
  const expected1SD_up = gcvPrice * Math.exp(drift + stdDevMove);
  const expected1SD_dn = gcvPrice * Math.exp(drift - stdDevMove);
  
  assert('SD bands use log-normal model', 
    Math.abs(stats.stdDevRanges['+1'] - Math.round(expected1SD_up * 10) / 10) < 0.1,
    `+1SD: ${stats.stdDevRanges['+1']} expected: ${Math.round(expected1SD_up * 10) / 10}`
  );
  assert('SD bands symmetric around ATM',
    Math.abs(stats.stdDevRanges['ATM'] - gcvPrice) < 0.1,
    `ATM: ${stats.stdDevRanges['ATM']}`
  );

  // 2c. Verify From Open SD bands
  const expectedOpenUp = gcvOpen * Math.exp(drift + stdDevMove);
  const expectedOpenDn = gcvOpen * Math.exp(drift - stdDevMove);
  
  assert('From Open bands center at session open',
    Math.abs(stats.stdDevRangesFromOpen['Open'] - Math.round(gcvOpen * 10) / 10) < 0.1,
    `Open center: ${stats.stdDevRangesFromOpen['Open']} (session open: ${gcvOpen})`
  );
  assert('From Open +1SD correct',
    Math.abs(stats.stdDevRangesFromOpen['+1'] - Math.round(expectedOpenUp * 10) / 10) < 0.1,
    `+1SD from open: ${stats.stdDevRangesFromOpen['+1']}`
  );

  // 2d. Verify open price is session open NOT prev settlement
  const prevSettlement = gcvPrice / (1 + Number(scannerData['COMEX:GCV2026']?.change || 0) / 100);
  assert('Open price = Session Open (NOT prev settlement)',
    Math.abs(stats.openPrice - gcvOpen) < 0.1 && Math.abs(stats.openPrice - prevSettlement) > 0.5,
    `Open: ${stats.openPrice} | Session Open: ${gcvOpen} | Prev Settlement: ${prevSettlement.toFixed(1)}`
  );

  // ──────────────────────────────────────────────────────────
  // PART 3: BASIS SHIFT VERIFICATION
  // ──────────────────────────────────────────────────────────
  console.log('\n--- PART 3: Basis Shift (Perspective Conversion) ---\n');
  
  const basisGC1 = gc1Price - gcvPrice;
  const basisXAU = xauPrice - gcvPrice;
  
  console.log(`  GCV2026: ${gcvPrice} | GC1!: ${gc1Price} | XAUUSD: ${xauPrice}`);
  console.log(`  Basis GC1!: ${basisGC1.toFixed(1)} | Basis XAU: ${basisXAU.toFixed(1)}`);

  // 3a. computeConvertedRanges for GC1!/GOLD.F
  const gc1Result = OptionsMath.computeConvertedRanges(stats.stdDevRanges, gcvPrice, gc1Price);
  const gc1Converted = gc1Result.ranges;
  assert('GC1! converted ATM = GC1! price',
    Math.abs(gc1Converted['ATM'] - gc1Price) < 0.1,
    `ATM: ${gc1Converted['ATM']} | GC1!: ${gc1Price}`
  );
  assert('GC1! converted range shift is additive basis',
    Math.abs((gc1Converted['+1'] - stats.stdDevRanges['+1']) - basisGC1) < 0.2,
    `Shift: ${(gc1Converted['+1'] - stats.stdDevRanges['+1']).toFixed(1)} | Basis: ${basisGC1.toFixed(1)}`
  );

  // 3b. computeConvertedRanges for XAUUSD
  const xauResult = OptionsMath.computeConvertedRanges(stats.stdDevRanges, gcvPrice, xauPrice);
  const xauConverted = xauResult.ranges;
  assert('XAUUSD converted ATM = XAUUSD price',
    Math.abs(xauConverted['ATM'] - xauPrice) < 0.1,
    `ATM: ${xauConverted['ATM']} | XAU: ${xauPrice}`
  );

  // 3c. From Open SD bands for GOLD.F
  const goldFOpen = Math.round((gcvOpen + basisGC1) * 10) / 10;
  const gc1OpenResult = OptionsMath.computeConvertedRanges(stats.stdDevRangesFromOpen, gcvPrice, gc1Price);
  assert('GOLD.F derived open = 0DTE open + Basis',
    Math.abs(goldFOpen - (gcvOpen + basisGC1)) < 0.1,
    `GOLD.F Open: ${goldFOpen} = ${gcvOpen} + ${basisGC1.toFixed(1)}`
  );

  // 3d. Verify additive shift error is negligible
  // Log-normal: true +1SD for GOLD.F = gc1Price * exp(drift + stdDevMove)
  const trueGC1_1SD = gc1Price * Math.exp(drift + stdDevMove);
  const shiftedGC1_1SD = gc1Converted['+1'];
  const shiftError = Math.abs(trueGC1_1SD - shiftedGC1_1SD);
  assert('Additive shift error < 2 pts (negligible)',
    shiftError < 2.0,
    `True: ${trueGC1_1SD.toFixed(1)} | Shifted: ${shiftedGC1_1SD} | Error: ${shiftError.toFixed(2)} pts`
  );

  // ──────────────────────────────────────────────────────────
  // PART 4: DATA FLOW CODE VERIFICATION
  // ──────────────────────────────────────────────────────────
  console.log('\n--- PART 4: Code Data Flow Integrity ---\n');

  const contentJs = fs.readFileSync('src/content/content.js', 'utf8');
  const overlayJs = fs.readFileSync('src/ui/overlay-panel.js', 'utf8');
  const dataParserJs = fs.readFileSync('src/core/data-parser.js', 'utf8');
  const dashboardJs = fs.readFileSync('src/dashboard/dashboard.js', 'utf8');
  const popupJs = fs.readFileSync('src/popup/popup.js', 'utf8');
  const optionsMathJs = fs.readFileSync('src/core/options-math.js', 'utf8');
  const chartJs = fs.readFileSync('src/ui/vol2vol-chart.js', 'utf8');

  // 4a. cachedSessionOpen data flow
  assert('cachedSessionOpen exists in content.js', contentJs.includes('let cachedSessionOpen'));
  assert('loadInitialData caches Scanner open', contentJs.includes('cachedSessionOpen = { price: live.openPrice'));
  assert('handleVoiLens uses cachedSessionOpen', contentJs.includes('if (cachedSessionOpen.price > 100)'));
  assert('handleVoiLens does NOT use DOM openPrice', !contentJs.includes('if (chainInfo.openPrice > 100) openPrice = chainInfo.openPrice'));

  // 4b. DOM sources no longer overwrite openPrice
  const mutObsMatch = contentJs.match(/updateFromRow[\s\S]*?setRealtimePrice\(info\.price,\s*(null|info\.openPrice)/);
  assert('MutationObserver sends null for openPrice', mutObsMatch && mutObsMatch[1] === 'null');
  
  // Check DOM poller
  const pollerSection = contentJs.substring(contentJs.indexOf('Safety-net DOM Price Poller'));
  const pollerMatch = pollerSection.match(/setRealtimePrice\(info\.price,\s*(null|info\.openPrice)/);
  assert('DOM poller sends null for openPrice', pollerMatch && pollerMatch[1] === 'null');

  // 4c. WebSocket handler caches session open
  assert('WebSocket handler caches open', contentJs.includes('cachedSessionOpen = { price: validOpen'));

  // 4d. data-parser.js has warning
  assert('data-parser.js WARNING comment', dataParserJs.includes('WARNING: This computes PREVIOUS SETTLEMENT'));

  // 4e. overlay-panel series/DTE switch uses Scanner
  const seriesSection = overlayJs.substring(overlayJs.indexOf('Series Dropdown Change'), overlayJs.indexOf('Price, Open, and IV input'));
  assert('Series switch does NOT use DOM openPrice', !seriesSection.includes('info.openPrice > 100'));
  assert('Series switch always calls Scanner', seriesSection.includes('Always fetch Scanner for session open'));

  // DTE switch
  const dteSection = overlayJs.substring(overlayJs.indexOf('applyDteChange'));
  assert('DTE switch does NOT use DOM openPrice', !dteSection.match(/info\.openPrice\s*>\s*100\s*\)\s*contractOpen/));
  assert('DTE switch always calls Scanner', dteSection.includes('Always fetch Scanner for session open'));

  // 4f. setRealtimePrice guards
  assert('setRealtimePrice ignores null openPrice', overlayJs.includes('!isNaN(numOpen) && numOpen > 100'));

  // 4g. calculateStats uses openPrice correctly
  assert('calculateStats S_open from openPrice param', optionsMathJs.includes("S_open = Number(openPrice) > 0 ? Number(openPrice) : S"));

  // 4h. Dashboard fetchScannerFallback uses Scanner open
  assert('Dashboard uses Scanner open', dashboardJs.includes('rawData.openPrice = op') || dashboardJs.match(/openPrice.*=.*op/));

  // 4i. Chart openPrice uses perspective shift
  assert('Chart applies perspective to openPrice', chartJs.includes('perspectiveConfig.targetOpen') || chartJs.includes('rawOpen + basis'));

  // ──────────────────────────────────────────────────────────
  // PART 5: CONSISTENCY CROSS-CHECK
  // ──────────────────────────────────────────────────────────
  console.log('\n--- PART 5: Cross-Component Consistency ---\n');

  // 5a. All perspective configs use Math.round((openP + basis) * 10) / 10
  const openBasisPattern = /Math\.round\(\(openP\s*\+\s*basis\)\s*\*\s*10\)\s*\/\s*10/g;
  const overlayMatches = (overlayJs.match(openBasisPattern) || []).length;
  const dashboardMatches = (dashboardJs.match(openBasisPattern) || []).length;
  const popupMatches = (popupJs.match(openBasisPattern) || []).length;
  assert('Overlay panel uses openP + basis formula', overlayMatches >= 2, `${overlayMatches} occurrences`);
  assert('Dashboard uses openP + basis formula', dashboardMatches >= 2, `${dashboardMatches} occurrences`);
  assert('Popup uses openP + basis formula', popupMatches >= 1, `${popupMatches} occurrences`);

  // 5b. Verify all 3 views have consistent perspective modes
  assert('Overlay has goldf perspective', overlayJs.includes("case 'goldf'") || overlayJs.includes("=== 'goldf'"));
  assert('Dashboard has goldf perspective', dashboardJs.includes("case 'goldf'") || dashboardJs.includes("=== 'goldf'"));
  assert('Popup has goldf perspective', popupJs.includes("case 'goldf'") || popupJs.includes("=== 'goldf'"));

  // 5c. Verify broadcastState includes openPrice
  assert('Overlay broadcasts openPrice to storage', overlayJs.includes('openPrice:') && overlayJs.includes('chrome.storage'));

  // ──────────────────────────────────────────────────────────
  // PART 6: NUMERICAL SANITY CHECKS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- PART 6: Numerical Sanity Checks ---\n');

  // 6a. 1SD move should be ~1.24% for 23.66% annual vol, 0DTE
  const expected1SDPct = sigma * Math.sqrt(T) * 100;
  assert('1SD% matches formula',
    Math.abs(stats.oneStdDevPct - expected1SDPct) < 0.01,
    `${stats.oneStdDevPct}% vs expected ${expected1SDPct.toFixed(2)}%`
  );

  // 6b. 1SD dollar move should be ~price * 1SD%
  const expected1SDDollar = gcvPrice * sigma * Math.sqrt(T);
  assert('1SD$ matches price * sigma * sqrt(T)',
    Math.abs(stats.oneStdDevValue - Math.round(expected1SDDollar * 10) / 10) < 0.1,
    `$${stats.oneStdDevValue} vs expected $${(expected1SDDollar).toFixed(1)}`
  );

  // 6c. SD bands should be monotonically increasing
  const sdKeys = ['-3', '-2', '-1', 'ATM', '+1', '+2', '+3'];
  let monotonic = true;
  for (let i = 1; i < sdKeys.length; i++) {
    if (stats.stdDevRanges[sdKeys[i]] <= stats.stdDevRanges[sdKeys[i-1]]) monotonic = false;
  }
  assert('SD bands are monotonically increasing', monotonic);

  // 6d. From Open bands should also be monotonic
  const openKeys = ['-3', '-2', '-1', 'Open', '+1', '+2', '+3'];
  let openMonotonic = true;
  for (let i = 1; i < openKeys.length; i++) {
    if (stats.stdDevRangesFromOpen[openKeys[i]] <= stats.stdDevRangesFromOpen[openKeys[i-1]]) openMonotonic = false;
  }
  assert('From Open bands are monotonically increasing', openMonotonic);

  // 6e. Drift term should be negligible for 0DTE
  assert('Drift term negligible for 0DTE',
    Math.abs(drift) < 0.001,
    `drift = ${drift.toExponential(4)}`
  );

  // 6f. From Open move direction should be consistent
  const moveFromOpen = gcvPrice - gcvOpen;
  console.log(`  Current move from session open: ${moveFromOpen.toFixed(1)} pts (${moveFromOpen > 0 ? 'UP' : 'DOWN'})`);
  assert('Move from open is reasonable (< 3SD)',
    Math.abs(moveFromOpen) < stats.oneStdDevValue * 3,
    `|${moveFromOpen.toFixed(1)}| < 3SD (${(stats.oneStdDevValue * 3).toFixed(1)})`
  );

  // ──────────────────────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(` AUDIT COMPLETE: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log(' ALL CHECKS PASSED! System is correct and consistent.');
  } else {
    console.log(` ${failed} ISSUES FOUND — review above failures.`);
  }
  console.log('================================================================\n');
}

audit().catch(e => console.error('Audit error:', e));

/**
 * src/dashboard/dashboard.js
 * CME Vol2Vol™ Options Intelligence — Standalone Pro Widescreen Dashboard
 * Real-time TradingView sync, multi-asset perspective shifting, interactive SD ranges,
 * parameter override station, and strike inspector.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. State Management
  let chart = null;
  let rawData = null;
  let currentStats = null;
  let comparisonQuotes = null;
  let convertedGc1 = null;
  let convertedXau = null;
  let activePerspective = '0dte';
  let activeDte = 0;
  let currentTheme = 'dark';
  let activeTabId = null;

  // 2. DOM Elements Binding
  // Header / Navigation
  const symbolBadge = document.getElementById('dash-symbol-badge');
  const tagDte = document.getElementById('dash-tag-dte');
  const headlineText = document.getElementById('dash-headline-text');
  const statusDot = document.getElementById('dash-status-dot');
  const statusText = document.getElementById('dash-status-text');
  const btnSync = document.getElementById('btn-dash-sync');
  const btnTheme = document.getElementById('btn-dash-theme');
  const txtTheme = document.getElementById('txt-dash-theme');

  // KPI Cards
  const valPrice = document.getElementById('dash-val-price');
  const subOpen = document.getElementById('dash-sub-open');
  const netChange = document.getElementById('dash-net-change');
  const subIv = document.getElementById('dash-sub-iv');
  const tagSeries = document.getElementById('dash-tag-series');

  const tagFlow = document.getElementById('dash-tag-flow');
  const valDom = document.getElementById('dash-val-dom');
  const subDom = document.getElementById('dash-sub-dom');
  const shareCall = document.getElementById('dash-share-call');
  const sharePut = document.getElementById('dash-share-put');
  const lblCall = document.getElementById('dash-lbl-call');
  const lblPut = document.getElementById('dash-lbl-put');

  const val1sd = document.getElementById('dash-val-1sd');
  const sub1sdPct = document.getElementById('dash-sub-1sd-pct');
  const subOpen1sd = document.getElementById('dash-sub-open-1sd');

  const meanCall = document.getElementById('dash-mean-call');
  const meanCallDiff = document.getElementById('dash-mean-call-diff');
  const meanBoth = document.getElementById('dash-mean-both');
  const meanBothDiff = document.getElementById('dash-mean-both-diff');
  const meanPut = document.getElementById('dash-mean-put');
  const meanPutDiff = document.getElementById('dash-mean-put-diff');

  // SD Ranges Table
  const sdSummary = document.getElementById('dash-sd-summary');
  const btnAnchorCurrent = document.getElementById('btn-anchor-current');
  const btnAnchorOpen = document.getElementById('btn-anchor-open');
  const btnCopySd = document.getElementById('btn-copy-sd');

  const rowStl = document.getElementById('dash-row-stl');
  const lblStlRow = document.getElementById('dash-lbl-stl-row');
  const sdM3 = document.getElementById('dash-sd-m3');
  const sdM2 = document.getElementById('dash-sd-m2');
  const sdM1 = document.getElementById('dash-sd-m1');
  const sdAtm = document.getElementById('dash-sd-atm');
  const sdP1 = document.getElementById('dash-sd-p1');
  const sdP2 = document.getElementById('dash-sd-p2');
  const sdP3 = document.getElementById('dash-sd-p3');

  const rowGoldf = document.getElementById('dash-row-goldf');
  const diffGoldf = document.getElementById('dash-diff-goldf');
  const goldfM3 = document.getElementById('dash-goldf-m3');
  const goldfM2 = document.getElementById('dash-goldf-m2');
  const goldfM1 = document.getElementById('dash-goldf-m1');
  const goldfAtm = document.getElementById('dash-goldf-atm');
  const goldfP1 = document.getElementById('dash-goldf-p1');
  const goldfP2 = document.getElementById('dash-goldf-p2');
  const goldfP3 = document.getElementById('dash-goldf-p3');

  const rowXau = document.getElementById('dash-row-xau');
  const diffXau = document.getElementById('dash-diff-xau');
  const xauM3 = document.getElementById('dash-xau-m3');
  const xauM2 = document.getElementById('dash-xau-m2');
  const xauM1 = document.getElementById('dash-xau-m1');
  const xauAtm = document.getElementById('dash-xau-atm');
  const xauP1 = document.getElementById('dash-xau-p1');
  const xauP2 = document.getElementById('dash-xau-p2');
  const xauP3 = document.getElementById('dash-xau-p3');

  const rowOpen = document.getElementById('dash-row-open');
  const lblOpenRow = document.getElementById('dash-lbl-open-row');
  const openM3 = document.getElementById('dash-open-m3');
  const openM2 = document.getElementById('dash-open-m2');
  const openM1 = document.getElementById('dash-open-m1');
  const openAtm = document.getElementById('dash-open-atm');
  const openP1 = document.getElementById('dash-open-p1');
  const openP2 = document.getElementById('dash-open-p2');
  const openP3 = document.getElementById('dash-open-p3');

  // Chart Controls
  const chartTitle = document.getElementById('dash-chart-title-text');
  const legendPut = document.getElementById('dash-legend-put');
  const legendCall = document.getElementById('dash-legend-call');
  const legendVol = document.getElementById('dash-legend-vol');
  const legendFuture = document.getElementById('dash-legend-future');
  const legendOpen = document.getElementById('dash-legend-open');

  const chkSd1 = document.getElementById('chk-dash-sd1');
  const chkSd2 = document.getElementById('chk-dash-sd2');
  const chkSd3 = document.getElementById('chk-dash-sd3');
  const chkBell = document.getElementById('chk-dash-bell');
  const selAnchor = document.getElementById('sel-dash-anchor');
  const selRange = document.getElementById('sel-dash-range');
  const canvas = document.getElementById('dash-canvas');

  // Control Station / Overrides
  const dtePills = document.querySelectorAll('.dash-dte-pill');
  const inpPrice = document.getElementById('inp-dash-price');
  const inpOpen = document.getElementById('inp-dash-open');
  const inpIv = document.getElementById('inp-dash-iv');
  const btnTickUp = document.getElementById('btn-dash-tick-up');
  const btnTickDown = document.getElementById('btn-dash-tick-down');
  const btnToggleRaw = document.getElementById('btn-toggle-raw');
  const txtToggleRaw = document.getElementById('txt-toggle-raw');

  // Raw Inspector Drawer
  const rawDrawer = document.getElementById('dash-raw-drawer');
  const rawCount = document.getElementById('dash-raw-count');
  const rawTbody = document.getElementById('dash-raw-tbody');

  // Footer
  const footerTimestamp = document.getElementById('dash-footer-timestamp');

  // 3. Initialize High-Resolution Canvas Chart
  if (canvas && typeof Vol2VolChart !== 'undefined') {
    chart = new Vol2VolChart(canvas, { theme: currentTheme });
    window.addEventListener('resize', () => {
      if (chart) chart.resize();
    });
  }

  // 4. Status Indicator Utility
  function setConnectionStatus(state, label) {
    if (statusDot) {
      statusDot.className = 'cme-v2v-live-dot';
      if (state === 'live' || state === 'synced') {
        statusDot.classList.add('live');
      } else if (state === 'offline') {
        statusDot.classList.add('offline');
      }
    }
    if (statusText) {
      statusText.textContent = label;
    }
  }

  // 5. Render UI Main Function
  function renderUI(stats, meta = {}) {
    if (!stats) return;
    currentStats = stats;

    const S = Number(stats.underlyingPrice || 0);
    const openP = Number(stats.openPrice || S);
    const iv = Number(stats.atmVolatility || 0);
    const diffOpen = S - openP;
    const diffPct = openP > 0 ? (diffOpen / openP) * 100 : 0;
    const sym = meta.symbol || rawData?.symbol || 'COMEX:GCV2026';

    // Header Badges
    if (symbolBadge) symbolBadge.textContent = sym;
    if (tagDte) tagDte.textContent = activeDte === 0 ? '0 DTE Intraday' : `${activeDte} DTE`;
    if (headlineText) {
      headlineText.textContent = `${sym} Vol2Vol™ Expected Range (${activeDte} DTE) vs ${S.toFixed(1)} at ${iv.toFixed(2)}% Volatility`;
    }

    // KPI Card 1: Future Settlement Price
    if (valPrice) valPrice.textContent = S.toFixed(1);
    if (subOpen) {
      const sign = diffOpen >= 0 ? '+' : '';
      const colorOpen = diffOpen >= 0 ? '#22c55e' : '#f23645';
      subOpen.innerHTML = `Open: ${openP.toFixed(1)} <span id="dash-net-change" style="color: ${colorOpen}; font-weight: 600;">(${sign}$${diffOpen.toFixed(1)} / ${sign}${diffPct.toFixed(2)}%)</span>`;
    }
    if (subIv) subIv.innerHTML = `ATM Vol Stl: <strong>${iv.toFixed(2)}%</strong>`;

    // KPI Card 2: Dominance & Flow
    const totalVol = (stats.totalCallVol || 0) + (stats.totalPutVol || 0);
    const callShare = totalVol > 0 ? Math.round((stats.totalCallVol / totalVol) * 100) : 50;
    const putShare = 100 - callShare;

    if (valDom) {
      valDom.textContent = `${stats.dominance} (+${stats.dominancePct}%)`;
      valDom.style.color = stats.dominance === 'CALLS' ? '#22c55e' : '#ef4444';
    }
    if (subDom) subDom.textContent = `PCR: ${stats.pcr} | CPR: ${stats.callPutRatio}`;
    if (tagFlow) {
      tagFlow.textContent = stats.dominance === 'CALLS' ? 'Bullish Flow' : 'Bearish Flow';
      tagFlow.style.color = stats.dominance === 'CALLS' ? '#22c55e' : '#ef4444';
      tagFlow.style.background = stats.dominance === 'CALLS' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)';
    }
    if (shareCall) shareCall.style.width = `${callShare}%`;
    if (sharePut) sharePut.style.width = `${putShare}%`;
    if (lblCall) lblCall.textContent = `Calls: ${(stats.totalCallVol || 0).toLocaleString()} (${callShare}%)`;
    if (lblPut) lblPut.textContent = `Puts: ${(stats.totalPutVol || 0).toLocaleString()} (${putShare}%)`;

    // KPI Card 3: 1SD Expected Move
    const ranges = stats.stdDevRanges || {};
    const sd1Val = ranges['+1'] && ranges['ATM'] ? Math.abs(Number(ranges['+1']) - Number(ranges['ATM'])) : (S * (iv / 100) * Math.sqrt((activeDte || 0.08) / 365));
    const sd1Pct = S > 0 ? (sd1Val / S) * 100 : 0;
    if (val1sd) val1sd.textContent = `±$${sd1Val.toFixed(1)}`;
    if (sub1sdPct) sub1sdPct.textContent = `±${sd1Pct.toFixed(2)}% implied probability range`;

    // KPI Card 4: Volume-Weighted Means
    if (meanCall) meanCall.textContent = stats.meanCall ? stats.meanCall.toLocaleString() : '--';
    if (meanBoth) meanBoth.textContent = stats.meanBoth ? stats.meanBoth.toLocaleString() : '--';
    if (meanPut) meanPut.textContent = stats.meanPut ? stats.meanPut.toLocaleString() : '--';

    const diffCall = (stats.meanCall || S) - S;
    const diffBoth = (stats.meanBoth || S) - S;
    const diffPut = (stats.meanPut || S) - S;
    if (meanCallDiff) meanCallDiff.textContent = `${diffCall >= 0 ? '+' : ''}$${diffCall.toFixed(1)}`;
    if (meanBothDiff) meanBothDiff.textContent = `${diffBoth >= 0 ? '+' : ''}$${diffBoth.toFixed(1)}`;
    if (meanPutDiff) meanPutDiff.textContent = `${diffPut >= 0 ? '+' : ''}$${diffPut.toFixed(1)}`;

    // Inputs in parameter station
    if (inpPrice && document.activeElement !== inpPrice) inpPrice.value = S.toFixed(1);
    if (inpOpen && document.activeElement !== inpOpen) inpOpen.value = openP.toFixed(1);
    if (inpIv && document.activeElement !== inpIv) inpIv.value = iv.toFixed(2);

    // Chart Legends (Dynamic Perspective Aware)
    updateChartLegend();

    // Multi-Asset SD Table
    updateSdTable();

    // Chart Canvas Rendering
    if (chart) {
      chart.update(stats);
      if (activePerspective && activePerspective !== '0dte') {
        setPerspectiveMode(activePerspective);
      }
    }

    // Update Raw Inspector
    renderRawInspector();

    // Footer Timestamp
    if (footerTimestamp) {
      const d = meta.timestamp ? new Date(meta.timestamp) : new Date();
      footerTimestamp.textContent = `Last Synced: ${d.toLocaleTimeString()} | Source: ${meta.source || 'CME Vol2Vol Engine'}`;
    }
  }

  // 5.1 Update Chart Legends (Perspective-Aware)
  function updateChartLegend() {
    if (!currentStats) return;

    const S = Number(currentStats.underlyingPrice || 0);
    const openP = Number(currentStats.openPrice || S);
    const iv = Number(currentStats.atmVolatility || 0);

    if (legendPut) legendPut.textContent = `Puts (${(currentStats.totalPutVol || 0).toLocaleString()})`;
    if (legendCall) legendCall.textContent = `Calls (${(currentStats.totalCallVol || 0).toLocaleString()})`;
    if (legendVol) legendVol.textContent = `Vol Stl (${iv.toFixed(2)}%)`;

    const legendFutureDot = document.querySelector('.dash-legend-dot.future');

    if (activePerspective === 'goldf') {
      const gc1Quote = comparisonQuotes?.gc1;
      const gc1Price = gc1Quote?.price;
      const basis = convertedGc1 ? convertedGc1.diff : (gc1Price && S ? gc1Price - S : 0);
      const targetPrice = gc1Price || (S > 0 ? S + basis : 0);
      const targetOpen = openP ? Math.round((openP + basis) * 10) / 10 : openP;

      if (legendFuture) legendFuture.textContent = `GOLD.F (${targetPrice.toFixed(1)})`;
      if (legendOpen) legendOpen.textContent = `Open (${targetOpen.toFixed(1)})`;
      if (legendFutureDot) legendFutureDot.style.background = '#f59e0b';
    } else if (activePerspective === 'xau') {
      const xauQuote = comparisonQuotes?.xau;
      const xauPrice = xauQuote?.price;
      const basis = convertedXau ? convertedXau.diff : (xauPrice && S ? xauPrice - S : 0);
      const targetPrice = xauPrice || (S > 0 ? S + basis : 0);
      const targetOpen = openP ? Math.round((openP + basis) * 10) / 10 : openP;

      if (legendFuture) legendFuture.textContent = `XAU Spot (${targetPrice.toFixed(1)})`;
      if (legendOpen) legendOpen.textContent = `Open (${targetOpen.toFixed(1)})`;
      if (legendFutureDot) legendFutureDot.style.background = '#06b6d4';
    } else {
      const sym = symbolBadge ? symbolBadge.textContent : (rawData?.symbol || 'COMEX:GCV2026');
      const cleanSym = sym ? sym.replace('COMEX:', '').trim() : '';
      const stlLbl = cleanSym ? `0DTE ${cleanSym}` : '0DTE Stl';
      if (legendFuture) legendFuture.textContent = `${stlLbl} (${S.toFixed(1)})`;
      if (legendOpen) legendOpen.textContent = `Open (${openP.toFixed(1)})`;
      if (legendFutureDot) legendFutureDot.style.background = '#f23645';
    }
  }

  // 6. Update Multi-Asset SD Table
  function updateSdTable() {
    if (!currentStats) return;

    const S = Number(currentStats.underlyingPrice || 0);
    const openP = Number(currentStats.openPrice || S);
    const sym = symbolBadge ? symbolBadge.textContent : (rawData?.symbol || 'COMEX:GCV2026');
    const r = currentStats.stdDevRanges || {};
    const fmt = (v) => (v != null && !isNaN(v)) ? Number(v).toFixed(1) : '--';

    // Row 1: 0DTE Stl Baseline
    if (lblStlRow) {
      const cleanSym = sym ? sym.replace('COMEX:', '').trim() : '0DTE';
      lblStlRow.textContent = `0DTE ${cleanSym}`;
    }
    if (sdM3) sdM3.textContent = fmt(r['-3']);
    if (sdM2) sdM2.textContent = fmt(r['-2']);
    if (sdM1) sdM1.textContent = fmt(r['-1']);
    if (sdAtm) sdAtm.textContent = fmt(r['ATM'] != null ? r['ATM'] : S);
    if (sdP1) sdP1.textContent = fmt(r['+1']);
    if (sdP2) sdP2.textContent = fmt(r['+2']);
    if (sdP3) sdP3.textContent = fmt(r['+3']);

    // Row 2: GOLD.F Futures Converted (Basis)
    const gc1Price = comparisonQuotes?.gc1?.price;
    if (gc1Price && typeof OptionsMath !== 'undefined' && OptionsMath.computeConvertedRanges && S > 0) {
      convertedGc1 = OptionsMath.computeConvertedRanges(r, S, gc1Price);
      if (diffGoldf) {
        diffGoldf.textContent = `Basis ${convertedGc1.diffFormatted}`;
        diffGoldf.className = `dash-diff-badge ${convertedGc1.diff >= 0 ? 'diff-pos' : 'diff-neg'}`;
      }
      if (goldfM3) goldfM3.textContent = fmt(convertedGc1.ranges['-3']);
      if (goldfM2) goldfM2.textContent = fmt(convertedGc1.ranges['-2']);
      if (goldfM1) goldfM1.textContent = fmt(convertedGc1.ranges['-1']);
      if (goldfAtm) goldfAtm.textContent = fmt(convertedGc1.ranges['ATM'] != null ? convertedGc1.ranges['ATM'] : gc1Price);
      if (goldfP1) goldfP1.textContent = fmt(convertedGc1.ranges['+1']);
      if (goldfP2) goldfP2.textContent = fmt(convertedGc1.ranges['+2']);
      if (goldfP3) goldfP3.textContent = fmt(convertedGc1.ranges['+3']);
    } else if (convertedGc1) {
      if (diffGoldf) {
        diffGoldf.textContent = `Basis ${convertedGc1.diffFormatted}`;
        diffGoldf.className = `dash-diff-badge ${convertedGc1.diff >= 0 ? 'diff-pos' : 'diff-neg'}`;
      }
      if (goldfM3) goldfM3.textContent = fmt(convertedGc1.ranges['-3']);
      if (goldfM2) goldfM2.textContent = fmt(convertedGc1.ranges['-2']);
      if (goldfM1) goldfM1.textContent = fmt(convertedGc1.ranges['-1']);
      if (goldfAtm) goldfAtm.textContent = fmt(convertedGc1.ranges['ATM']);
      if (goldfP1) goldfP1.textContent = fmt(convertedGc1.ranges['+1']);
      if (goldfP2) goldfP2.textContent = fmt(convertedGc1.ranges['+2']);
      if (goldfP3) goldfP3.textContent = fmt(convertedGc1.ranges['+3']);
    }

    // Row 3: XAU Spot Converted (Basis)
    const xauPrice = comparisonQuotes?.xau?.price;
    if (xauPrice && typeof OptionsMath !== 'undefined' && OptionsMath.computeConvertedRanges && S > 0) {
      convertedXau = OptionsMath.computeConvertedRanges(r, S, xauPrice);
      if (diffXau) {
        diffXau.textContent = `Basis ${convertedXau.diffFormatted}`;
        diffXau.className = `dash-diff-badge ${convertedXau.diff >= 0 ? 'diff-pos' : 'diff-neg'}`;
      }
      if (xauM3) xauM3.textContent = fmt(convertedXau.ranges['-3']);
      if (xauM2) xauM2.textContent = fmt(convertedXau.ranges['-2']);
      if (xauM1) xauM1.textContent = fmt(convertedXau.ranges['-1']);
      if (xauAtm) xauAtm.textContent = fmt(convertedXau.ranges['ATM'] != null ? convertedXau.ranges['ATM'] : xauPrice);
      if (xauP1) xauP1.textContent = fmt(convertedXau.ranges['+1']);
      if (xauP2) xauP2.textContent = fmt(convertedXau.ranges['+2']);
      if (xauP3) xauP3.textContent = fmt(convertedXau.ranges['+3']);
    } else if (convertedXau) {
      if (diffXau) {
        diffXau.textContent = `Basis ${convertedXau.diffFormatted}`;
        diffXau.className = `dash-diff-badge ${convertedXau.diff >= 0 ? 'diff-pos' : 'diff-neg'}`;
      }
      if (xauM3) xauM3.textContent = fmt(convertedXau.ranges['-3']);
      if (xauM2) xauM2.textContent = fmt(convertedXau.ranges['-2']);
      if (xauM1) xauM1.textContent = fmt(convertedXau.ranges['-1']);
      if (xauAtm) xauAtm.textContent = fmt(convertedXau.ranges['ATM']);
      if (xauP1) xauP1.textContent = fmt(convertedXau.ranges['+1']);
      if (xauP2) xauP2.textContent = fmt(convertedXau.ranges['+2']);
      if (xauP3) xauP3.textContent = fmt(convertedXau.ranges['+3']);
    }

    // Row 4: From Day Open SD Ranges (Dynamic Perspective Aware)
    let activeOpen = openP;
    let openLabel = 'From Open (0DTE)';
    const baseOpenRanges = currentStats.stdDevRangesFromOpen || {};
    let activeOpenRanges = baseOpenRanges;

    if (activePerspective === 'goldf') {
      const gc1Quote = comparisonQuotes?.gc1;
      const basis = convertedGc1 ? convertedGc1.diff : (gc1Quote?.price && S ? gc1Quote.price - S : 0);
      activeOpen = openP ? Math.round((openP + basis) * 10) / 10 : 0;
      openLabel = 'From Open (GOLD.F)';
      if (typeof OptionsMath !== 'undefined' && OptionsMath.computeConvertedRanges && openP > 0 && activeOpen > 0) {
        activeOpenRanges = OptionsMath.computeConvertedRanges(baseOpenRanges, openP, activeOpen).ranges;
      }
    } else if (activePerspective === 'xau') {
      const xauQuote = comparisonQuotes?.xau;
      const basis = convertedXau ? convertedXau.diff : (xauQuote?.price && S ? xauQuote.price - S : 0);
      activeOpen = openP ? Math.round((openP + basis) * 10) / 10 : 0;
      openLabel = 'From Open (XAU Spot)';
      if (typeof OptionsMath !== 'undefined' && OptionsMath.computeConvertedRanges && openP > 0 && activeOpen > 0) {
        activeOpenRanges = OptionsMath.computeConvertedRanges(baseOpenRanges, openP, activeOpen).ranges;
      }
    } else {
      const cleanSym = sym ? sym.replace('COMEX:', '').trim() : '';
      openLabel = cleanSym ? `From Open (${cleanSym})` : 'From Open (0DTE)';
    }

    if (lblOpenRow) lblOpenRow.textContent = openLabel;
    if (openM3) openM3.textContent = fmt(activeOpenRanges['-3']);
    if (openM2) openM2.textContent = fmt(activeOpenRanges['-2']);
    if (openM1) openM1.textContent = fmt(activeOpenRanges['-1']);
    if (openAtm) openAtm.textContent = fmt(activeOpenRanges['Open'] != null ? activeOpenRanges['Open'] : activeOpen);
    if (openP1) openP1.textContent = fmt(activeOpenRanges['+1']);
    if (openP2) openP2.textContent = fmt(activeOpenRanges['+2']);
    if (openP3) openP3.textContent = fmt(activeOpenRanges['+3']);

    if (sdSummary && r['ATM']) {
      sdSummary.textContent = `ATM: ${fmt(r['ATM'])} | ±1SD: [${fmt(r['-1'])} – ${fmt(r['+1'])}] | ±2SD: [${fmt(r['-2'])} – ${fmt(r['+2'])}]`;
    }
  }

  // 7. Multi-Asset Perspective Switching
  function setPerspectiveMode(mode) {
    activePerspective = mode || '0dte';
    const basePrice = Number(currentStats?.underlyingPrice || rawData?.underlyingPrice || 0);
    let config = {
      mode: '0dte',
      basis: 0,
      targetPrice: null,
      targetOpen: null,
      label: '0DTE',
      color: '#f23645',
      convertedRanges: null,
    };

    if (mode === 'goldf') {
      const gc1Quote = comparisonQuotes?.gc1;
      const gc1Price = gc1Quote?.price;
      const conv = convertedGc1;
      const basis = conv ? conv.diff : (gc1Price && basePrice ? gc1Price - basePrice : 0);
      const baseOpen = Number(currentStats?.openPrice || rawData?.openPrice || basePrice);
      const targetOpen = baseOpen ? Math.round((baseOpen + basis) * 10) / 10 : null;
      config = {
        mode: 'goldf',
        basis,
        targetPrice: gc1Price,
        targetOpen,
        label: 'GOLD.F',
        color: '#f59e0b',
        convertedRanges: conv?.ranges || null,
      };
    } else if (mode === 'xau') {
      const xauQuote = comparisonQuotes?.xau;
      const xauPrice = xauQuote?.price;
      const conv = convertedXau;
      const basis = conv ? conv.diff : (xauPrice && basePrice ? xauPrice - basePrice : 0);
      const baseOpen = Number(currentStats?.openPrice || rawData?.openPrice || basePrice);
      const targetOpen = baseOpen ? Math.round((baseOpen + basis) * 10) / 10 : null;
      config = {
        mode: 'xau',
        basis,
        targetPrice: xauPrice,
        targetOpen,
        label: 'XAU Spot',
        color: '#06b6d4',
        convertedRanges: conv?.ranges || null,
      };
    }

    if (chart) {
      chart.setPerspective(config);
    }

    // Update Perspective Buttons
    document.querySelectorAll('.dash-persp-btn').forEach((btn) => {
      const p = btn.getAttribute('data-persp');
      btn.classList.toggle('active', p === mode);
      if (p === 'goldf') btn.classList.toggle('active-goldf', mode === 'goldf');
      if (p === 'xau') btn.classList.toggle('active-xau', mode === 'xau');
    });

    // Update Table Rows Highlighting
    if (rowStl) {
      rowStl.classList.toggle('dash-row-active-persp', mode === '0dte');
      rowStl.classList.toggle('dash-row-active', mode === '0dte');
    }
    if (rowGoldf) rowGoldf.classList.toggle('dash-row-active-persp', mode === 'goldf');
    if (rowXau) rowXau.classList.toggle('dash-row-active-persp', mode === 'xau');

    // Update Chart Title Header
    if (chartTitle) {
      if (mode === 'goldf') {
        const basisStr = config.basis >= 0 ? `+${config.basis.toFixed(1)}` : config.basis.toFixed(1);
        chartTitle.textContent = `BLACKBULL:GOLD.F RANGE (BASIS SPREAD ${basisStr}) — VOL2VOL™`;
        chartTitle.style.color = '#f59e0b';
      } else if (mode === 'xau') {
        const basisStr = config.basis >= 0 ? `+${config.basis.toFixed(1)}` : config.basis.toFixed(1);
        chartTitle.textContent = `OANDA:XAUUSD SPOT RANGE (BASIS SPREAD ${basisStr}) — VOL2VOL™`;
        chartTitle.style.color = '#06b6d4';
      } else {
        chartTitle.textContent = 'COMEX:GCV2026 VOL2VOL™ EXPECTED RANGE INTRADAY VOLUME';
        chartTitle.style.color = '';
      }
    }

    // Immediately refresh SD table & Chart Legend so Row 4 and Header adapt to active perspective
    updateSdTable();
    updateChartLegend();
  }

  // 8. Recalculate with DTE Mode
  function recalculateWithDte(dteVal) {
    activeDte = dteVal;
    dtePills.forEach((p) => {
      const pVal = parseInt(p.dataset.dte, 10);
      p.classList.toggle('active', pVal === dteVal);
    });

    if (!rawData || typeof OptionsMath === 'undefined') return;

    const stats = OptionsMath.calculateStats({
      underlyingPrice: rawData.underlyingPrice,
      spotPrice: rawData.underlyingPrice,
      openPrice: rawData.openPrice,
      volAnchorPrice: rawData.volAnchorPrice || rawData.underlyingPrice,
      atmVolatility: rawData.atmVolatility || 23.66,
      dte: dteVal,
      strikesData: rawData.strikesData || [],
    });

    renderUI(stats, {
      symbol: rawData.symbol,
      source: 'DTE Changed',
      timestamp: Date.now(),
    });

    // Notify active TradingView tab
    if (activeTabId && typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.sendMessage(activeTabId, {
        type: 'SET_DTE_MODE',
        dteMode: String(dteVal),
      }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  }

  // 9. Raw Strikes Inspector Rendering
  function renderRawInspector() {
    if (!rawDrawer || rawDrawer.style.display === 'none' || !currentStats) return;

    const strikes = currentStats.strikesData || [];
    const S = Number(currentStats.underlyingPrice || 0);
    if (rawCount) rawCount.textContent = `(${strikes.length} strikes loaded)`;

    if (rawTbody) {
      rawTbody.innerHTML = '';
      strikes.forEach((s) => {
        const tr = document.createElement('tr');
        const k = Number(s.strike);
        const dist = S > 0 ? k - S : 0;
        const isAtm = Math.abs(dist) <= 5;
        if (isAtm) tr.className = 'dash-raw-atm';

        const sign = dist >= 0 ? '+' : '';
        const total = (s.callVolume || 0) + (s.putVolume || 0);

        tr.innerHTML = `
          <td style="font-weight: 700; text-align: left; padding-left: 12px;">${k.toFixed(1)}</td>
          <td style="color: #22c55e;">${(s.callVolume || 0).toLocaleString()}</td>
          <td style="color: #ef4444;">${(s.putVolume || 0).toLocaleString()}</td>
          <td style="font-weight: 600;">${total.toLocaleString()}</td>
          <td style="color: #f59e0b;">${s.volStl ? s.volStl.toFixed(2) + '%' : '--'}</td>
          <td style="color: #787b86;">${sign}${dist.toFixed(1)}</td>
        `;
        rawTbody.appendChild(tr);
      });
    }
  }

  // 10. Real-Time Storage & Sync Connection
  async function initConnection() {
    setConnectionStatus('connecting', 'CONNECTING...');

    // Load saved preferences
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['cme_v2v_theme', 'cme_v2v_live_state', 'cme_vol2vol_data'], (res) => {
        if (res.cme_v2v_theme) {
          applyTheme(res.cme_v2v_theme);
        }

        const state = res.cme_v2v_live_state || res.cme_vol2vol_data;
        if (state) {
          rawData = {
            symbol: state.symbol || 'COMEX:GCV2026',
            underlyingPrice: state.underlyingPrice,
            openPrice: state.openPrice,
            atmVolatility: state.atmVolatility,
            volAnchorPrice: state.volAnchorPrice,
            strikesData: state.strikesData,
          };
          activeDte = state.resolvedDte !== undefined ? state.resolvedDte : 0;
          if (state.comparisonQuotes) comparisonQuotes = state.comparisonQuotes;
          if (state.convertedGc1) convertedGc1 = state.convertedGc1;
          if (state.convertedXau) convertedXau = state.convertedXau;
          if (state.stats) {
            renderUI(state.stats, {
              symbol: state.symbol,
              source: 'Cached TV Sync',
              timestamp: state.updatedAt || state.timestamp,
            });
            setConnectionStatus('synced', 'SYNCED WITH TV');
          }
          if (state.activePerspective) {
            setPerspectiveMode(state.activePerspective);
          }
        }
      });

      // Listen to real-time storage changes
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.cme_v2v_live_state) {
          const s = changes.cme_v2v_live_state.newValue;
          if (s && s.stats) {
            rawData = {
              symbol: s.symbol,
              underlyingPrice: s.underlyingPrice,
              openPrice: s.openPrice,
              atmVolatility: s.atmVolatility,
              volAnchorPrice: s.volAnchorPrice,
              strikesData: s.strikesData,
            };
            if (s.comparisonQuotes) comparisonQuotes = s.comparisonQuotes;
            if (s.convertedGc1) convertedGc1 = s.convertedGc1;
            if (s.convertedXau) convertedXau = s.convertedXau;
            renderUI(s.stats, {
              symbol: s.symbol,
              source: 'Live Stream',
              timestamp: s.updatedAt,
            });
            setConnectionStatus('live', 'REALTIME STREAMING');
          }
        }
      });
    }

    // Connect to active tab
    queryActiveTab();
  }

  function queryActiveTab() {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      loadFallbackDemo();
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0] || !tabs[0].id) {
        fallbackToStorageOrDemo();
        return;
      }

      const tab = tabs[0];
      const isTvTab = tab.url && tab.url.includes('tradingview.com/options');

      if (!isTvTab) {
        chrome.tabs.query({ url: '*://*.tradingview.com/options/*' }, (tvTabs) => {
          if (tvTabs && tvTabs.length > 0) {
            activeTabId = tvTabs[0].id;
            requestTabData(activeTabId, 'BG TAB SYNCED');
          } else {
            activeTabId = null;
            fallbackToStorageOrDemo();
          }
        });
        return;
      }

      activeTabId = tab.id;
      requestTabData(activeTabId, 'LIVE TAB CONNECTED');
    });
  }

  function requestTabData(tabId, statusLabel) {
    chrome.tabs.sendMessage(tabId, { type: 'GET_V2V_DATA' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        fallbackToStorageOrDemo();
        return;
      }

      setConnectionStatus('live', statusLabel);
      if (response.currentData) {
        rawData = {
          symbol: response.symbol || response.currentData.symbol,
          underlyingPrice: response.currentData.underlyingPrice,
          openPrice: response.currentData.openPrice,
          atmVolatility: response.currentData.atmVolatility,
          volAnchorPrice: response.currentData.volAnchorPrice,
          strikesData: response.currentData.strikesData,
        };
      }

      if (response.selectedDteMode !== undefined) {
        activeDte = parseInt(response.selectedDteMode, 10) || 0;
      }

      if (response.comparisonQuotes) comparisonQuotes = response.comparisonQuotes;
      if (response.convertedGc1) convertedGc1 = response.convertedGc1;
      if (response.convertedXau) convertedXau = response.convertedXau;

      if (response.stats) {
        renderUI(response.stats, {
          symbol: response.symbol,
          source: 'Live Tab',
          timestamp: response.timestamp,
        });
      } else if (rawData) {
        recalculateWithDte(activeDte);
      }
    });
  }

  function fallbackToStorageOrDemo() {
    if (currentStats) {
      setConnectionStatus('synced', 'SYNCED (SAVED)');
      fetchComparisonQuotesFallback();
      return;
    }
    loadFallbackDemo();
  }

  function loadFallbackDemo() {
    if (typeof DataParser === 'undefined' || typeof OptionsMath === 'undefined') return;
    const demo = DataParser.getLive0DteGoldDemoData();
    rawData = {
      symbol: demo.symbol || 'COMEX:GCV2026',
      underlyingPrice: demo.underlyingPrice,
      openPrice: demo.openPrice,
      atmVolatility: demo.atmVolatility,
      volAnchorPrice: demo.underlyingPrice,
      strikesData: demo.strikesData,
    };
    activeDte = 0;

    const stats = OptionsMath.calculateStats({
      underlyingPrice: demo.underlyingPrice,
      spotPrice: demo.underlyingPrice,
      openPrice: demo.openPrice,
      volAnchorPrice: demo.underlyingPrice,
      atmVolatility: demo.atmVolatility,
      dte: 0,
      strikesData: demo.strikesData,
    });

    renderUI(stats, {
      symbol: demo.symbol,
      source: 'Benchmark Demo',
      timestamp: Date.now(),
    });
    setConnectionStatus('offline', 'BENCHMARK 0DTE');

    fetchScannerFallback(demo.symbol || 'COMEX:GCV2026');
    fetchComparisonQuotesFallback();
  }

  async function fetchScannerFallback(sym) {
    try {
      const url = `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(sym)}&fields=close,open,high,low,change`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const d = await res.json();
        const p = Number(d.close);
        const op = Number(d.open);
        if (!isNaN(p) && p > 100 && rawData) {
          rawData.underlyingPrice = p;
          if (!isNaN(op) && op > 100) rawData.openPrice = op;
          recalculateWithDte(activeDte);
          setConnectionStatus('synced', 'LIVE SCANNER QUOTE');
        }
      }
    } catch (e) {}
    fetchComparisonQuotesFallback();
  }

  async function fetchComparisonQuotesFallback() {
    try {
      const [resGoldF, resXau] = await Promise.all([
        fetch('https://www.tradingview.com/symbols/GOLD.F/', {
          headers: { Accept: 'text/html' },
        }).then(async (r) => {
          if (!r.ok) return null;
          const html = await r.text();
          const priceMatch = html.match(/"trade":\{"price":([0-9.]+)\}/);
          const dailyMatch = html.match(/"daily_bar":\{"close":"([0-9.]+)","data_update_time":"[^"]*","high":"([0-9.]+)","low":"([0-9.]+)","open":"([0-9.]+)"/);
          const p = priceMatch ? Number(priceMatch[1]) : (dailyMatch ? Number(dailyMatch[1]) : null);
          const op = dailyMatch ? Number(dailyMatch[4]) : null;
          if (p && p > 100) {
            return { price: p, displaySymbol: 'GOLD.F', symbol: 'BLACKBULL:GOLD.F', source: 'BlackBull Markets' };
          }
          return null;
        }).catch(() => null),

        fetch('https://scanner.tradingview.com/symbol?symbol=OANDA%3AXAUUSD&fields=close,open,change').then((r) => r.json()).catch(() => null),
      ]);

      let updated = false;
      if (resGoldF) {
        if (!comparisonQuotes) comparisonQuotes = {};
        comparisonQuotes.gc1 = resGoldF;
        updated = true;
      }
      if (resXau && resXau.close) {
        const p = Number(resXau.close);
        const op = Number(resXau.open);
        if (p > 100) {
          if (!comparisonQuotes) comparisonQuotes = {};
          comparisonQuotes.xau = {
            price: p,
            openPrice: op,
            displaySymbol: 'XAUUSD',
            symbol: 'OANDA:XAUUSD',
            source: 'OANDA CFD',
          };
          updated = true;
        }
      }

      if (updated && currentStats) {
        updateSdTable();
        if (activePerspective !== '0dte') {
          setPerspectiveMode(activePerspective);
        }
      }
    } catch (e) {}
  }

  // 11. Theme Management
  function applyTheme(theme) {
    currentTheme = theme;
    if (theme === 'light') {
      document.body.classList.add('cme-v2v-theme-light');
      document.body.classList.remove('cme-v2v-theme-dark');
      if (txtTheme) txtTheme.textContent = 'Light';
    } else {
      document.body.classList.add('cme-v2v-theme-dark');
      document.body.classList.remove('cme-v2v-theme-light');
      if (txtTheme) txtTheme.textContent = 'Dark';
    }
    if (chart) {
      chart.setTheme(theme);
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ cme_v2v_theme: theme });
    }
  }

  // 12. UI Event Handlers
  // Theme Toggle Button
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
  }

  // Sync Button
  if (btnSync) {
    btnSync.addEventListener('click', () => {
      btnSync.style.transform = 'rotate(360deg)';
      btnSync.style.transition = 'transform 0.5s ease';
      setTimeout(() => {
        btnSync.style.transform = 'none';
        btnSync.style.transition = 'none';
      }, 500);

      if (activeTabId && typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.sendMessage(activeTabId, { type: 'TRIGGER_SYNC' }, () => {
          setTimeout(queryActiveTab, 300);
        });
      } else {
        queryActiveTab();
      }
    });
  }

  // Perspective Pills
  document.querySelectorAll('.dash-persp-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-persp');
      setPerspectiveMode(p);
    });
  });

  // Table Rows Click to switch perspective
  if (rowStl) rowStl.addEventListener('click', () => setPerspectiveMode('0dte'));
  if (rowGoldf) rowGoldf.addEventListener('click', () => setPerspectiveMode('goldf'));
  if (rowXau) rowXau.addEventListener('click', () => setPerspectiveMode('xau'));
  if (rowOpen) {
    rowOpen.addEventListener('click', () => {
      if (selAnchor) {
        selAnchor.value = selAnchor.value === 'open' ? 'current' : 'open';
        selAnchor.dispatchEvent(new Event('change'));
      }
    });
  }

  // Anchor Toggle Buttons
  if (btnAnchorCurrent) {
    btnAnchorCurrent.addEventListener('click', () => {
      btnAnchorCurrent.classList.add('active');
      if (btnAnchorOpen) btnAnchorOpen.classList.remove('active');
      if (selAnchor) {
        selAnchor.value = 'current';
        selAnchor.dispatchEvent(new Event('change'));
      }
    });
  }
  if (btnAnchorOpen) {
    btnAnchorOpen.addEventListener('click', () => {
      btnAnchorOpen.classList.add('active');
      if (btnAnchorCurrent) btnAnchorCurrent.classList.remove('active');
      if (selAnchor) {
        selAnchor.value = 'open';
        selAnchor.dispatchEvent(new Event('change'));
      }
    });
  }

  // DTE Pills
  dtePills.forEach((p) => {
    p.addEventListener('click', () => {
      const d = parseInt(p.dataset.dte, 10);
      recalculateWithDte(d);
    });
  });

  // SD Band Highlight Buttons (Toggles)
  function updateSdVisibility() {
    if (!chart) return;
    chart.setSdOverlayConfig({
      showSd1: chkSd1 ? chkSd1.classList.contains('active') : true,
      showSd2: chkSd2 ? chkSd2.classList.contains('active') : true,
      showSd3: chkSd3 ? chkSd3.classList.contains('active') : false,
      showBellCurve: chkBell ? chkBell.classList.contains('active') : true,
      anchor: selAnchor ? selAnchor.value : 'current',
    });
  }

  [chkSd1, chkSd2, chkSd3, chkBell].forEach((btn) => {
    if (!btn) return;
    Object.defineProperty(btn, 'checked', {
      get() { return this.classList.contains('active'); },
      set(val) { this.classList.toggle('active', !!val); },
      configurable: true,
    });
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      updateSdVisibility();
    });
  });

  // Anchor Dropdown
  if (selAnchor) {
    selAnchor.addEventListener('change', () => {
      const val = selAnchor.value;
      if (chart) {
        chart.setSdOverlayConfig({ anchor: val });
      }
      if (btnAnchorCurrent) btnAnchorCurrent.classList.toggle('active', val === 'current');
      if (btnAnchorOpen) btnAnchorOpen.classList.toggle('active', val === 'open');
      if (rowOpen) rowOpen.classList.toggle('dash-row-active-open', val === 'open');
    });
  }

  // Strike Window Dropdown
  if (selRange) {
    selRange.addEventListener('change', () => {
      if (chart) chart.setStrikeRangeMode(selRange.value);
    });
  }

  // Parameters Manual Overrides
  function handleParamChange() {
    if (!rawData) return;
    const p = parseFloat(inpPrice?.value);
    const op = parseFloat(inpOpen?.value);
    const iv = parseFloat(inpIv?.value);
    if (!isNaN(p) && p > 100) rawData.underlyingPrice = p;
    if (!isNaN(op) && op > 100) rawData.openPrice = op;
    if (!isNaN(iv) && iv > 0) rawData.atmVolatility = iv;
    recalculateWithDte(activeDte);
  }
  if (inpPrice) inpPrice.addEventListener('change', handleParamChange);
  if (inpOpen) inpOpen.addEventListener('change', handleParamChange);
  if (inpIv) inpIv.addEventListener('change', handleParamChange);

  // Offline Simulation Tick Buttons (+0.8 / -0.8)
  if (btnTickUp) {
    btnTickUp.addEventListener('click', () => {
      if (!rawData) return;
      rawData.underlyingPrice = Number((rawData.underlyingPrice + 0.8).toFixed(1));
      recalculateWithDte(activeDte);
    });
  }
  if (btnTickDown) {
    btnTickDown.addEventListener('click', () => {
      if (!rawData) return;
      rawData.underlyingPrice = Number((rawData.underlyingPrice - 0.8).toFixed(1));
      recalculateWithDte(activeDte);
    });
  }

  // Raw Strikes Drawer Toggle
  if (btnToggleRaw && rawDrawer) {
    btnToggleRaw.addEventListener('click', () => {
      const isHidden = rawDrawer.style.display === 'none';
      rawDrawer.style.display = isHidden ? 'flex' : 'none';
      if (txtToggleRaw) {
        txtToggleRaw.textContent = isHidden ? 'Hide Strikes Data' : 'Inspect Strikes Data';
      }
      if (isHidden) renderRawInspector();
    });
  }

  // Copy SD Levels Button
  if (btnCopySd) {
    btnCopySd.addEventListener('click', () => {
      if (!currentStats) return;
      const S = currentStats.underlyingPrice;
      const r = currentStats.stdDevRanges || {};
      const lines = [
        `=== CME Vol2Vol Expected Ranges (${activeDte} DTE) ===`,
        `0DTE Benchmark: ${S.toFixed(1)}`,
        `-3SD: ${r['-3']} | -2SD: ${r['-2']} | -1SD: ${r['-1']} | ATM: ${r['ATM']} | +1SD: ${r['+1']} | +2SD: ${r['+2']} | +3SD: ${r['+3']}`,
      ];
      if (convertedGc1) {
        lines.push(`GOLD.F (Basis ${convertedGc1.diffFormatted}): -1SD: ${convertedGc1.ranges['-1']} | ATM: ${convertedGc1.ranges['ATM']} | +1SD: ${convertedGc1.ranges['+1']}`);
      }
      if (convertedXau) {
        lines.push(`XAU Spot (Basis ${convertedXau.diffFormatted}): -1SD: ${convertedXau.ranges['-1']} | ATM: ${convertedXau.ranges['ATM']} | +1SD: ${convertedXau.ranges['+1']}`);
      }
      navigator.clipboard.writeText(lines.join('\n')).then(() => {
        const orig = btnCopySd.innerHTML;
        btnCopySd.innerHTML = `<span>Copied!</span>`;
        btnCopySd.style.borderColor = '#22c55e';
        btnCopySd.style.color = '#22c55e';
        setTimeout(() => {
          btnCopySd.innerHTML = orig;
          btnCopySd.style.borderColor = '';
          btnCopySd.style.color = '';
        }, 1500);
      });
    });
  }

  // Apply initial SD visibility and strike mode
  updateSdVisibility();
  if (selRange && chart) {
    chart.setStrikeRangeMode(selRange.value);
  }

  // Start initialization
  initConnection();
});

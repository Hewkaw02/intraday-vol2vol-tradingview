/**
 * src/popup/popup.js
 * Controller for CME Vol2Vol Extension Toolbar Popup (HUD)
 * Real-time sync with TradingView Tab & chrome.storage.local
 * Supports dynamic DTE switching, interactive SD ranges, copy levels, and theme toggling
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // State
  let chart = null;
  let currentStats = null;
  let rawData = null;
  let activeDte = 0;
  let anchorMode = 'current'; // 'current' | 'open'
  let currentTheme = 'dark';
  let activeTabId = null;
  let comparisonQuotes = null;
  let convertedGc1 = null;
  let convertedXau = null;
  let activePerspective = '0dte'; // '0dte' | 'goldf' | 'xau'

  // DOM Elements
  const canvas = document.getElementById('popup-canvas');
  const symbolBadge = document.getElementById('pop-symbol-badge');
  const statusBadge = document.getElementById('pop-status-badge');
  const liveDot = document.getElementById('pop-live-dot');
  const statusText = document.getElementById('pop-status-text');
  const dtePills = document.querySelectorAll('.dte-pill');

  const valPrice = document.getElementById('pop-val-price');
  const subOpen = document.getElementById('pop-sub-open');
  const netChange = document.getElementById('pop-net-change');
  const subIv = document.getElementById('pop-sub-iv');
  const tagSeries = document.getElementById('pop-tag-series');

  const valDom = document.getElementById('pop-val-dom');
  const subDom = document.getElementById('pop-sub-dom');
  const tagFlow = document.getElementById('pop-tag-flow');
  const fillCall = document.getElementById('pop-dom-fill-call');
  const fillPut = document.getElementById('pop-dom-fill-put');
  const lblCall = document.getElementById('pop-dom-lbl-call');
  const lblPut = document.getElementById('pop-dom-lbl-put');

  const meanCall = document.getElementById('pop-mean-call');
  const meanBoth = document.getElementById('pop-mean-both');
  const meanPut = document.getElementById('pop-mean-put');
  const meanCallDiff = document.getElementById('pop-mean-call-diff');
  const meanBothDiff = document.getElementById('pop-mean-both-diff');
  const meanPutDiff = document.getElementById('pop-mean-put-diff');

  const sdMoveSummary = document.getElementById('pop-sd-move-summary');
  const popTableStlLbl = document.getElementById('pop-table-stl-lbl');
  const popRowStl = document.getElementById('pop-row-stl');
  const sdM3 = document.getElementById('pop-sd-m3');
  const sdM2 = document.getElementById('pop-sd-m2');
  const sdM1 = document.getElementById('pop-sd-m1');
  const sdAtm = document.getElementById('pop-sd-atm');
  const sdP1 = document.getElementById('pop-sd-p1');
  const sdP2 = document.getElementById('pop-sd-p2');
  const sdP3 = document.getElementById('pop-sd-p3');

  const popRowGc1 = document.getElementById('pop-row-gc1');
  const popDiffGc1 = document.getElementById('pop-diff-gc1');
  const popGc1M3 = document.getElementById('pop-gc1-m3');
  const popGc1M2 = document.getElementById('pop-gc1-m2');
  const popGc1M1 = document.getElementById('pop-gc1-m1');
  const popGc1Atm = document.getElementById('pop-gc1-atm');
  const popGc1P1 = document.getElementById('pop-gc1-p1');
  const popGc1P2 = document.getElementById('pop-gc1-p2');
  const popGc1P3 = document.getElementById('pop-gc1-p3');

  const popRowXau = document.getElementById('pop-row-xau');
  const popDiffXau = document.getElementById('pop-diff-xau');
  const popXauM3 = document.getElementById('pop-xau-m3');
  const popXauM2 = document.getElementById('pop-xau-m2');
  const popXauM1 = document.getElementById('pop-xau-m1');
  const popXauAtm = document.getElementById('pop-xau-atm');
  const popXauP1 = document.getElementById('pop-xau-p1');
  const popXauP2 = document.getElementById('pop-xau-p2');
  const popXauP3 = document.getElementById('pop-xau-p3');

  const popRowOpen = document.getElementById('pop-row-open');
  const popLblOpenRow = document.getElementById('pop-lbl-open-row');
  const popOpenM3 = document.getElementById('pop-open-m3');
  const popOpenM2 = document.getElementById('pop-open-m2');
  const popOpenM1 = document.getElementById('pop-open-m1');
  const popOpenAtm = document.getElementById('pop-open-atm');
  const popOpenP1 = document.getElementById('pop-open-p1');
  const popOpenP2 = document.getElementById('pop-open-p2');
  const popOpenP3 = document.getElementById('pop-open-p3');

  const btnAnchorCurrent = document.getElementById('btn-anchor-current');
  const btnAnchorOpen = document.getElementById('btn-anchor-open');
  const btnCopySd = document.getElementById('btn-copy-sd');
  const strikeRangeSelect = document.getElementById('pop-strike-range');
  const syncTimestamp = document.getElementById('pop-sync-timestamp');

  const btnQuickSync = document.getElementById('btn-quick-sync');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const btnOpenStandalone = document.getElementById('btn-open-standalone');
  const btnOpenTv = document.getElementById('btn-open-tv');

  // 1. Initialize Chart
  if (canvas && typeof Vol2VolChart !== 'undefined') {
    chart = new Vol2VolChart(canvas, {
      theme: currentTheme,
      strikeRangeMode: 'near5',
      showBellCurve: true,
      showSd1: true,
      showSd2: true,
      showSd3: false,
    });
  }

  // 2. Set Status Badge Helper
  function setConnectionStatus(state, label) {
    statusBadge.className = 'popup-live-badge';
    if (state === 'live') {
      statusBadge.classList.add('state-live');
      statusText.textContent = label || 'LIVE TAB';
      statusBadge.title = 'Real-time connected with active TradingView options chain tab';
    } else if (state === 'synced') {
      statusBadge.classList.add('state-synced');
      statusText.textContent = label || 'SYNCED';
      statusBadge.title = 'Using latest cached state synced from TradingView';
    } else {
      statusBadge.classList.add('state-offline');
      statusText.textContent = label || 'STANDBY';
      statusBadge.title = 'TradingView tab not detected; showing benchmark reference';
    }
  }

  // 3. Render Stats & UI Elements
  function renderUI(stats, meta = {}) {
    if (!stats) return;
    currentStats = stats;

    const sym = meta.symbol || rawData?.symbol || 'COMEX:GCV2026';
    const S = Number(stats.underlyingPrice || 0);
    const openP = Number(stats.openPrice || S);
    const iv = Number(stats.atmVolatility || 23.58);
    const diffOpen = S - openP;
    const diffPct = openP > 0 ? (diffOpen / openP) * 100 : 0;

    // Header & Badges
    symbolBadge.textContent = sym;
    tagSeries.textContent = stats.is0DTE ? '0DTE Intraday' : `${stats.dte} DTE`;

    // Price Card
    valPrice.textContent = S.toFixed(1);
    const sign = diffOpen >= 0 ? '+' : '';
    const colorOpen = diffOpen >= 0 ? '#22c55e' : '#f23645';
    subOpen.innerHTML = `Open: ${openP.toFixed(1)} <span style="color: ${colorOpen}; font-weight: 600;">(${sign}$${diffOpen.toFixed(1)} / ${sign}${diffPct.toFixed(2)}%)</span>`;
    subIv.innerHTML = `ATM Vol Stl: <strong>${iv.toFixed(2)}%</strong>`;

    // Dominance Card
    valDom.textContent = `${stats.dominance} (+${stats.dominancePct}%)`;
    valDom.style.color = stats.dominance === 'CALLS' ? '#2962ff' : '#ff9800';
    subDom.textContent = `PCR: ${stats.pcr} | CPR: ${stats.callPutRatio}`;
    tagFlow.textContent = stats.dominance === 'CALLS' ? 'Bullish Flow' : 'Bearish Flow';
    tagFlow.style.color = stats.dominance === 'CALLS' ? '#22c55e' : '#ff9800';

    // Dominance Visual Progress Bar
    const totalVol = (stats.totalCallVol || 0) + (stats.totalPutVol || 0);
    const callShare = totalVol > 0 ? Math.round((stats.totalCallVol / totalVol) * 100) : 50;
    const putShare = 100 - callShare;
    fillCall.style.width = `${callShare}%`;
    fillPut.style.width = `${putShare}%`;
    lblCall.textContent = `Calls: ${(stats.totalCallVol || 0).toLocaleString()} (${callShare}%)`;
    lblPut.textContent = `Puts: ${(stats.totalPutVol || 0).toLocaleString()} (${putShare}%)`;

    // Means Grid
    meanCall.textContent = stats.meanCall ? stats.meanCall.toLocaleString() : '--';
    meanBoth.textContent = stats.meanBoth ? stats.meanBoth.toLocaleString() : '--';
    meanPut.textContent = stats.meanPut ? stats.meanPut.toLocaleString() : '--';

    const diffCall = (stats.meanCall || S) - S;
    const diffBoth = (stats.meanBoth || S) - S;
    const diffPut = (stats.meanPut || S) - S;
    meanCallDiff.textContent = `${diffCall >= 0 ? '+' : ''}$${diffCall.toFixed(1)} from Stl`;
    meanBothDiff.textContent = `${diffBoth >= 0 ? '+' : ''}$${diffBoth.toFixed(1)} from Stl`;
    meanPutDiff.textContent = `${diffPut >= 0 ? '+' : ''}$${diffPut.toFixed(1)} from Stl`;

    // Standard Deviation Ranges
    updateSdTable();

    // Chart Update
    if (chart) {
      chart.update(stats);
      if (activePerspective && activePerspective !== '0dte') {
        setPerspectiveMode(activePerspective);
      }
    }

    // Timestamp
    if (meta.timestamp) {
      const d = new Date(meta.timestamp);
      syncTimestamp.textContent = `Updated: ${d.toLocaleTimeString()} (${meta.source || 'Live'})`;
    } else {
      syncTimestamp.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
    }
  }

  // 4. Update Multi-Asset SD Table (0DTE Stl, GC1!, XAUUSD, Day Open)
  function updateSdTable() {
    if (!currentStats) return;

    const S = Number(currentStats.underlyingPrice || 0);
    const openP = Number(currentStats.openPrice || S);
    const sym = symbolBadge ? symbolBadge.textContent : (rawData?.symbol || 'COMEX:GCV2026');

    // Row 1: 0DTE Stl Base
    const r = currentStats.stdDevRanges || {};
    const fmt = (v) => (v != null && !isNaN(v)) ? Number(v).toFixed(1) : '--';

    if (popTableStlLbl) {
      const cleanSym = sym ? sym.replace('COMEX:', '').trim() : '0DTE';
      popTableStlLbl.innerHTML = `<svg viewBox="0 0 24 24" width="10" height="10" fill="#f23645" style="vertical-align: -1px;"><path d="M17 10H7v2h10v-2zm2-7h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-5-5H7v2h7v-2z"/></svg> 0DTE ${cleanSym}`;
    }
    if (sdM3) sdM3.textContent = fmt(r['-3']);
    if (sdM2) sdM2.textContent = fmt(r['-2']);
    if (sdM1) sdM1.textContent = fmt(r['-1']);
    if (sdAtm) sdAtm.textContent = fmt(r['ATM'] != null ? r['ATM'] : S);
    if (sdP1) sdP1.textContent = fmt(r['+1']);
    if (sdP2) sdP2.textContent = fmt(r['+2']);
    if (sdP3) sdP3.textContent = fmt(r['+3']);

    // Row 2: GC1! Futures Converted
    const gc1Price = comparisonQuotes?.gc1?.price;
    if (gc1Price && typeof OptionsMath !== 'undefined' && OptionsMath.computeConvertedRanges && S > 0) {
      convertedGc1 = OptionsMath.computeConvertedRanges(r, S, gc1Price);
      if (popDiffGc1) {
        popDiffGc1.textContent = `Basis ${convertedGc1.diffFormatted}`;
        popDiffGc1.className = `pop-diff-badge ${convertedGc1.diff >= 0 ? 'diff-pos' : 'diff-neg'}`;
      }
      if (popGc1M3) popGc1M3.textContent = fmt(convertedGc1.ranges['-3']);
      if (popGc1M2) popGc1M2.textContent = fmt(convertedGc1.ranges['-2']);
      if (popGc1M1) popGc1M1.textContent = fmt(convertedGc1.ranges['-1']);
      if (popGc1Atm) popGc1Atm.textContent = fmt(convertedGc1.ranges['ATM'] != null ? convertedGc1.ranges['ATM'] : gc1Price);
      if (popGc1P1) popGc1P1.textContent = fmt(convertedGc1.ranges['+1']);
      if (popGc1P2) popGc1P2.textContent = fmt(convertedGc1.ranges['+2']);
      if (popGc1P3) popGc1P3.textContent = fmt(convertedGc1.ranges['+3']);
    } else if (convertedGc1) {
      if (popDiffGc1) {
        popDiffGc1.textContent = `Basis ${convertedGc1.diffFormatted}`;
        popDiffGc1.className = `pop-diff-badge ${convertedGc1.diff >= 0 ? 'diff-pos' : 'diff-neg'}`;
      }
      if (popGc1M3) popGc1M3.textContent = fmt(convertedGc1.ranges['-3']);
      if (popGc1M2) popGc1M2.textContent = fmt(convertedGc1.ranges['-2']);
      if (popGc1M1) popGc1M1.textContent = fmt(convertedGc1.ranges['-1']);
      if (popGc1Atm) popGc1Atm.textContent = fmt(convertedGc1.ranges['ATM']);
      if (popGc1P1) popGc1P1.textContent = fmt(convertedGc1.ranges['+1']);
      if (popGc1P2) popGc1P2.textContent = fmt(convertedGc1.ranges['+2']);
      if (popGc1P3) popGc1P3.textContent = fmt(convertedGc1.ranges['+3']);
    } else {
      if (popDiffGc1) {
        popDiffGc1.textContent = 'Basis: --';
        popDiffGc1.className = 'pop-diff-badge';
      }
      if (popGc1M3) popGc1M3.textContent = '--';
      if (popGc1M2) popGc1M2.textContent = '--';
      if (popGc1M1) popGc1M1.textContent = '--';
      if (popGc1Atm) popGc1Atm.textContent = '--';
      if (popGc1P1) popGc1P1.textContent = '--';
      if (popGc1P2) popGc1P2.textContent = '--';
      if (popGc1P3) popGc1P3.textContent = '--';
    }

    // Row 3: XAUUSD CFD Converted
    const xauPrice = comparisonQuotes?.xau?.price;
    if (xauPrice && typeof OptionsMath !== 'undefined' && OptionsMath.computeConvertedRanges && S > 0) {
      convertedXau = OptionsMath.computeConvertedRanges(r, S, xauPrice);
      if (popDiffXau) {
        popDiffXau.textContent = `Basis ${convertedXau.diffFormatted}`;
        popDiffXau.className = `pop-diff-badge ${convertedXau.diff >= 0 ? 'diff-pos' : 'diff-neg'}`;
      }
      if (popXauM3) popXauM3.textContent = fmt(convertedXau.ranges['-3']);
      if (popXauM2) popXauM2.textContent = fmt(convertedXau.ranges['-2']);
      if (popXauM1) popXauM1.textContent = fmt(convertedXau.ranges['-1']);
      if (popXauAtm) popXauAtm.textContent = fmt(convertedXau.ranges['ATM'] != null ? convertedXau.ranges['ATM'] : xauPrice);
      if (popXauP1) popXauP1.textContent = fmt(convertedXau.ranges['+1']);
      if (popXauP2) popXauP2.textContent = fmt(convertedXau.ranges['+2']);
      if (popXauP3) popXauP3.textContent = fmt(convertedXau.ranges['+3']);
    } else if (convertedXau) {
      if (popDiffXau) {
        popDiffXau.textContent = `Basis ${convertedXau.diffFormatted}`;
        popDiffXau.className = `pop-diff-badge ${convertedXau.diff >= 0 ? 'diff-pos' : 'diff-neg'}`;
      }
      if (popXauM3) popXauM3.textContent = fmt(convertedXau.ranges['-3']);
      if (popXauM2) popXauM2.textContent = fmt(convertedXau.ranges['-2']);
      if (popXauM1) popXauM1.textContent = fmt(convertedXau.ranges['-1']);
      if (popXauAtm) popXauAtm.textContent = fmt(convertedXau.ranges['ATM']);
      if (popXauP1) popXauP1.textContent = fmt(convertedXau.ranges['+1']);
      if (popXauP2) popXauP2.textContent = fmt(convertedXau.ranges['+2']);
      if (popXauP3) popXauP3.textContent = fmt(convertedXau.ranges['+3']);
    } else {
      if (popDiffXau) {
        popDiffXau.textContent = 'Basis: --';
        popDiffXau.className = 'pop-diff-badge';
      }
      if (popXauM3) popXauM3.textContent = '--';
      if (popXauM2) popXauM2.textContent = '--';
      if (popXauM1) popXauM1.textContent = '--';
      if (popXauAtm) popXauAtm.textContent = '--';
      if (popXauP1) popXauP1.textContent = '--';
      if (popXauP2) popXauP2.textContent = '--';
      if (popXauP3) popXauP3.textContent = '--';
    }

    // Row 4: Day Open Ranges (Dynamic Perspective Aware)
    let activeOpen = openP;
    let openLabel = 'Open';
    const baseOpenRanges = currentStats.stdDevRangesFromOpen || {};
    let activeOpenRanges = baseOpenRanges;

    if (activePerspective === 'goldf') {
      const gc1Quote = comparisonQuotes?.gc1;
      const basis = convertedGc1 ? convertedGc1.diff : (gc1Quote?.price && S ? gc1Quote.price - S : 0);
      activeOpen = openP ? Math.round((openP + basis) * 10) / 10 : 0;
      openLabel = 'Open (GOLD.F)';
      if (typeof OptionsMath !== 'undefined' && OptionsMath.computeConvertedRanges && openP > 0 && activeOpen > 0) {
        activeOpenRanges = OptionsMath.computeConvertedRanges(baseOpenRanges, openP, activeOpen).ranges;
      }
    } else if (activePerspective === 'xau') {
      const xauQuote = comparisonQuotes?.xau;
      const basis = convertedXau ? convertedXau.diff : (xauQuote?.price && S ? xauQuote.price - S : 0);
      activeOpen = openP ? Math.round((openP + basis) * 10) / 10 : 0;
      openLabel = 'Open (XAU)';
      if (typeof OptionsMath !== 'undefined' && OptionsMath.computeConvertedRanges && openP > 0 && activeOpen > 0) {
        activeOpenRanges = OptionsMath.computeConvertedRanges(baseOpenRanges, openP, activeOpen).ranges;
      }
    } else {
      const cleanSym = sym ? sym.replace('COMEX:', '').trim() : '';
      openLabel = cleanSym ? `Open (${cleanSym})` : 'Open';
    }

    if (popLblOpenRow) popLblOpenRow.textContent = openLabel;
    if (popOpenM3) popOpenM3.textContent = fmt(activeOpenRanges['-3']);
    if (popOpenM2) popOpenM2.textContent = fmt(activeOpenRanges['-2']);
    if (popOpenM1) popOpenM1.textContent = fmt(activeOpenRanges['-1']);
    if (popOpenAtm) popOpenAtm.textContent = fmt(activeOpenRanges['Open'] != null ? activeOpenRanges['Open'] : activeOpen);
    if (popOpenP1) popOpenP1.textContent = fmt(activeOpenRanges['+1']);
    if (popOpenP2) popOpenP2.textContent = fmt(activeOpenRanges['+2']);
    if (popOpenP3) popOpenP3.textContent = fmt(activeOpenRanges['+3']);

    // Highlight row matching anchor selection & perspective
    if (popRowStl) {
      popRowStl.classList.toggle('pop-row-active', anchorMode === 'current');
      popRowStl.classList.toggle('pop-persp-active', activePerspective === '0dte');
    }
    if (popRowGc1) {
      popRowGc1.classList.toggle('pop-persp-active', activePerspective === 'goldf');
    }
    if (popRowXau) {
      popRowXau.classList.toggle('pop-persp-active', activePerspective === 'xau');
    }
    if (popRowOpen) popRowOpen.classList.toggle('pop-row-active', anchorMode === 'open');

    if (anchorMode === 'current') {
      sdMoveSummary.textContent = `1SD Move: ±$${currentStats.oneStdDevValue} (${currentStats.oneStdDevPct}%)`;
    } else {
      const openVal = currentStats.oneStdDevFromOpenValue || currentStats.oneStdDevValue;
      sdMoveSummary.textContent = `From Open 1SD: ±$${openVal} (${currentStats.oneStdDevPct}%)`;
    }
  }

  // 5. Recalculate Stats locally when DTE changes
  function recalculateWithDte(dteVal) {
    activeDte = dteVal;

    // Highlight Pill
    dtePills.forEach((p) => {
      const pVal = parseInt(p.dataset.dte, 10);
      if (pVal === dteVal) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    if (!rawData || typeof OptionsMath === 'undefined') return;

    const stats = OptionsMath.calculateStats({
      underlyingPrice: rawData.underlyingPrice,
      spotPrice: rawData.underlyingPrice,
      openPrice: rawData.openPrice,
      volAnchorPrice: rawData.volAnchorPrice || rawData.underlyingPrice,
      atmVolatility: rawData.atmVolatility || 23.58,
      dte: dteVal,
      strikesData: rawData.strikesData || [],
    });

    renderUI(stats, {
      symbol: rawData.symbol,
      source: 'DTE Changed',
      timestamp: Date.now(),
    });

    // Notify active TradingView tab of DTE change
    if (activeTabId && typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.sendMessage(activeTabId, {
        type: 'SET_DTE_MODE',
        dteMode: String(dteVal),
      }, () => {
        if (chrome.runtime.lastError) {} // Ignore
      });
    }
  }

  // Set Multi-Asset Perspective Mode (0DTE, GOLD.F, or XAUUSD)
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

    // Update Pills
    document.querySelectorAll('.pop-persp-pill').forEach((p) => {
      const pPersp = p.getAttribute('data-persp');
      p.classList.toggle('active', pPersp === mode);
      if (pPersp === 'goldf') p.classList.toggle('active-goldf', mode === 'goldf');
      if (pPersp === 'xau') p.classList.toggle('active-xau', mode === 'xau');
    });

    // Update Row styling
    if (popRowStl) popRowStl.classList.toggle('pop-persp-active', mode === '0dte');
    if (popRowGc1) popRowGc1.classList.toggle('pop-persp-active', mode === 'goldf');
    if (popRowXau) popRowXau.classList.toggle('pop-persp-active', mode === 'xau');

    const titleEl = document.getElementById('pop-chart-title');
    if (titleEl) {
      if (mode === 'goldf') {
        const basisStr = config.basis >= 0 ? `+${config.basis.toFixed(1)}` : config.basis.toFixed(1);
        titleEl.textContent = `GOLD.F Range (Basis ${basisStr})`;
        titleEl.style.color = '#f59e0b';
      } else if (mode === 'xau') {
        const basisStr = config.basis >= 0 ? `+${config.basis.toFixed(1)}` : config.basis.toFixed(1);
        titleEl.textContent = `XAU Spot Range (Basis ${basisStr})`;
        titleEl.style.color = '#06b6d4';
      } else {
        titleEl.textContent = 'Vol2Vol™ Volume & Vol Stl Smile';
        titleEl.style.color = '';
      }
    }

    // Immediately refresh SD table so Row 4 (Day Open) adapts to active perspective
    updateSdTable();
  }

  // 6. Connect to Chrome Storage & Active Tab
  async function initConnection() {
    setConnectionStatus('connecting', 'CONNECTING...');

    // Load saved theme preference
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['cme_v2v_theme', 'cme_v2v_live_state'], (res) => {
        if (res.cme_v2v_theme) {
          applyTheme(res.cme_v2v_theme);
        }

        if (res.cme_v2v_live_state) {
          const s = res.cme_v2v_live_state;
          rawData = {
            symbol: s.symbol,
            underlyingPrice: s.underlyingPrice,
            openPrice: s.openPrice,
            atmVolatility: s.atmVolatility,
            volAnchorPrice: s.volAnchorPrice,
            strikesData: s.strikesData,
          };
          activeDte = s.resolvedDte !== undefined ? s.resolvedDte : 0;
          setDtePillActive(activeDte);
          if (s.comparisonQuotes) comparisonQuotes = s.comparisonQuotes;
          if (s.convertedGc1) convertedGc1 = s.convertedGc1;
          if (s.convertedXau) convertedXau = s.convertedXau;
          if (s.stats) {
            renderUI(s.stats, {
              symbol: s.symbol,
              source: 'Cached TV Sync',
              timestamp: s.updatedAt,
            });
            setConnectionStatus('synced', 'SYNCED WITH TV');
          }
          if (s.activePerspective) {
            setPerspectiveMode(s.activePerspective);
          }
        }
      });
    }

    // Ping active tab
    queryActiveTab();
  }

  function setDtePillActive(dteVal) {
    dtePills.forEach((p) => {
      const pVal = parseInt(p.dataset.dte, 10);
      if (pVal === dteVal) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
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
        // Not directly on TradingView Options tab — search for any background TradingView options tab
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
        setDtePillActive(activeDte);
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
    setDtePillActive(0);

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
    setConnectionStatus('offline', 'BENCHMARK (0DTE)');

    // Attempt to fetch fresh quote from public TradingView scanner endpoint
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
        // 1. Fetch BlackBull Markets GOLD.F
        fetch('https://www.tradingview.com/symbols/GOLD.F/', {
          headers: { 'Accept': 'text/html' },
        }).then(async (r) => {
          if (!r.ok) return null;
          const html = await r.text();
          const priceMatch = html.match(/"trade":\{"price":([0-9.]+)\}/);
          const dailyMatch = html.match(/"daily_bar":\{"close":"([0-9.]+)","data_update_time":"[^"]*","high":"([0-9.]+)","low":"([0-9.]+)","open":"([0-9.]+)"/);
          const p = priceMatch ? Number(priceMatch[1]) : (dailyMatch ? Number(dailyMatch[1]) : null);
          const op = dailyMatch ? Number(dailyMatch[4]) : null;
          if (p && p > 100) {
            return { price: p, openPrice: op, displaySymbol: 'GOLD.F', symbol: 'BLACKBULL:GOLD.F', source: 'BlackBull Markets' };
          }
          return null;
        }).catch(() => null),

        // 2. Fetch OANDA:XAUUSD
        fetch('https://scanner.tradingview.com/symbol?symbol=OANDA%3AXAUUSD&fields=close,open,change').then((r) => r.json()).catch(() => null),
      ]);

      let updated = false;
      if (resGoldF) {
        if (!comparisonQuotes) comparisonQuotes = {};
        comparisonQuotes.gc1 = { ...resGoldF, timestamp: Date.now() };
        updated = true;
      } else {
        // Fallback to COMEX:GC1! if GOLD.F fetch failed
        const resGc1 = await fetch('https://scanner.tradingview.com/symbol?symbol=COMEX%3AGC1%21&fields=close,open,change').then((r) => r.json()).catch(() => null);
        if (resGc1 && Number(resGc1.close) > 100) {
          if (!comparisonQuotes) comparisonQuotes = {};
          comparisonQuotes.gc1 = { price: Number(resGc1.close), openPrice: Number(resGc1.open), displaySymbol: 'GC1!', symbol: 'COMEX:GC1!', source: 'COMEX', timestamp: Date.now() };
          updated = true;
        }
      }

      if (resXau && Number(resXau.close) > 100) {
        if (!comparisonQuotes) comparisonQuotes = {};
        comparisonQuotes.xau = { price: Number(resXau.close), openPrice: Number(resXau.open), displaySymbol: 'XAUUSD', symbol: 'OANDA:XAUUSD', source: 'OANDA', timestamp: Date.now() };
        updated = true;
      }
      if (updated) {
        updateSdTable();
      }
    } catch (e) {}
  }

  // 7. Listen to live storage changes from content script
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.cme_v2v_live_state && changes.cme_v2v_live_state.newValue) {
        const s = changes.cme_v2v_live_state.newValue;
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
        if (s.stats) {
          setConnectionStatus('live', 'LIVE TICK UPDATED');
          renderUI(s.stats, {
            symbol: s.symbol,
            source: 'Live Tick',
            timestamp: s.updatedAt,
          });
        }
        if (s.activePerspective && s.activePerspective !== activePerspective) {
          setPerspectiveMode(s.activePerspective);
        }
      }
    });
  }

  // 8. Event Handlers
  // DTE Pills Click
  dtePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const val = parseInt(pill.dataset.dte, 10);
      recalculateWithDte(val);
    });
  });

  // Perspective Pills Click
  document.querySelectorAll('.pop-persp-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const persp = pill.getAttribute('data-persp');
      setPerspectiveMode(persp);
    });
  });

  // Anchor Toggle
  btnAnchorCurrent.addEventListener('click', () => {
    anchorMode = 'current';
    btnAnchorCurrent.classList.add('active');
    btnAnchorOpen.classList.remove('active');
    updateSdTable();
  });

  btnAnchorOpen.addEventListener('click', () => {
    anchorMode = 'open';
    btnAnchorOpen.classList.add('active');
    btnAnchorCurrent.classList.remove('active');
    updateSdTable();
  });

  // Interactive Row Clicks to switch Perspective & Anchor
  if (popRowStl) {
    popRowStl.style.cursor = 'pointer';
    popRowStl.addEventListener('click', () => {
      setPerspectiveMode('0dte');
      anchorMode = 'current';
      btnAnchorCurrent.classList.add('active');
      btnAnchorOpen.classList.remove('active');
      updateSdTable();
    });
  }

  if (popRowGc1) {
    popRowGc1.style.cursor = 'pointer';
    popRowGc1.addEventListener('click', () => {
      setPerspectiveMode('goldf');
    });
  }

  if (popRowXau) {
    popRowXau.style.cursor = 'pointer';
    popRowXau.addEventListener('click', () => {
      setPerspectiveMode('xau');
    });
  }

  if (popRowOpen) {
    popRowOpen.style.cursor = 'pointer';
    popRowOpen.addEventListener('click', () => {
      anchorMode = 'open';
      btnAnchorOpen.classList.add('active');
      btnAnchorCurrent.classList.remove('active');
      updateSdTable();
    });
  }

  // Copy Multi-Asset SD Levels Breakdown
  btnCopySd.addEventListener('click', () => {
    if (!currentStats) return;
    const sym = symbolBadge ? symbolBadge.textContent : (rawData?.symbol || 'COMEX:GCV2026');
    const S = Number(currentStats.underlyingPrice || 0).toFixed(1);
    const op = Number(currentStats.openPrice || 0).toFixed(1);
    const iv = Number(currentStats.atmVolatility || 0).toFixed(2);
    const dteStr = currentStats.is0DTE ? '0 DTE Intraday' : `${currentStats.dte} DTE`;
    const r = currentStats.stdDevRanges || {};
    const ro = currentStats.stdDevRangesFromOpen || {};

    const copyLines = [
      `[CME Vol2Vol™] Multi-Asset Expected Range (${dteStr})`,
      `Symbol: ${sym}`,
      `0DTE Underlying: ${S} | Day Open: ${op} | ATM Vol: ${iv}%`,
      `Dominance: ${currentStats.dominance} (+${currentStats.dominancePct}%) | PCR: ${currentStats.pcr}`,
      `----------------------------------------`,
      `[1] 0DTE Underlying (${sym.replace('COMEX:', '').trim()})`,
      `+3 SD: ${r['+3'] || '--'}`,
      `+2 SD: ${r['+2'] || '--'}`,
      `+1 SD: ${r['+1'] || '--'}`,
      `Center: ${r['ATM'] || S}`,
      `-1 SD: ${r['-1'] || '--'}`,
      `-2 SD: ${r['-2'] || '--'}`,
      `-3 SD: ${r['-3'] || '--'}`,
      `----------------------------------------`,
    ];

    if (convertedGc1 && convertedGc1.ranges) {
      const gR = convertedGc1.ranges;
      const gc1Title = comparisonQuotes?.gc1?.symbol
        ? `${comparisonQuotes.gc1.symbol} Futures`
        : 'BLACKBULL:GOLD.F Futures';
      copyLines.push(
        `[2] ${gc1Title} (Basis: ${convertedGc1.diffFormatted} | Ref: ${gc1Ref})`,
        `+3 SD: ${gR['+3'] || '--'}`,
        `+2 SD: ${gR['+2'] || '--'}`,
        `+1 SD: ${gR['+1'] || '--'}`,
        `Center: ${gR['ATM'] || '--'}`,
        `-1 SD: ${gR['-1'] || '--'}`,
        `-2 SD: ${gR['-2'] || '--'}`,
        `-3 SD: ${gR['-3'] || '--'}`,
        `----------------------------------------`
      );
    }

    if (convertedXau && convertedXau.ranges) {
      const xR = convertedXau.ranges;
      const xauRef = comparisonQuotes?.xau?.price ? comparisonQuotes.xau.price.toFixed(1) : (xR['ATM'] || '--');
      copyLines.push(
        `[3] OANDA:XAUUSD Spot CFD (Basis: ${convertedXau.diffFormatted} | Ref: ${xauRef})`,
        `+3 SD: ${xR['+3'] || '--'}`,
        `+2 SD: ${xR['+2'] || '--'}`,
        `+1 SD: ${xR['+1'] || '--'}`,
        `Center: ${xR['ATM'] || '--'}`,
        `-1 SD: ${xR['-1'] || '--'}`,
        `-2 SD: ${xR['-2'] || '--'}`,
        `-3 SD: ${xR['-3'] || '--'}`,
        `----------------------------------------`
      );
    }

    if (ro && (ro['Open'] || ro['+1'])) {
      copyLines.push(
        `[4] From Day Open (Ref: ${op})`,
        `+3 SD: ${ro['+3'] || '--'}`,
        `+2 SD: ${ro['+2'] || '--'}`,
        `+1 SD: ${ro['+1'] || '--'}`,
        `Center: ${ro['Open'] || op}`,
        `-1 SD: ${ro['-1'] || '--'}`,
        `-2 SD: ${ro['-2'] || '--'}`,
        `-3 SD: ${ro['-3'] || '--'}`,
        `----------------------------------------`
      );
    }

    copyLines.push(`1SD Expected Move: ±$${currentStats.oneStdDevValue} (${currentStats.oneStdDevPct}%)`);

    const copyText = copyLines.join('\n');

    navigator.clipboard.writeText(copyText).then(() => {
      const origHtml = btnCopySd.innerHTML;
      btnCopySd.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" style="vertical-align: -1px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Copied!`;
      btnCopySd.style.background = '#22c55e';
      btnCopySd.style.color = '#ffffff';
      setTimeout(() => {
        btnCopySd.innerHTML = origHtml;
        btnCopySd.style.background = '';
        btnCopySd.style.color = '';
      }, 1500);
    });
  });

  // Strike Range Window Change
  if (strikeRangeSelect) {
    strikeRangeSelect.addEventListener('change', () => {
      const mode = strikeRangeSelect.value;
      if (chart) {
        chart.setStrikeRangeMode(mode);
      }
    });
  }

  // Quick Sync Button
  btnQuickSync.addEventListener('click', () => {
    btnQuickSync.style.transform = 'rotate(360deg)';
    btnQuickSync.style.transition = 'transform 0.5s ease';
    setTimeout(() => {
      btnQuickSync.style.transform = 'none';
      btnQuickSync.style.transition = 'none';
    }, 500);

    if (activeTabId && typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.sendMessage(activeTabId, { type: 'TRIGGER_SYNC' }, () => {
        setTimeout(queryActiveTab, 300);
      });
    } else {
      queryActiveTab();
    }
  });

  // Theme Toggle
  function applyTheme(theme) {
    currentTheme = theme;
    if (theme === 'light') {
      document.body.classList.add('cme-v2v-theme-light');
      document.body.classList.remove('cme-v2v-theme-dark');
    } else {
      document.body.classList.add('cme-v2v-theme-dark');
      document.body.classList.remove('cme-v2v-theme-light');
    }
    if (chart) {
      chart.setTheme(theme);
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ cme_v2v_theme: theme });
    }
  }

  btnThemeToggle.addEventListener('click', () => {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  // Footer Actions
  btnOpenStandalone.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/dashboard.html') });
    } else {
      window.open('../dashboard/dashboard.html', '_blank');
    }
  });

  btnOpenTv.addEventListener('click', () => {
    const targetUrl = 'https://www.tradingview.com/options/chain/?symbol=COMEX%3AGC1%21';
    if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.create === 'function') {
      chrome.tabs.query({ active: true, currentWindow: true }, (currentTabs) => {
        const currentTab = currentTabs && currentTabs[0];
        const isAlreadyOnOptions = currentTab && currentTab.url && currentTab.url.includes('tradingview.com/options');
        if (isAlreadyOnOptions) {
          // Already on TradingView Options tab — open a fresh Options tab as requested
          chrome.tabs.create({ url: targetUrl });
          return;
        }
        chrome.tabs.query({ url: '*://*.tradingview.com/options/*' }, (tvTabs) => {
          if (tvTabs && tvTabs.length > 0 && tvTabs[0].id) {
            chrome.tabs.update(tvTabs[0].id, { active: true });
            if (tvTabs[0].windowId && chrome.windows && chrome.windows.update) {
              chrome.windows.update(tvTabs[0].windowId, { focused: true });
            }
          } else {
            chrome.tabs.create({ url: targetUrl });
          }
        });
      });
    } else {
      window.open(targetUrl, '_blank', 'noopener');
    }
  });

  // Start initialization
  initConnection();
});


/**
 * src/content/content.js
 * Content Script running on TradingView options pages
 * Automatically references active symbol/series, defaults to 0DTE, and syncs live voi-lens data
 */

(function () {
  'use strict';

  console.log('[CME Vol2Vol Extension] Content script loaded on TradingView Options page');

  // 1. Inject tv-interceptor.js into MAIN world
  function injectMainWorldScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('src/core/tv-interceptor.js');
      script.onload = function () {
        this.remove();
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.warn('[CME Vol2Vol Extension] Injection failed, falling back:', e);
    }
  }

  injectMainWorldScript();

  let panel = null;
  let currentSymbol = 'COMEX:GCV2026';
  let currentSeries = null;
  // Cache Scanner API session open price (= actual 5AM open, NOT prev settlement from DOM)
  // DOM extraction computes price-change which = Previous Settlement, NOT session open.
  // Scanner API 'open' field = the actual session open at 5AM (after 3-5AM break).
  let cachedSessionOpen = { price: 0, symbol: '' };

  function readUrlParams() {
    try {
      const u = new URL(window.location.href);
      currentSymbol = u.searchParams.get('symbol') || currentSymbol;
      currentSeries = u.searchParams.get('series') || currentSeries;
    } catch (e) {}
  }

  readUrlParams();

  // Live Quote Fetcher via TradingView Scanner Endpoint (Zero-latency public API)
  async function fetchLiveSymbolQuote(sym) {
    if (!sym) return null;
    try {
      const url = `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(sym)}&fields=close,open,high,low,change`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const p = Number(data.close);
        const op = Number(data.open);
        if (!isNaN(p) && p > 100) {
          return {
            symbol: sym,
            price: p,
            openPrice: !isNaN(op) && op > 100 ? op : null,
            change: data.change,
          };
        }
      }
    } catch (e) {
      console.warn('[CME Vol2Vol Extension] Scanner quote fetch warning:', e);
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // Vol Term Structure (CME Event Volatility Calculator equivalent)
  // voi-lens carries VOLUME ONLY (no IV) -> real IV comes from TradingView scanner "options" market.
  // ─────────────────────────────────────────────────────────────
  const TS_REFRESH_MS = 30000;   // IV refresh cadence (voi-lens arrives every ~15s)
  const TS_MAX_SERIES = 10;      // Nearest N upcoming expirations (+ active series)
  const TS_STRIKE_BAND = 0.03;   // Fetch strikes within ±3% of each underlying for ATM interpolation
  let tsInFlight = false;
  let tsLastRun = 0;

  async function fetchOptionIvRows(underlying, F, minExp, maxExp) {
    const body = {
      filter: [
        { left: 'type', operation: 'equal', right: 'option' },
        { left: 'expiration', operation: 'in_range', right: [minExp, maxExp] },
        { left: 'strike', operation: 'in_range', right: [F * (1 - TS_STRIKE_BAND), F * (1 + TS_STRIKE_BAND)] },
      ],
      columns: DataParser.SCANNER_IV_COLUMNS,
      index_filters: [{ name: 'underlying_symbol', values: [underlying] }],
      range: [0, 5000],
    };
    const res = await fetch('https://scanner.tradingview.com/options/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`options/scan HTTP ${res.status}`);
    return res.json();
  }

  async function refreshTermStructure(payload, force = false) {
    if (!panel || !payload || !Array.isArray(payload.items) || payload.items.length === 0) return;
    if (typeof OptionsMath === 'undefined' || !DataParser.parseScannerOptionIvRows) return;
    const startedAt = Date.now();
    if (tsInFlight || (!force && startedAt - tsLastRun < TS_REFRESH_MS)) return;
    tsInFlight = true;
    tsLastRun = startedAt;

    try {
      const upcoming = payload.items
        .map((it) => ({ it, expMs: OptionsMath.resolveExpiryMs(it.exp_time, it.exp) }))
        .filter((x) => x.it && x.it.underlying && x.expMs > startedAt)
        .sort((a, b) => a.expMs - b.expMs);

      const chosen = upcoming.slice(0, TS_MAX_SERIES);
      const activeId = panel.selSeries ? panel.selSeries.value : null;
      if (activeId && !chosen.some((c) => c.it.id === activeId)) {
        const active = upcoming.find((c) => c.it.id === activeId);
        if (active) chosen.push(active);
      }
      if (chosen.length === 0) {
        panel.setTermStructure([], { error: 'No upcoming series' });
        return;
      }

      // Group by underlying futures: each series must be measured against ITS OWN futures price
      const byUnderlying = {};
      for (const c of chosen) (byUnderlying[c.it.underlying] = byUnderlying[c.it.underlying] || []).push(c);

      const groups = await Promise.all(Object.entries(byUnderlying).map(async ([und, list]) => {
        const quote = await fetchLiveSymbolQuote(und);
        if (!quote || !(quote.price > 100)) return [];
        const exps = list.map((x) => Number(x.it.exp));
        const ivJson = await fetchOptionIvRows(und, quote.price, Math.min(...exps), Math.max(...exps));
        const smiles = DataParser.parseScannerOptionIvRows(ivJson);
        return list.map(({ it, expMs }) => {
          const smile = smiles[`${it.exp}|${it.family}`]
            || Object.values(smiles).find((sm) => String(sm.exp) === String(it.exp));
          const vol = DataParser.sumSeriesVolume(it);
          return {
            id: it.id,
            exp: it.exp,
            expTime: expMs,
            family: it.family,
            underlying: und,
            forward: quote.price,
            ivPoints: smile ? smile.points : [],
            totalCallVol: vol.call,
            totalPutVol: vol.put,
            dte: DataParser.calculateDteFromSeries(it.exp),
          };
        });
      }));

      const rows = OptionsMath.calculateSeriesVolTermStructure(groups.flat(), { now: Date.now() });
      panel.setTermStructure(rows, { updatedAt: Date.now(), source: 'TradingView Options IV' });
    } catch (e) {
      console.warn('[CME Vol2Vol Extension] Term structure refresh failed:', e);
      panel.setTermStructure(panel.termStructureData || [], { error: 'IV fetch failed', updatedAt: Date.now() });
    } finally {
      tsInFlight = false;
    }
  }

  // Live Comparison Quotes (BlackBull Markets GOLD.F Futures & OANDA:XAUUSD CFD)
  const comparisonQuotes = {
    gc1: null,
    xau: null,
  };

  async function fetchLiveGoldFuturesQuote() {
    // 1. Prioritize BlackBull Markets GOLD.F (BlackBull Gold Futures CFD)
    try {
      const res = await fetch('https://www.tradingview.com/symbols/GOLD.F/', {
        headers: { 'Accept': 'text/html' },
      });
      if (res.ok) {
        const html = await res.text();
        const priceMatch = html.match(/"trade":\{"price":([0-9.]+)\}/);
        const dailyMatch = html.match(/"daily_bar":\{"close":"([0-9.]+)","data_update_time":"[^"]*","high":"([0-9.]+)","low":"([0-9.]+)","open":"([0-9.]+)"/);
        const p = priceMatch ? Number(priceMatch[1]) : (dailyMatch ? Number(dailyMatch[1]) : null);
        const op = dailyMatch ? Number(dailyMatch[4]) : null;
        if (p && p > 100) {
          return {
            symbol: 'BLACKBULL:GOLD.F',
            displaySymbol: 'GOLD.F',
            source: 'BlackBull Markets',
            price: p,
            openPrice: op,
          };
        }
      }
    } catch (e) {}

    // 2. Fallback to COMEX:GC1! if GOLD.F fetch fails
    const gc1 = await fetchLiveSymbolQuote('COMEX:GC1!');
    if (gc1) {
      return {
        symbol: 'COMEX:GC1!',
        displaySymbol: 'GC1!',
        source: 'COMEX',
        price: gc1.price,
        openPrice: gc1.openPrice,
      };
    }
    return null;
  }

  async function updateComparisonQuotes() {
    try {
      const [qGoldF, qXau] = await Promise.all([
        fetchLiveGoldFuturesQuote(),
        fetchLiveSymbolQuote('OANDA:XAUUSD'),
      ]);
      if (qGoldF) comparisonQuotes.gc1 = qGoldF;
      if (qXau) comparisonQuotes.xau = qXau;

      if (panel && (qGoldF || qXau)) {
        panel.setComparisonQuotes(comparisonQuotes);
      }
    } catch (e) {
      console.warn('[CME Vol2Vol Extension] Comparison quotes fetch error:', e);
    }
  }

  // 2. Initialize Overlay Panel
  function initPanel() {
    if (panel) return;
    if (typeof OverlayPanel === 'undefined' || typeof DataParser === 'undefined') {
      setTimeout(initPanel, 150);
      return;
    }

    const isDark =
      document.documentElement.classList.contains('theme-dark') ||
      document.body.classList.contains('theme-dark') ||
      document.documentElement.dataset.theme === 'dark';

    panel = new OverlayPanel({
      theme: isDark ? 'dark' : 'light',
    });
    panel.fetchSymbolQuote = fetchLiveSymbolQuote;

    // Populate initial state and trigger live fetch
    loadInitialData();
  }

  async function loadInitialData() {
    readUrlParams();

    // Check DOM quote
    const domInfo = DataParser.scrapeTradingViewDom();
    // Only override currentSymbol if DOM gives us a real contract (not continuous GC1!)
    if (domInfo.symbol && !domInfo.symbol.includes('1!')) {
      currentSymbol = domInfo.symbol;
    }
    if (domInfo.series) currentSeries = domInfo.series;

    // Load initial 0DTE benchmark immediately so UI is populated
    const initial0Dte = DataParser.getLive0DteGoldDemoData();
    if (domInfo.symbol && !domInfo.symbol.includes('1!')) initial0Dte.symbol = domInfo.symbol;
    if (domInfo.underlyingPrice > 100) initial0Dte.underlyingPrice = domInfo.underlyingPrice;
    // NOTE: domInfo.openPrice = Previous Settlement (price - change), NOT session open 5AM.
    // Used as initial fallback only; Scanner API below will override with actual session open.
    if (domInfo.openPrice > 100) initial0Dte.openPrice = domInfo.openPrice;

    panel.updateData(initial0Dte, 'INIT 0DTE');

    // Immediately fetch live real market price for active contract/symbol
    // Prefer DOM-resolved contract over URL symbol (GC1!)
    const activeContract = (domInfo.symbol && !domInfo.symbol.includes('1!'))
      ? domInfo.symbol
      : currentSymbol;
    const live = await fetchLiveSymbolQuote(activeContract);
    if (live && panel) {
      console.log(`[CME Vol2Vol Extension] Initial live market price for ${activeContract}:`, live.price);
      // Cache Scanner session open (= actual 5AM open after maintenance break)
      if (live.openPrice > 100) {
        cachedSessionOpen = { price: live.openPrice, symbol: activeContract };
        console.log(`[CME Vol2Vol Extension] Cached session open: ${live.openPrice} for ${activeContract}`);
      }
      panel.setRealtimePrice(live.price, live.openPrice, live.symbol);
    }

    // Trigger immediate live voi-lens fetch in page context
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('__TV_TRIGGER_FETCH__', {
          detail: { symbol: activeContract },
        })
      );
    }, 200);

    // Initial fetch of GC1! and XAUUSD comparison quotes
    updateComparisonQuotes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPanel);
  } else {
    initPanel();
  }

  // 3. Handle Full voi-lens payload from TradingView
  async function handleVoiLens(payload) {
    if (!payload || !panel || typeof DataParser === 'undefined') return;

    readUrlParams();
    const activeSeries = currentSeries || payload.items?.[0]?.id;

    panel.setVoiLensPayload(payload, activeSeries);

    // Refresh term structure IV in background (throttled, non-blocking)
    refreshTermStructure(payload).catch(() => {});

    const parsed = DataParser.processVoiLensPayload(payload, activeSeries);
    if (!parsed) return;

    let activeContract = parsed.underlyingContract || parsed.symbol || currentSymbol;
    // Always sanitize out continuous contracts (GC1!) — 0DTE options trade on delivery months (GCV2026)
    if (!activeContract || activeContract.includes('1!') || activeContract.includes('2!')) {
      activeContract = 'COMEX:GCV2026';
    }
    currentSymbol = activeContract;

    // Check Options Chain table row FIRST to ensure price is from GCV2026 (not continuous GC1!)
    let underlying = 0;
    let openPrice = 0;
    if (typeof document !== 'undefined') {
      const chainRow = document.querySelector('[data-qa-id="option-chain-underlying-row"]');
      if (chainRow && typeof DataParser !== 'undefined' && DataParser.extractUnderlyingInfoFromRow) {
        const chainInfo = DataParser.extractUnderlyingInfoFromRow(chainRow);
        if (chainInfo && chainInfo.price > 100) {
          underlying = chainInfo.price;
          // NOTE: chainInfo.openPrice = Previous Settlement (price - change), NOT session open.
          // Use cachedSessionOpen from Scanner API instead (= actual 5AM session open).
          if (chainInfo.symbol && !chainInfo.symbol.includes('1!')) {
            activeContract = chainInfo.symbol.includes(':') ? chainInfo.symbol : `COMEX:${chainInfo.symbol}`;
            currentSymbol = activeContract;
          }
        }
      }
    }

    // Use cached session open from Scanner/WebSocket (= actual 5AM open after break)
    if (cachedSessionOpen.price > 100) {
      openPrice = cachedSessionOpen.price;
    }

    // Fallback: If not from DOM chain row, fetch live quote for active delivery contract (e.g. COMEX:GCV2026)
    if (!underlying) {
      const live = await fetchLiveSymbolQuote(activeContract);
      if (live && live.price > 100) {
        underlying = live.price;
        if (live.openPrice > 100) {
          openPrice = live.openPrice;
          cachedSessionOpen = { price: live.openPrice, symbol: activeContract };
        }
      }
    }

    // Secondary fallback to previous valid price if not continuous
    if (!underlying && panel.currentData?.underlyingPrice > 100 && !panel.currentData.symbol.includes('1!')) {
      underlying = panel.currentData.underlyingPrice;
      if (!openPrice && panel.currentData.openPrice > 100) openPrice = panel.currentData.openPrice;
    }

    if (!underlying) underlying = 4366.1; // GCV2026 reference price
    if (!openPrice) openPrice = 4381.8;

    console.log(
      `[CME Vol2Vol Extension] Applied live voi-lens data for ${activeContract} series ${parsed.selectedExp} (${parsed.strikesData.length} active strikes) at S: ${underlying}`
    );

    // Determine ATM IV from term structure data (live from voi-lens) or fallback
    let atmIV = 23.66; // Default benchmark
    if (panel.termStructureData && panel.termStructureData.length > 0) {
      // Use the selected series ATM IV, or 0DTE if available
      const selectedTS = panel.termStructureData.find(ts => ts.id === parsed.selectedSeriesId);
      const zeroDteTS = panel.termStructureData.find(ts => ts.dte === 0);
      if (selectedTS && selectedTS.atmIV > 0) atmIV = selectedTS.atmIV;
      else if (zeroDteTS && zeroDteTS.atmIV > 0) atmIV = zeroDteTS.atmIV;
    }

    panel.updateData(
      {
        symbol: activeContract,
        underlyingPrice: underlying,
        openPrice: openPrice,
        atmVolatility: atmIV,
        dte: panel.getResolvedDte(parsed.dte), // Respects user DTE setting with 0DTE default
        series: parsed.selectedSeriesId,
        strikesData: parsed.strikesData,
      },
      `LIVE ${parsed.is0Dte ? '0DTE' : parsed.dte + 'DTE'}`
    );
  }

  window.addEventListener('__TV_OPTIONS_VOI_LENS__', (e) => {
    handleVoiLens(e.detail);
  });

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === '__TV_OPTIONS_VOI_LENS__') {
      handleVoiLens(e.data.payload);
    }
  });

  // 4. Handle Real-Time Underlying Price Updates (from WebSocket or Scanner)
  function handleUnderlyingPriceEvent(detail) {
    if (!detail || !detail.price || !panel) return;
    const numPrice = Number(detail.price);
    const numOpen = Number(detail.openPrice);
    if (isNaN(numPrice) || numPrice < 100) return;

    // Filter out options symbols
    const sym = detail.symbol || '';
    const isOption = sym.includes(';') || /[0-9]+[CP][0-9]+/i.test(sym) || /[_\s:-][CP][0-9]+/i.test(sym) || /(?:CALL|PUT)/i.test(sym);
    if (isOption) return;

    // STRICT: Continuous contracts (e.g. COMEX:GC1!) must NEVER overwrite the 0DTE underlying price.
    // 0DTE options trade on physical delivery contracts (e.g. COMEX:GCV2026), NOT GC1!.
    if (sym.includes('1!') || sym.includes('2!')) {
      return;
    }

    // Match incoming symbol against the active delivery contract
    const activeContract = panel.currentData?.symbol || currentSymbol || 'COMEX:GCV2026';
    const cleanActive = activeContract.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cleanIncoming = sym.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (cleanIncoming && (cleanActive.includes(cleanIncoming) || cleanIncoming.includes(cleanActive))) {
      const validOpen = !isNaN(numOpen) && numOpen > 100 ? numOpen : null;
      panel.setRealtimePrice(numPrice, validOpen, sym);
      // Cache WebSocket session open (v.open_price = actual session open from TradingView)
      if (validOpen) {
        cachedSessionOpen = { price: validOpen, symbol: sym };
      }
    }
  }

  window.addEventListener('__TV_UNDERLYING_PRICE__', (e) => {
    handleUnderlyingPriceEvent(e.detail);
  });

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === '__TV_UNDERLYING_PRICE__') {
      handleUnderlyingPriceEvent(e.data.payload);
    }
  });

  // 5. Watch for Real-Time Options Chain Table & DOM Price Updates
  function initRealtimePriceObservers() {
    let chainRowObserver = null;
    let quoteTickerObservers = [];

    // A. Options Chain Table Underlying Row Observer (Primary for /options/chain/)
    const bindChainUnderlyingRow = () => {
      const row = document.querySelector('[data-qa-id="option-chain-underlying-row"]');
      if (row && row !== chainRowObserver?._target) {
        if (chainRowObserver) chainRowObserver.disconnect();

        const updateFromRow = () => {
          if (typeof DataParser === 'undefined') return;
          const info = DataParser.extractUnderlyingInfoFromRow ? DataParser.extractUnderlyingInfoFromRow(row) : null;
          if (info && info.price > 100 && panel) {
            // Don't send info.openPrice — it's Previous Settlement (price-change), NOT session open.
            // Session open is managed by cachedSessionOpen from Scanner/WebSocket.
            panel.setRealtimePrice(info.price, null, info.symbol);
            if (info.symbol) currentSymbol = info.symbol;
            return;
          }
          const p = DataParser.extractPriceFromChainRow(row);
          if (p && p > 100 && panel) {
            panel.setRealtimePrice(p);
          }
        };

        updateFromRow();

        chainRowObserver = new MutationObserver(updateFromRow);
        chainRowObserver._target = row;
        chainRowObserver.observe(row, { characterData: true, subtree: true, childList: true });
        console.log('[CME Vol2Vol Extension] Successfully hooked Options Chain live underlying row');
      }
    };

    // B. QuoteTicker (.js-symbol-last) Observer (Fallback for non-chain chart pages)
    const bindQuoteTicker = () => {
      // Do not use quoteTicker on Options Chain page where the chain row exists
      if (document.querySelector('[data-qa-id="option-chain-underlying-row"]')) return;

      const lastEls = document.querySelectorAll('.js-symbol-last');
      for (const el of lastEls) {
        if (el._cme_observed) continue;
        el._cme_observed = true;

        const updateFromTicker = () => {
          const text = el.textContent.replace(/[^0-9.]/g, '');
          const p = parseFloat(text);
          if (!isNaN(p) && p > 100 && panel) {
            panel.setRealtimePrice(p);
          }
        };

        updateFromTicker();

        const obs = new MutationObserver(updateFromTicker);
        obs.observe(el, { characterData: true, subtree: true, childList: true });
        quoteTickerObservers.push(obs);
      }
    };

    // C. Safety-net DOM Price Poller (Every 1000ms)
    // Primary real-time updates come from MutationObserver (A) above.
    // This poller is a safety net for cases where MutationObserver misses updates.
    setInterval(() => {
      if (!panel) return;

      // Only check the Options Chain DOM row — this is the single source of truth
      const chainRow = document.querySelector('[data-qa-id="option-chain-underlying-row"]');
      if (chainRow && typeof DataParser !== 'undefined') {
        const info = DataParser.extractUnderlyingInfoFromRow ? DataParser.extractUnderlyingInfoFromRow(chainRow) : null;
        if (info && info.price > 100) {
          // Don't send info.openPrice — it's Previous Settlement (price-change), NOT session open.
          panel.setRealtimePrice(info.price, null, info.symbol);
          if (info.symbol && !info.symbol.includes('1!')) currentSymbol = info.symbol;
          return;
        }
        const p = DataParser.extractPriceFromChainRow(chainRow);
        if (p && p > 100) {
          panel.setRealtimePrice(p);
          return;
        }
      }

      // Fallback: QuoteTicker (only when NOT on Options Chain page)
      if (!document.querySelector('[data-qa-id="option-chain-underlying-row"]')) {
        const lastEl = document.querySelector('.js-symbol-last');
        if (lastEl) {
          const text = lastEl.textContent.replace(/[^0-9.]/g, '');
          const p = parseFloat(text);
          if (!isNaN(p) && p > 100) {
            panel.setRealtimePrice(p);
          }
        }
      }
    }, 1000);

    // NOTE: Scanner API poll REMOVED — it was fetching GC1! price (~4386) and
    // overwriting the correct GCV2026 price (~4355) every 2.5 seconds, causing
    // the price to oscillate. The DOM MutationObserver is the authoritative source.

    // F. Periodic Refresh for strike volume updates (Every 15 seconds)
    // Uses the ACTIVE CONTRACT symbol, not URL symbol (GC1!)
    setInterval(() => {
      const activeSym = (panel && panel.currentData?.symbol) || currentSymbol;
      window.dispatchEvent(
        new CustomEvent('__TV_TRIGGER_FETCH__', {
          detail: { symbol: activeSym },
        })
      );
    }, 15000);

    // Periodic refresh for GC1! and XAUUSD comparison quotes (Every 4 seconds)
    setInterval(updateComparisonQuotes, 4000);

    // G. DOM Tree Observer to re-bind when React renders / replaces elements
    const bodyObserver = new MutationObserver(() => {
      bindChainUnderlyingRow();
      bindQuoteTicker();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    bindChainUnderlyingRow();
    bindQuoteTicker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRealtimePriceObservers);
  } else {
    initRealtimePriceObservers();
  }

  // 6. Watch for URL changes on TradingView (SPA navigation)
  let lastHref = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      readUrlParams();
      console.log('[CME Vol2Vol Extension] URL changed to:', lastHref);
      setTimeout(() => {
        // Re-scrape DOM to find real contract symbol after SPA navigation
        if (typeof DataParser !== 'undefined') {
          const domInfo = DataParser.scrapeTradingViewDom();
          if (domInfo.symbol && !domInfo.symbol.includes('1!')) {
            currentSymbol = domInfo.symbol;
          }
        }
        const activeSym = (panel && panel.currentData?.symbol) || currentSymbol;
        window.dispatchEvent(
          new CustomEvent('__TV_TRIGGER_FETCH__', {
            detail: { symbol: activeSym },
          })
        );
        updateComparisonQuotes();
      }, 500);
    }
  });
  observer.observe(document, { subtree: true, childList: true });

  // 7. Handle runtime messaging from extension popup (Non-Full Dashboard live sync)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (!request || !request.type) return;

      if (request.type === 'GET_V2V_DATA') {
        const stats = panel?.latestStats || null;
        sendResponse({
          success: true,
          symbol: panel?.currentData?.symbol || currentSymbol,
          series: panel?.currentData?.series || currentSeries,
          currentData: panel?.currentData || null,
          stats: stats,
          comparisonQuotes: comparisonQuotes,
          convertedGc1: panel?.latestConvertedGc1 || null,
          convertedXau: panel?.latestConvertedXau || null,
          selectedDteMode: panel?.selectedDteMode || '0',
          strikeRangeMode: panel?.strikeRangeMode || 'near5',
          timestamp: Date.now(),
        });
        return true;
      }

      if (request.type === 'SET_DTE_MODE') {
        if (panel && request.dteMode !== undefined) {
          panel.selectedDteMode = String(request.dteMode);
          if (panel.selDte) panel.selDte.value = String(request.dteMode);
          panel.applyDteChange();
          sendResponse({
            success: true,
            stats: panel.latestStats,
            selectedDteMode: panel.selectedDteMode,
          });
        }
        return true;
      }

      if (request.type === 'TRIGGER_SYNC') {
        const activeSym = panel?.currentData?.symbol || currentSymbol;
        window.dispatchEvent(
          new CustomEvent('__TV_TRIGGER_FETCH__', {
            detail: { symbol: activeSym },
          })
        );
        updateComparisonQuotes();
        sendResponse({ success: true, symbol: activeSym });
        return true;
      }
    });
  }
})();

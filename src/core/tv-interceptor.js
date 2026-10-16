/**
 * src/core/tv-interceptor.js
 * Injected into TradingView's MAIN world to intercept live options data, voi-lens streams, and prices
 */

(function () {
  'use strict';

  if (window.__TV_OPTIONS_INTERCEPTOR_ACTIVE__) return;
  window.__TV_OPTIONS_INTERCEPTOR_ACTIVE__ = true;

  console.log('[CME Vol2Vol Extension] Interceptor initialized in TradingView page context');

  function emitEvent(eventName, detail) {
    try {
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
      window.postMessage({ type: eventName, payload: detail }, '*');
    } catch (e) {
      console.error('[CME Vol2Vol Extension] Error emitting event:', e);
    }
  }

  // 1. Hook window.fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';

      if (
        url.includes('/v1/voi-lens/') ||
        url.includes('options-charting') ||
        url.includes('options-storage') ||
        url.includes('scanner.tradingview.com')
      ) {
        const clone = response.clone();
        clone
          .json()
          .then((data) => {
            processNetworkResponse(data, url);
          })
          .catch(() => {});
      }
    } catch (e) {}
    return response;
  };

  // 2. Hook XMLHttpRequest
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._interceptUrl = url;
    return originalXhrOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener('load', function () {
      try {
        const url = this._interceptUrl || '';
        if (
          url.includes('/v1/voi-lens/') ||
          url.includes('options-charting') ||
          url.includes('options-storage') ||
          url.includes('scanner.tradingview.com')
        ) {
          if (this.responseText) {
            const data = JSON.parse(this.responseText);
            processNetworkResponse(data, url);
          }
        }
      } catch (e) {}
    });
    return originalXhrSend.call(this, body);
  };

  // 3. Hook window.WebSocket for tick-by-tick real-time quotes
  try {
    const OriginalWebSocket = window.WebSocket;
    if (OriginalWebSocket) {
      window.WebSocket = function (url, protocols) {
        const ws = new OriginalWebSocket(url, protocols);
        ws.addEventListener('message', function (event) {
          try {
            if (typeof event.data === 'string') {
              handleTradingViewWsMessage(event.data);
            }
          } catch (err) {}
        });
        return ws;
      };
      window.WebSocket.prototype = OriginalWebSocket.prototype;
    }
  } catch (e) {
    console.warn('[CME Vol2Vol Extension] WebSocket hook warning:', e);
  }

  function handleTradingViewWsMessage(raw) {
    if (!raw || typeof raw !== 'string') return;
    if (
      !raw.includes('"lp"') &&
      !raw.includes('qsd') &&
      !raw.includes('"last_price"') &&
      !raw.includes('"bid"') &&
      !raw.includes('"ask"') &&
      !raw.includes('"close"')
    ) return;

    // Helper to identify option contract symbols
    function isOptionSymbol(sym) {
      if (!sym || typeof sym !== 'string') return false;
      return (
        sym.includes(';') ||
        /[0-9]+[CP][0-9]+/i.test(sym) ||
        /[_\s:-][CP][0-9]+/i.test(sym) ||
        /(?:CALL|PUT)/i.test(sym)
      );
    }

    // Split by TradingView message delimiter (~m~<length>~m~)
    const parts = raw.split(/~m~\d+~m~/);
    for (const part of parts) {
      if (!part || part.length < 5) continue;
      try {
        const parsed = JSON.parse(part);
        if ((parsed.m === 'qsd' || parsed.m === 'quote_completed') && Array.isArray(parsed.p)) {
          for (let i = 1; i < parsed.p.length; i++) {
            const quoteObj = parsed.p[i];
            if (!quoteObj || typeof quoteObj !== 'object') continue;
            const sym = quoteObj.n || '';

            // Ignore option contract symbols
            if (isOptionSymbol(sym)) continue;
            // Ignore continuous symbols (GC1!, GC2!) — they have different prices
            if (sym.includes('1!') || sym.includes('2!')) continue;

            const v = quoteObj.v || {};
            const lastPrice = Number(v.lp || v.last_price || v.close || (v.bid && v.ask ? (v.bid + v.ask) / 2 : null));
            const openPrice = Number(v.open_price || v.open);
            if (!isNaN(lastPrice) && lastPrice > 100) {
              emitEvent('__TV_UNDERLYING_PRICE__', {
                symbol: sym,
                price: lastPrice,
                openPrice: !isNaN(openPrice) && openPrice > 100 ? openPrice : null,
                source: 'websocket-qsd',
              });
            }
          }
        }
      } catch (err) {}
    }
  }

  /**
   * Process and route intercepted network JSON
   */
  function processNetworkResponse(json, sourceUrl) {
    if (!json || typeof json !== 'object') return;

    // A. Direct voi-lens structure: { items: [ { id, exp, family, underlying, strikes: [ { s, c: { v }, p: { v } } ] } ] }
    if (json.items && Array.isArray(json.items) && json.items.length > 0 && json.items[0].strikes) {
      console.log(`[CME Vol2Vol Extension] Intercepted voi-lens data with ${json.items.length} series from ${sourceUrl}`);
      emitEvent('__TV_OPTIONS_VOI_LENS__', {
        source: 'voi-lens',
        url: sourceUrl,
        underlying: json.underlying,
        timestamp: json.ts,
        items: json.items,
      });
      return;
    }

    // B. Scanner response with underlying quote (strictly filter for underlying future symbol and price > 100)
    // Block continuous symbols (GC1!, GC2!) which have different prices from real contracts
    if (Array.isArray(json.data) && json.data.length > 0) {
      const activeSym = getUrlParam('symbol') || 'COMEX:GC1!';
      const cleanTarget = activeSym.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      for (const row of json.data) {
        if (row.s && row.d && Array.isArray(row.d)) {
          const isOption = isOptionSymbol(row.s);
          if (isOption) continue;
          // Skip continuous symbols — they have different prices
          if (row.s.includes('1!') || row.s.includes('2!')) continue;

          const cleanRowSym = (row.s || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          if (cleanRowSym && (cleanRowSym.includes(cleanTarget) || cleanTarget.includes(cleanRowSym))) {
            const closePrice = Number(row.d[0]);
            const openPrice = Number(row.d[1]);
            if (!isNaN(closePrice) && closePrice > 100) {
              emitEvent('__TV_UNDERLYING_PRICE__', {
                symbol: row.s,
                price: closePrice,
                openPrice: !isNaN(openPrice) && openPrice > 100 ? openPrice : null,
                source: 'scanner-response',
              });
            }
          }
        }
      }
    }
  }

  /**
   * Directly fetch options voi-lens data from TradingView session
   */
  window.__TV_FETCH_OPTIONS__ = async function (symbol) {
    const sym = symbol || getUrlParam('symbol') || 'COMEX:GC1!';
    const url = `https://options-charting.tradingview.com/v1/voi-lens/${encodeURIComponent(sym)}?include_expired_series=true&label-product=options_volume_tab`;

    let optionsJson = null;
    try {
      console.log('[CME Vol2Vol Extension] Directly fetching live options from:', url);
      const res = await originalFetch(url, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (res.ok) {
        optionsJson = await res.json();
        processNetworkResponse(optionsJson, url);
      }
    } catch (e) {
      console.warn('[CME Vol2Vol Extension] Direct fetch error:', e);
    }

    // Fetch underlying spot price and open price from scanner GET endpoint
    // ONLY emit price events for real contract symbols (e.g. GCV2026), NOT continuous (GC1!)
    // Continuous symbols have different prices that cause instability
    if (!sym.includes('1!') && !sym.includes('2!')) {
      try {
        const scanUrl = `https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(sym)}&fields=close,open,high,low,change`;
        const scanRes = await originalFetch(scanUrl, {
          headers: { 'Accept': 'application/json' },
        });
        if (scanRes.ok) {
          const scanJson = await scanRes.json();
          const p = Number(scanJson.close);
          const op = Number(scanJson.open);
          if (!isNaN(p) && p > 100) {
            emitEvent('__TV_UNDERLYING_PRICE__', {
              symbol: sym,
              price: p,
              openPrice: !isNaN(op) && op > 100 ? op : null,
              source: 'scanner-get',
            });
          }
        }
      } catch (e) {}
    }

    return optionsJson;
  };

  function getUrlParam(key) {
    try {
      return new URL(window.location.href).searchParams.get(key);
    } catch (e) {
      return null;
    }
  }

  // Listen for request to fetch live data from content script
  window.addEventListener('__TV_TRIGGER_FETCH__', (e) => {
    const symbol = (e.detail && e.detail.symbol) || getUrlParam('symbol') || 'COMEX:GC1!';
    window.__TV_FETCH_OPTIONS__(symbol);
  });
})();

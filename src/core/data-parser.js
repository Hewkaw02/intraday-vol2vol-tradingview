/**
 * src/core/data-parser.js
 * Scrapes DOM, parses TradingView voi-lens series data, handles DTE calculations with 0DTE default
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DataParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Calculate DTE (Days to Expiration) from series string (e.g. '20260911')
   * If expiry date is today, returns 0 (0DTE).
   */
  function calculateDteFromSeries(seriesStr) {
    if (!seriesStr) return 0;

    const cleaned = String(seriesStr).replace(/[^0-9]/g, '');
    if (cleaned.length >= 8) {
      const year = parseInt(cleaned.slice(0, 4), 10);
      const month = parseInt(cleaned.slice(4, 6), 10) - 1;
      const day = parseInt(cleaned.slice(6, 8), 10);

      const now = new Date();
      const todayYear = now.getUTCFullYear();
      const todayMonth = now.getUTCMonth();
      const todayDay = now.getUTCDate();

      // If it's today's date, it's 0 DTE
      if (year === todayYear && month === todayMonth && day === todayDay) {
        return 0;
      }

      const expiryDate = new Date(Date.UTC(year, month, day, 21, 0, 0));
      const diffMs = expiryDate.getTime() - now.getTime();
      const dte = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return Math.max(dte, 0);
    }
    return 0;
  }

  /**
   * Extract strikes and volume from a TradingView voi-lens series object
   */
  function parseVoiLensSeries(seriesItem) {
    if (!seriesItem || !Array.isArray(seriesItem.strikes)) return [];

    return seriesItem.strikes
      .map((s) => ({
        strike: Number(s.s),
        callVol: Number(s.c?.v || 0),
        putVol: Number(s.p?.v || 0),
        iv: Number(s.c?.iv || s.p?.iv || 0),
      }))
      .filter((s) => s.strike > 0 && (s.callVol > 0 || s.putVol > 0))
      .sort((a, b) => a.strike - b.strike);
  }

  /**
   * Parse all series items from voi-lens response and find the target or 0DTE series
   */
  function processVoiLensPayload(payload, targetSeriesId = null) {
    if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
      return null;
    }

    const seriesList = [];
    let selectedItem = null;

    // Collect summary for all series
    for (const item of payload.items) {
      let callVolSum = 0;
      let putVolSum = 0;
      if (item.strikes) {
        for (const s of item.strikes) {
          callVolSum += s.c?.v || 0;
          putVolSum += s.p?.v || 0;
        }
      }

      const dte = calculateDteFromSeries(item.exp);
      const is0Dte = dte === 0;

      const meta = {
        id: item.id,
        exp: item.exp,
        dte,
        is0Dte,
        family: item.family || '',
        totalCallVol: callVolSum,
        totalPutVol: putVolSum,
        totalVol: callVolSum + putVolSum,
        label: `${item.exp} (${is0Dte ? '0 DTE' : dte + ' DTE'}) — ${item.family} [C: ${callVolSum.toLocaleString()} | P: ${putVolSum.toLocaleString()}]`,
      };

      seriesList.push(meta);

      // Match target series
      if (targetSeriesId) {
        if (
          item.id === targetSeriesId ||
          String(item.exp) === String(targetSeriesId) ||
          item.id.includes(String(targetSeriesId))
        ) {
          selectedItem = item;
        }
      }
    }

    // If no target match, default to 0DTE or first active series
    if (!selectedItem) {
      // Find 0DTE series first
      selectedItem = payload.items.find((item) => calculateDteFromSeries(item.exp) === 0) || payload.items[0];
    }

    const strikesData = parseVoiLensSeries(selectedItem);
    const dte = calculateDteFromSeries(selectedItem.exp);

    return {
      symbol: selectedItem.underlying || payload.underlying || 'COMEX:GCV2026',
      underlyingContract: selectedItem.underlying || '',
      selectedSeriesId: selectedItem.id,
      selectedExp: selectedItem.exp,
      dte,
      is0Dte: dte === 0,
      strikesData,
      seriesList,
    };
  }

  /**
   * Robustly extracts underlying price from the Options Chain table row.
   * Explicitly skips any spans containing '%', '+', '-', or unicode minus '−' to prevent net change values
   * (e.g. +37.0 or −18.7) from being mistakenly read as the underlying price.
   */
  function extractPriceFromChainRow(row) {
    if (!row) return null;
    const priceWrap = row.querySelector('[class*="priceWrap"]');
    if (priceWrap) {
      const spans = priceWrap.querySelectorAll('span');
      for (const s of spans) {
        const raw = s.textContent.trim();
        if (raw.includes('%') || raw.includes('+') || raw.includes('-') || raw.includes('\u2212') || raw.includes('−')) continue;
        const cleaned = raw.replace(/,/g, '');
        const val = parseFloat(cleaned);
        if (!isNaN(val) && val > 100) return val;
      }
    }
    const allSpans = row.querySelectorAll('span');
    for (const s of allSpans) {
      const raw = s.textContent.trim();
      if (raw.includes('%') || raw.includes('+') || raw.includes('-') || raw.includes('\u2212') || raw.includes('−')) continue;
      const cleaned = raw.replace(/,/g, '');
      const val = parseFloat(cleaned);
      if (!isNaN(val) && val > 100) return val;
    }
    return null;
  }

  /**
   * Robustly extracts underlying price, symbol (e.g. GCV2026), net change, and open price from chain row.
   */
  function extractUnderlyingInfoFromRow(row) {
    if (!row) return null;
    const price = extractPriceFromChainRow(row);
    let symbol = '';
    let change = null;
    let changePct = null;
    let openPrice = null;

    const td = row.querySelector('td');
    if (td) {
      symbol = td.getAttribute('data-cell-id') || '';
    }

    const spans = row.querySelectorAll('span');
    for (const s of spans) {
      const txt = s.textContent.trim();
      // Match symbol text (e.g. GCV2026, GCZ2026)
      if (!symbol && /^[A-Z0-9!]{3,12}$/.test(txt) && !/^(USD|EUR|THB|JPY|GBP)$/i.test(txt)) {
        symbol = txt;
      }
      // Match percentage change (e.g. -0.43%, −0.43%)
      if (txt.includes('%')) {
        const num = parseFloat(txt.replace(/[\u2212−]/g, '-').replace('%', ''));
        if (!isNaN(num)) changePct = num;
      } else if (/[+\-\u2212−]\s*[0-9]+(?:\.[0-9]+)?/.test(txt)) {
        // Match net change (e.g. -18.7, −18.7, +37.0)
        const num = parseFloat(txt.replace(/[\u2212−]/g, '-').replace(/\s+/g, ''));
        if (!isNaN(num) && Math.abs(num) < 1000) change = num;
      }
    }

    if (price && change !== null) {
      // WARNING: This computes PREVIOUS SETTLEMENT (price - netChange), NOT session open.
      // TradingView's Options Chain shows netChange relative to previous settlement (close of
      // last session at ~3AM), NOT relative to session open (5AM).
      // For the actual session open, use Scanner API 'open' field instead.
      openPrice = Math.round((price - change) * 10) / 10;
    }

    return {
      price,
      symbol,
      change,
      changePct,
      openPrice,
    };
  }

  /**
   * Find the nearest 0DTE Strike to the target price.
   * Snaps the price cleanly to the actual strike traded on the 0DTE chain.
   */
  function find0DteStrike(strikesData, targetPrice) {
    const numP = Number(targetPrice);
    if (isNaN(numP) || numP <= 0) return 0;

    if (strikesData && strikesData.length > 0) {
      let bestStrike = Number(strikesData[0].strike);
      let minDiff = Math.abs(bestStrike - numP);

      for (const s of strikesData) {
        const k = Number(s.strike);
        if (!isNaN(k) && k > 0) {
          const diff = Math.abs(k - numP);
          if (diff < minDiff) {
            minDiff = diff;
            bestStrike = k;
          }
        }
      }
      return bestStrike;
    }

    // Fallback if no strikes data yet: for Gold/Commodities (>1000) round to nearest 5
    if (numP >= 1000) {
      return Math.round(numP / 5) * 5;
    }
    return Math.round(numP);
  }

  /**
   * Extract the adjacent 0DTE strike from the Options Chain table DOM.
   * Looks at the rows immediately preceding and succeeding the underlying row.
   */
  function extract0DteStrikeFromDom(underlyingRow, targetPrice) {
    if (!underlyingRow) return null;
    const prevRow = underlyingRow.previousElementSibling;
    const nextRow = underlyingRow.nextElementSibling;
    const candidates = [];

    for (const row of [prevRow, nextRow]) {
      if (!row) continue;
      // 1. Look for strike button
      const btns = row.querySelectorAll('button');
      for (const b of btns) {
        const text = b.textContent.replace(/[^0-9.]/g, '');
        const val = parseFloat(text);
        if (!isNaN(val) && val > 100) candidates.push(val);
      }
      // 2. Look for cells with strike data
      const tds = row.querySelectorAll('td');
      for (const td of tds) {
        const rowId = td.getAttribute('data-row-id') || td.getAttribute('row-id');
        if (rowId) {
          const val = parseFloat(rowId);
          if (!isNaN(val) && val > 100) candidates.push(val);
        }
      }
    }

    if (candidates.length === 0) return null;
    const numP = Number(targetPrice);
    if (isNaN(numP) || numP <= 0) return candidates[0];

    candidates.sort((a, b) => Math.abs(a - numP) - Math.abs(b - numP));
    return candidates[0];
  }

  /**
   * Scrape current underlying price, symbol, and series from TradingView DOM
   */
  function scrapeTradingViewDom() {
    let underlyingPrice = 0;
    let symbol = '';
    let series = '';

    // 1. Scrape from URL
    try {
      if (typeof window !== 'undefined' && window.location) {
        const u = new URL(window.location.href);
        symbol = u.searchParams.get('symbol') || '';
        series = u.searchParams.get('series') || '';
      }
    } catch (e) {}

    if (typeof document === 'undefined') {
      return { underlyingPrice, symbol, series, dte: calculateDteFromSeries(series) };
    }

    // 2. Scrape underlying price from TradingView DOM elements
    // Priority 1: Options Chain Table underlying row (present on /options/chain/)
    let openPrice = 0;
    const chainRow = document.querySelector('[data-qa-id="option-chain-underlying-row"]');
    if (chainRow) {
      const info = extractUnderlyingInfoFromRow(chainRow);
      if (info) {
        if (info.price && info.price > 100) underlyingPrice = info.price;
        if (info.symbol) symbol = info.symbol;
        if (info.openPrice && info.openPrice > 100) openPrice = info.openPrice;
      }
    }

    // Priority 2: General options page selectors (QuoteTicker, Chart Legend, Quote Values)
    if (!underlyingPrice) {
      const priceSelectors = [
        '.js-symbol-last',
        '[data-name="legend-last-value"]',
        '[data-field="last"]',
        '.tv-symbol-price-quote__value',
        '[class*="priceValue-"]',
        '[class*="tickerPrice-"]',
        '[class*="currentPrice-"]',
        'span[class*="lastValue-"]',
      ];

      for (const sel of priceSelectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const text = el.textContent.replace(/[^0-9.]/g, '');
          const p = parseFloat(text);
          if (!isNaN(p) && p > 100) {
            underlyingPrice = p;
            break;
          }
        }
        if (underlyingPrice) break;
      }
    }

    // Priority 3: Close price in legend text (e.g. "C4397.3")
    if (!underlyingPrice) {
      try {
        const legendEls = document.querySelectorAll('[class*="valuesWrapper"], [class*="legend-"], [class*="legend"]');
        for (const el of legendEls) {
          const match = el.textContent.match(/C\s*([0-9]{3,6}(?:\.[0-9]+)?)/i);
          if (match && match[1]) {
            const p = parseFloat(match[1]);
            if (!isNaN(p) && p > 100) {
              underlyingPrice = p;
              break;
            }
          }
        }
      } catch (e) {}
    }

    // 3. Scrape open price from legend or DOM if available
    if (!openPrice) {
      const openSelectors = [
        '[data-name="legend-open-value"]',
        '[data-field="open"]',
        '[class*="openValue-"]',
        '[class*="openPrice-"]',
      ];
      for (const sel of openSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.textContent.replace(/[^0-9.]/g, '');
          const op = parseFloat(text);
          if (!isNaN(op) && op > 100) {
            openPrice = op;
            break;
          }
        }
      }
    }

    // Also inspect legend text (e.g. "O4359.4 H4362.0 L4340.0 C4347.4")
    if (!openPrice) {
      try {
        const legendEls = document.querySelectorAll('[class*="valuesWrapper"], [class*="legend-"], [class*="legend"]');
        for (const el of legendEls) {
          const match = el.textContent.match(/O\s*([0-9]{3,6}(?:\.[0-9]+)?)/i);
          if (match && match[1]) {
            const op = parseFloat(match[1]);
            if (!isNaN(op) && op > 100) {
              openPrice = op;
              break;
            }
          }
        }
      } catch (e) {}
    }

    // If symbol is continuous (e.g. GC1!) or empty, sanitize to COMEX:GCV2026 for 0DTE options
    let cleanSym = symbol;
    if (!cleanSym || cleanSym.includes('1!') || cleanSym.includes('2!')) {
      cleanSym = 'COMEX:GCV2026';
    } else if (!cleanSym.includes(':')) {
      cleanSym = `COMEX:${cleanSym}`;
    }

    return {
      underlyingPrice: underlyingPrice || 0,
      openPrice: openPrice || 0,
      symbol: cleanSym,
      series,
      dte: calculateDteFromSeries(series),
    };
  }

  /**
   * Returns live 0DTE Gold benchmark dataset (from COMEX:GCV2026;OG2;20260911)
   */
  function getLive0DteGoldDemoData() {
    return {
      symbol: 'COMEX:GCV2026',
      underlyingPrice: 4355.0,
      openPrice: 4328.0,
      atmVolatility: 23.66,
      dte: 0, // Default 0 DTE
      series: '20260911',
      strikesData: [
        { strike: 4100, callVol: 5, putVol: 35, iv: 26.5 },
        { strike: 4150, callVol: 12, putVol: 45, iv: 25.8 },
        { strike: 4200, callVol: 18, putVol: 72, iv: 25.1 },
        { strike: 4250, callVol: 30, putVol: 88, iv: 24.5 },
        { strike: 4300, callVol: 95, putVol: 145, iv: 23.9 },
        { strike: 4320, callVol: 110, putVol: 85, iv: 23.7 },
        { strike: 4340, callVol: 165, putVol: 42, iv: 23.66 },
        { strike: 4355, callVol: 195, putVol: 38, iv: 23.66 }, // ATM
        { strike: 4360, callVol: 220, putVol: 24, iv: 23.8 },
        { strike: 4380, callVol: 180, putVol: 15, iv: 24.1 },
        { strike: 4400, callVol: 340, putVol: 10, iv: 24.5 },
        { strike: 4450, callVol: 280, putVol: 5, iv: 25.2 },
        { strike: 4500, callVol: 410, putVol: 3, iv: 26.1 }, // Major Call Wall
        { strike: 4550, callVol: 125, putVol: 0, iv: 27.2 },
        { strike: 4600, callVol: 85, putVol: 0, iv: 28.5 },
        { strike: 4650, callVol: 45, putVol: 0, iv: 29.8 },
      ],
    };
  }

  /**
   * Returns CME screenshot benchmark dataset
   */
  function getGoldCmeDemoData() {
    return {
      symbol: 'COMEX:GC1! (Gold)',
      underlyingPrice: 4441.9,
      openPrice: 4435.0,
      atmVolatility: 23.66,
      dte: 0, // Default 0 DTE
      series: '20260909',
      strikesData: [
        { strike: 3805, callVol: 0, putVol: 5, iv: 32.5 },
        { strike: 3900, callVol: 2, putVol: 8, iv: 30.2 },
        { strike: 4000, callVol: 0, putVol: 12, iv: 28.5 },
        { strike: 4050, callVol: 1, putVol: 9, iv: 27.8 },
        { strike: 4100, callVol: 3, putVol: 15, iv: 26.9 },
        { strike: 4150, callVol: 2, putVol: 24, iv: 26.1 },
        { strike: 4200, callVol: 5, putVol: 42, iv: 25.4 },
        { strike: 4255, callVol: 12, putVol: 38, iv: 24.8 },
        { strike: 4300, callVol: 18, putVol: 55, iv: 24.2 },
        { strike: 4350, callVol: 28, putVol: 82, iv: 23.8 },
        { strike: 4380, callVol: 45, putVol: 110, iv: 23.6 },
        { strike: 4400, callVol: 85, putVol: 22, iv: 23.58 },
        { strike: 4440, callVol: 95, putVol: 5, iv: 23.66 }, // ATM
        { strike: 4480, callVol: 58, putVol: 0, iv: 23.9 },
        { strike: 4520, callVol: 32, putVol: 0, iv: 24.3 },
        { strike: 4550, callVol: 40, putVol: 0, iv: 24.7 },
        { strike: 4600, callVol: 62, putVol: 0, iv: 25.3 },
        { strike: 4668, callVol: 25, putVol: 0, iv: 26.1 },
        { strike: 4705, callVol: 35, putVol: 0, iv: 26.6 },
        { strike: 4800, callVol: 45, putVol: 0, iv: 28.1 },
        { strike: 4880, callVol: 30, putVol: 0, iv: 29.5 },
        { strike: 4913, callVol: 75, putVol: 0, iv: 30.1 },
        { strike: 5000, callVol: 200, putVol: 0, iv: 31.8 },
        { strike: 5050, callVol: 25, putVol: 0, iv: 32.7 },
        { strike: 5100, callVol: 42, putVol: 0, iv: 33.6 },
        { strike: 5155, callVol: 30, putVol: 0, iv: 34.5 },
      ],
    };
  }

  /**
   * Column order used by content.js -> fetchOptionIvRows (TradingView scanner "options" market).
   */
  const SCANNER_IV_COLUMNS = ['expiration', 'strike', 'option-type', 'iv', 'root'];

  /**
   * Parse TradingView scanner options rows into per-series IV smiles.
   * Scanner IV is a DECIMAL (0.2068 = 20.68%) -> converted to percent here.
   * Call & put IV at the same strike are averaged.
   * @returns {Object<string, {exp:number, root:string, points:Array<{strike, iv}>}>} keyed by "exp|root"
   */
  function parseScannerOptionIvRows(json) {
    const out = {};
    const rows = json && Array.isArray(json.data) ? json.data : [];
    for (const row of rows) {
      const d = row && row.d;
      if (!Array.isArray(d)) continue;
      const exp = Number(d[0]);
      const strike = Number(d[1]);
      const ivDec = Number(d[3]);
      const root = String(d[4] || '');
      // Valid decimal IV range: (0, 3] i.e. up to 300%
      if (!(exp > 0) || !(strike > 0) || !(ivDec > 0) || ivDec > 3) continue;
      const key = `${exp}|${root}`;
      if (!out[key]) out[key] = { exp, root, _acc: {} };
      const acc = out[key]._acc;
      if (!acc[strike]) acc[strike] = { sum: 0, n: 0 };
      acc[strike].sum += ivDec * 100;
      acc[strike].n += 1;
    }
    for (const key of Object.keys(out)) {
      const acc = out[key]._acc;
      out[key].points = Object.keys(acc)
        .map((k) => ({ strike: Number(k), iv: acc[k].sum / acc[k].n }))
        .sort((a, b) => a.strike - b.strike);
      delete out[key]._acc;
    }
    return out;
  }

  /**
   * Sum call/put volume for one voi-lens series item.
   */
  function sumSeriesVolume(item) {
    let call = 0;
    let put = 0;
    for (const s of (item && item.strikes) || []) {
      call += Number(s.c?.v || 0);
      put += Number(s.p?.v || 0);
    }
    return { call, put };
  }

  return {
    calculateDteFromSeries,
    parseVoiLensSeries,
    processVoiLensPayload,
    extractPriceFromChainRow,
    extractUnderlyingInfoFromRow,
    find0DteStrike,
    extract0DteStrikeFromDom,
    scrapeTradingViewDom,
    getLive0DteGoldDemoData,
    getGoldCmeDemoData,
    SCANNER_IV_COLUMNS,
    parseScannerOptionIvRows,
    sumSeriesVolume,
  };
});

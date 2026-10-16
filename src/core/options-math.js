/**
 * src/core/options-math.js
 * Comprehensive Quantitative Options Math & CME Vol2Vol Engine
 * Includes First-Principles CME Vol Stl (Volatility Settlement) Engine,
 * 0 DTE Intraday Expected Move, Volume-Weighted Strikes, and Black-Scholes bands
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OptionsMath = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * CME QuikStrike Vol Stl (Volatility Settlement Smile) Model
   * Evaluates the exact implied volatility at strike K:
   * sigma(K) = sigma_ATM + skew * k + curvature * k^2
   * where k = ln(K / F) / (sigma_ATM * sqrt(T)) is normalized moneyness in standard deviations.
   *
   * Calibrated to CME QuikStrike Gold (OG|GC) Settlement Smile:
   * - skew (b) = 0.30%
   * - curvature (c) = 1.035%
   */
  function computeVolStl({ K, F, atmVol, T, skew = 0.30, curvature = 1.035 }) {
    const sigma = Math.max(Number(atmVol) || 20, 1) / 100;
    const safeT = Math.max(Number(T) || 0.0027, 0.0005);
    const stdDevMove = sigma * Math.sqrt(safeT);

    if (stdDevMove <= 0 || K <= 0 || F <= 0) return Number(atmVol);

    // Standardized moneyness in units of standard deviation
    const rawK = Math.log(K / F) / stdDevMove;

    // Wing dampening beyond 3.5 SD to keep Vol Stl smooth and realistic for deep OTM strikes
    const maxKsd = 3.5;
    let kEff;
    if (Math.abs(rawK) <= maxKsd) {
      kEff = rawK;
    } else {
      const sign = Math.sign(rawK);
      kEff = sign * (maxKsd + Math.log(1 + Math.abs(rawK) - maxKsd));
    }

    // CME QuikStrike Quadratic Volatility Smile
    const volStl = Number(atmVol) + skew * kEff + curvature * (kEff * kEff);
    return Math.max(Math.round(volStl * 100) / 100, 3.0);
  }

  /**
   * Calculate all volume metrics, weighted mean strikes, CME Std Dev bands,
   * and compute Vol Stl for every strike.
   *
   * @param {Object} options
   * @param {number} options.underlyingPrice - 0DTE Strike price / Anchor price (Future Stl)
   * @param {number} [options.spotPrice] - Real-time market spot price
   * @param {number} [options.openPrice] - Day's session open price
   * @param {number} [options.volAnchorPrice] - Stationary anchor for Vol Stl curve
   * @param {number} options.atmVolatility - Annualized ATM IV percentage (e.g. 23.58 or 23.66)
   * @param {number} options.dte - Days to expiration (0 = 0DTE intraday)
   * @param {Array<{strike: number, callVol: number, putVol: number, iv?: number}>} options.strikesData
   */
  function calculateStats({
    underlyingPrice = 0,
    spotPrice = null,
    openPrice = null,
    volAnchorPrice = null,
    atmVolatility = 23.58,
    dte = 0, // Default 0 DTE
    strikesData = [],
  }) {
    const S = Number(underlyingPrice) || 0;
    const S_spot = Number(spotPrice) > 100 ? Number(spotPrice) : S;
    const S_open = Number(openPrice) > 0 ? Number(openPrice) : S;
    const S_vol = Number(volAnchorPrice) > 100 ? Number(volAnchorPrice) : S;
    const sigma = Math.max(Number(atmVolatility) || 0.01, 0.01) / 100;
    const dteNum = Number(dte);

    // 0DTE Intraday handling: 1-day standard deviation move (T = 1 / 365)
    const is0DTE = dteNum === 0;
    const effectiveDays = is0DTE ? 1 : Math.max(dteNum, 0.1);
    const T = effectiveDays / 365;

    let totalCallVol = 0;
    let totalPutVol = 0;
    let weightedCallSum = 0;
    let weightedPutSum = 0;
    let weightedBothSum = 0;

    let maxCallVol = -1;
    let maxCallStrike = S;
    let maxPutVol = -1;
    let maxPutStrike = S;

    const sortedStrikes = [...strikesData].sort((a, b) => a.strike - b.strike);

    for (const row of sortedStrikes) {
      const k = Number(row.strike);
      const cv = Math.max(Number(row.callVol) || 0, 0);
      const pv = Math.max(Number(row.putVol) || 0, 0);

      totalCallVol += cv;
      totalPutVol += pv;
      weightedCallSum += k * cv;
      weightedPutSum += k * pv;
      weightedBothSum += k * (cv + pv);

      if (cv > maxCallVol) {
        maxCallVol = cv;
        maxCallStrike = k;
      }
      if (pv > maxPutVol) {
        maxPutVol = pv;
        maxPutStrike = k;
      }

      // Compute Vol Stl for this strike (anchored to S_vol so it stays stationary on real-time price ticks)
      row.volStl = computeVolStl({ K: k, F: S_vol, atmVol: atmVolatility, T });
    }

    const totalVol = totalCallVol + totalPutVol;
    const pcr = totalCallVol > 0 ? totalPutVol / totalCallVol : 0;
    const callPutRatio = totalPutVol > 0 ? totalCallVol / totalPutVol : 0;

    const meanCall = totalCallVol > 0 ? weightedCallSum / totalCallVol : S;
    const meanPut = totalPutVol > 0 ? weightedPutSum / totalPutVol : S;
    const meanBoth = totalVol > 0 ? weightedBothSum / totalVol : S;

    // Call / Put Dominance
    let dominance = 'NEUTRAL';
    let dominanceDiff = 0;
    let dominancePct = 0;

    if (totalVol > 0) {
      if (totalCallVol > totalPutVol) {
        dominance = 'CALLS';
        dominanceDiff = totalCallVol - totalPutVol;
        dominancePct = (dominanceDiff / totalVol) * 100;
      } else if (totalPutVol > totalCallVol) {
        dominance = 'PUTS';
        dominanceDiff = totalPutVol - totalCallVol;
        dominancePct = (dominanceDiff / totalVol) * 100;
      }
    }

    const callShare = totalVol > 0 ? (totalCallVol / totalVol) * 100 : 50;
    const putShare = totalVol > 0 ? (totalPutVol / totalVol) * 100 : 50;

    // CME Standard Deviation Ranges (-3, -2, -1, ATM/Center, +1, +2, +3)
    // Risk-neutral log-normal expected range: K_k = S * exp(-0.5*sigma^2*T + k*sigma*sqrt(T))
    const stdDevMove = sigma * Math.sqrt(T);
    const drift = -0.5 * sigma * sigma * T;

    // 1. Bands from Current Underlying Price (Future Stl)
    const stdDevRanges = {};
    for (let k = -3; k <= 3; k++) {
      const key = k === 0 ? 'ATM' : (k > 0 ? `+${k}` : `${k}`);
      if (k === 0) {
        stdDevRanges[key] = Math.round(S * 10) / 10;
      } else {
        const price = S * Math.exp(drift + k * stdDevMove);
        stdDevRanges[key] = Math.round(price * 10) / 10;
      }
    }

    const oneStdDevValue = S * stdDevMove;
    const oneStdDevPct = stdDevMove * 100;

    // 2. Bands from Day's Session Open Price
    const stdDevRangesFromOpen = {};
    for (let k = -3; k <= 3; k++) {
      const key = k === 0 ? 'Open' : (k > 0 ? `+${k}` : `${k}`);
      if (k === 0) {
        stdDevRangesFromOpen[key] = Math.round(S_open * 10) / 10;
      } else {
        const price = S_open * Math.exp(drift + k * stdDevMove);
        stdDevRangesFromOpen[key] = Math.round(price * 10) / 10;
      }
    }

    const oneStdDevFromOpenValue = S_open * stdDevMove;
    const oneStdDevFromOpenPct = stdDevMove * 100;

    return {
      underlyingPrice: S,
      spotPrice: Math.round(S_spot * 10) / 10,
      openPrice: Math.round(S_open * 10) / 10,
      volAnchorPrice: S_vol,
      atmVolatility: Number(atmVolatility),
      dte: dteNum,
      is0DTE,
      effectiveDays,
      T,
      totalCallVol,
      totalPutVol,
      totalVol,
      callShare: Math.round(callShare * 10) / 10,
      putShare: Math.round(putShare * 10) / 10,
      dominance,
      dominanceDiff,
      dominancePct: Math.round(dominancePct * 10) / 10,
      pcr: Math.round(pcr * 1000) / 1000,
      callPutRatio: Math.round(callPutRatio * 1000) / 1000,
      meanCall: Math.round(meanCall * 10) / 10,
      meanPut: Math.round(meanPut * 10) / 10,
      meanBoth: Math.round(meanBoth * 10) / 10,
      meanCallDistance: Math.round((meanCall - S) * 10) / 10,
      meanPutDistance: Math.round((meanPut - S) * 10) / 10,
      meanBothDistance: Math.round((meanBoth - S) * 10) / 10,
      maxCallStrike,
      maxCallVol,
      maxPutStrike,
      maxPutVol,
      stdDevRanges,
      oneStdDevValue: Math.round(oneStdDevValue * 10) / 10,
      oneStdDevPct: Math.round(oneStdDevPct * 100) / 100,
      stdDevRangesFromOpen,
      oneStdDevFromOpenValue: Math.round(oneStdDevFromOpenValue * 10) / 10,
      oneStdDevFromOpenPct: Math.round(oneStdDevFromOpenPct * 100) / 100,
      strikesData: sortedStrikes,
    };
  }

  /**
   * Probability Density Function for Expected Range Bell Curve
   */
  function lognormalPdf(K, S, sigma, T) {
    if (K <= 0 || S <= 0 || sigma <= 0 || T <= 0) return 0;
    const move = sigma * Math.sqrt(T);
    const m = Math.log(S) - 0.5 * sigma * sigma * T;
    const exponent = -Math.pow(Math.log(K) - m, 2) / (2 * move * move);
    return (1 / (K * move * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
  }

  /**
   * Generate Bell Curve coordinates scaled for drawing
   */
  function generateBellCurve({ S, atmVol, dte, minK, maxK, steps = 120 }) {
    const sigma = Math.max(Number(atmVol) || 20, 1) / 100;
    const dteNum = Number(dte);
    const effectiveDays = dteNum === 0 ? 1 : Math.max(dteNum, 0.1);
    const T = effectiveDays / 365;

    const stepSize = (maxK - minK) / (steps - 1);
    const points = [];
    let maxPdf = 0;

    for (let i = 0; i < steps; i++) {
      const k = minK + i * stepSize;
      const pdf = lognormalPdf(k, S, sigma, T);
      if (pdf > maxPdf) maxPdf = pdf;
      points.push({ strike: k, pdf });
    }

    return points.map((p) => ({
      strike: p.strike,
      normPdf: maxPdf > 0 ? p.pdf / maxPdf : 0,
    }));
  }

  /**
   * Generate dense Vol Stl (Implied Volatility Smile) curve coordinates
   * Uses CME QuikStrike first-principles model across [minK, maxK]
   */
  function generateVolSmile({ S, atmVol, dte, minK, maxK, steps = 100 }) {
    const dteNum = Number(dte);
    const effectiveDays = dteNum === 0 ? 1 : Math.max(dteNum, 0.1);
    const T = effectiveDays / 365;

    const stepSize = (maxK - minK) / (steps - 1);
    const curve = [];

    for (let i = 0; i < steps; i++) {
      const k = minK + i * stepSize;
      const iv = computeVolStl({ K: k, F: S, atmVol, T });
      curve.push({ strike: k, iv });
    }

    return curve;
  }

  /**
   * Convert 0DTE Support/Resistance Standard Deviation Ranges into a target asset's price perspective
   * (e.g. COMEX:GC1! continuous futures or OANDA:XAUUSD CFD) via additive basis spread shift.
   *
   * @param {Object} baseRanges - { '-3': ..., '-2': ..., '-1': ..., 'ATM': ..., '+1': ..., '+2': ..., '+3': ... }
   * @param {number} basePrice - Base 0DTE underlying price (Future Stl)
   * @param {number} targetPrice - Price of target asset (GC1! or XAUUSD)
   * @returns {{ diff: number, diffFormatted: string, targetPrice: number, ranges: Object } | null}
   */
  function computeConvertedRanges(baseRanges, basePrice, targetPrice) {
    const baseP = Number(basePrice);
    const targetP = Number(targetPrice);
    if (!baseRanges || isNaN(baseP) || baseP <= 0 || isNaN(targetP) || targetP <= 0) {
      return null;
    }

    const diff = Math.round((targetP - baseP) * 10) / 10;
    const sign = diff >= 0 ? '+' : '';
    const diffFormatted = `${sign}${diff.toFixed(1)}`;

    const converted = {};
    const keys = ['-3', '-2', '-1', 'ATM', 'Open', '+1', '+2', '+3'];
    for (const k of keys) {
      if (baseRanges[k] !== undefined) {
        const val = Number(baseRanges[k]);
        if (!isNaN(val)) {
          converted[k] = Math.round((val + diff) * 10) / 10;
        }
      }
    }

    return {
      diff,
      diffFormatted,
      targetPrice: targetP,
      ranges: converted,
    };
  }

  const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

  /**
   * Resolve option expiry timestamp (ms).
   * Prefers TradingView's exp_time (ISO with offset, e.g. "2026-10-07T16:59:59-04:00").
   * Fallback: 16:59:59 America/New_York on the YYYYMMDD date (DST-aware).
   * Verified: TradingView's published IV backs out best with this expiry time.
   */
  function resolveExpiryMs(expTime, expYmd) {
    if (expTime) {
      const t = Date.parse(expTime);
      if (!isNaN(t)) return t;
    }
    const s = String(expYmd || '').replace(/[^0-9]/g, '');
    if (s.length < 8) return NaN;
    const y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
    let offsetH = -5; // EST default
    try {
      const probe = new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
      const nyHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(probe));
      if (!isNaN(nyHour)) offsetH = nyHour - 17;
    } catch (e) { /* keep EST */ }
    return Date.UTC(y, m - 1, d, 16 - offsetH, 59, 59);
  }

  /**
   * ATM IV (percent) by linear interpolation in strike at the forward/futures price F.
   * points: [{ strike, iv }] with iv in percent. Call/put IV at the same strike should be pre-averaged.
   */
  function interpolateAtmIv(points, F) {
    const pts = (points || [])
      .filter((p) => p && p.strike > 0 && p.iv > 0 && isFinite(p.iv))
      .sort((a, b) => a.strike - b.strike);
    if (pts.length === 0 || !(F > 0)) return null;
    if (F <= pts[0].strike) return pts[0].iv;
    if (F >= pts[pts.length - 1].strike) return pts[pts.length - 1].iv;
    for (let i = 1; i < pts.length; i++) {
      const lo = pts[i - 1], hi = pts[i];
      if (F >= lo.strike && F <= hi.strike) {
        const w = hi.strike === lo.strike ? 0 : (F - lo.strike) / (hi.strike - lo.strike);
        return lo.iv + w * (hi.iv - lo.iv);
      }
    }
    return null;
  }

  /**
   * Compute effective trading year-fraction between two timestamps (startMs -> endMs),
   * excluding CME Globex weekend closure (48h per weekend: Friday 17:00 ET to Sunday 17:00 ET).
   *
   * Rationale:
   * TradingView quotes IV on a 365-day calendar basis, so total variance up to expiry is:
   *   V_i = sigma_i^2 * T_cal_i
   * Between two consecutive expiries (T_1 -> T_2), the incremental variance is V_2 - V_1.
   * On a Friday -> Monday interval, calendar time is 72h (3 days), but CME Gold only trades for
   * 24h (Sunday 18:00 ET -> Monday 17:00 ET). Dividing V_2 - V_1 by 3 calendar days dilutes
   * Monday's forward variance by sqrt(3) (~12.9% instead of ~22.3%).
   * Subtracting the 48h weekend closure yields the true trading-day Forward Volatility matching
   * CME Event Volatility Calculator (QuikStrike) business-day weighting.
   */
  function computeTradingYearDiff(startMs, endMs) {
    if (!(endMs > startMs)) return 0;
    const totalMs = endMs - startMs;

    // Step in 1-hour slices or exact interval overlap against UTC weekend windows.
    // Since options expire at 16:59:59 ET (~20:59:59 UTC in EDT / 21:59:59 UTC in EST),
    // CME weekend closure is Friday 17:00 ET -> Sunday 17:00 ET (exactly 48 hours = 172,800,000 ms).
    // Find each Friday in the UTC range and compute overlap with [Fri 17:00 ET, Sun 17:00 ET].
    const DAY_MS = 86400000;
    let weekendMs = 0;

    const firstDayUtc = Math.floor(startMs / DAY_MS) * DAY_MS - 2 * DAY_MS;
    const lastDayUtc = Math.ceil(endMs / DAY_MS) * DAY_MS + 2 * DAY_MS;

    for (let dayUtc = firstDayUtc; dayUtc <= lastDayUtc; dayUtc += DAY_MS) {
      const d = new Date(dayUtc);
      if (d.getUTCDay() !== 5) continue; // Only anchor on Fridays (5 = Friday)
      const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
      // Friday 16:59:59 ET resolved via DST-aware resolveExpiryMs (+1s = 17:00:00 ET)
      const friCloseMs = resolveExpiryMs(null, y * 10000 + m * 100 + day) + 1000;
      const sunOpenMs = friCloseMs + 2 * DAY_MS; // 48 hours later (Sunday 17:00:00 ET)

      const overlapStart = Math.max(startMs, friCloseMs);
      const overlapEnd = Math.min(endMs, sunOpenMs);
      if (overlapEnd > overlapStart) {
        weekendMs += overlapEnd - overlapStart;
      }
    }

    const activeMs = Math.max(totalMs - weekendMs, totalMs * 0.2); // safety floor
    return activeMs / MS_PER_YEAR;
  }

  /**
   * Vol Term Structure (CME Event Volatility Calculator equivalent).
   *
   * @param {Array<{id, exp, expTime, family, underlying, forward, ivPoints:[{strike, iv}], totalCallVol, totalPutVol, dte}>} series
   *        forward = price of that series' own underlying futures (e.g. GCZ2026), ivPoints iv in percent.
   * @param {{now?: number, calendarForward?: boolean}} opts
   * @returns {Array<{id, exp, family, underlying, forward, atmIV, T, hoursToExpiry, expectedMove, expectedMovePct,
   *                  forwardVol, forwardVolCalendar, forwardInverted, totalCallVol, totalPutVol, totalVol, dte}>} sorted by expiry
   *
   * Series Vol  = ATM IV interpolated at F
   * 1SD to Exp  = F * sigma * sqrt(T), T = exact year fraction to expiry
   * Forward Vol = sqrt((s2^2*T2 - s1^2*T1) / dT_trading) between consecutive expiries
   *               where dT_trading excludes CME weekend closure (Fri 17:00 ET -> Sun 17:00 ET)
   */
  function calculateSeriesVolTermStructure(series, opts = {}) {
    if (!Array.isArray(series) || series.length === 0) return [];
    const now = Number(opts.now) || Date.now();
    const rows = [];

    for (const s of series) {
      if (!s) continue;
      const expMs = resolveExpiryMs(s.expTime, s.exp);
      const F = Number(s.forward);
      if (!isFinite(expMs) || !(F > 0)) continue;
      const T = (expMs - now) / MS_PER_YEAR;
      if (!(T > 0)) continue; // expired series carry stale IV

      const atm = interpolateAtmIv(s.ivPoints, F);
      if (atm === null || !(atm > 0) || atm > 300) continue;

      const sigma = atm / 100;
      const sqrtT = Math.sqrt(T);
      const callV = Number(s.totalCallVol) || 0;
      const putV = Number(s.totalPutVol) || 0;
      rows.push({
        id: s.id || '',
        exp: String(s.exp || ''),
        expMs,
        family: s.family || '',
        underlying: s.underlying || '',
        forward: F,
        atmIV: Math.round(atm * 100) / 100,
        T,
        hoursToExpiry: (expMs - now) / 3600000,
        expectedMove: Math.round(F * sigma * sqrtT * 10) / 10,
        expectedMovePct: Math.round(sigma * sqrtT * 10000) / 100,
        forwardVol: null,
        forwardVolCalendar: null,
        forwardInverted: false,
        totalCallVol: callV,
        totalPutVol: putV,
        totalVol: callV + putV,
        dte: s.dte !== undefined ? s.dte : Math.floor((expMs - now) / 86400000),
        _sigma: sigma,
      });
    }

    rows.sort((a, b) => a.expMs - b.expMs);

    for (let i = 1; i < rows.length; i++) {
      const p = rows[i - 1], c = rows[i];
      const dTCal = c.T - p.T;
      if (!(dTCal > 1e-9)) continue;
      const dTTrading = opts.calendarForward
        ? dTCal
        : computeTradingYearDiff(p.expMs, c.expMs);
      const dT = dTTrading > 1e-9 ? dTTrading : dTCal;

      const varDiff = c._sigma * c._sigma * c.T - p._sigma * p._sigma * p.T;
      if (varDiff > 0) {
        c.forwardVol = Math.round(Math.sqrt(varDiff / dT) * 10000) / 100;
        c.forwardVolCalendar = Math.round(Math.sqrt(varDiff / dTCal) * 10000) / 100;
      } else {
        c.forwardInverted = true;
      }
    }

    rows.forEach((r) => { delete r._sigma; });
    return rows;
  }

  return {
    computeVolStl,
    calculateStats,
    generateBellCurve,
    generateVolSmile,
    computeConvertedRanges,
    calculateSeriesVolTermStructure,
    computeTradingYearDiff,
    resolveExpiryMs,
    interpolateAtmIv,
    lognormalPdf,
  };
});

/**
 * src/ui/vol2vol-chart.js
 * High-performance HTML5 Canvas renderer recreating the CME QuikStrike Vol2Vol™ Expected Range chart
 * Accurately renders Vol Stl (Volatility Settlement Smile), 0DTE & Multi-DTE ranges, and Volume Bars
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Vol2VolChart = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class Vol2VolChart {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.theme = options.theme || 'dark';
      this.stats = null;
      this.mousePos = { x: -1, y: -1 };

      this.padding = { top: 38, right: 65, bottom: 45, left: 60 };

      // Interactive SD Bands Overlay Configuration
      this.sdOverlayConfig = {
        showSd1: options.showSd1 !== undefined ? options.showSd1 : true,
        showSd2: options.showSd2 !== undefined ? options.showSd2 : true,
        showSd3: options.showSd3 !== undefined ? options.showSd3 : false,
        anchor: options.anchor || 'current', // 'current' | 'open' | 'both'
        showBellCurve: options.showBellCurve !== undefined ? options.showBellCurve : true,
      };

      // Strike Range Window Mode ('near5' | 'near3' | 'near10' | 'sd3' | 'all')
      this.strikeRangeMode = options.strikeRangeMode || 'near5';

      // Multi-Asset Perspective Configuration (0DTE GCV2026, GOLD.F, or XAUUSD)
      this.perspectiveConfig = {
        mode: options.perspectiveMode || '0dte', // '0dte' | 'goldf' | 'xau'
        basis: options.perspectiveBasis || 0,
        targetPrice: options.perspectiveTargetPrice || null,
        targetOpen: options.perspectiveTargetOpen || null,
        label: options.perspectiveLabel || '0DTE',
        color: options.perspectiveColor || '#f23645',
        convertedRanges: options.perspectiveRanges || null,
      };

      this.bindEvents();
    }

    setPerspective(config = {}) {
      this.perspectiveConfig = Object.assign(this.perspectiveConfig, config);
      this.render();
    }

    setStrikeRangeMode(mode) {
      this.strikeRangeMode = mode || 'near5';
      this.render();
    }

    setSdOverlayConfig(config = {}) {
      this.sdOverlayConfig = Object.assign(this.sdOverlayConfig, config);
      this.render();
    }

    setTheme(theme) {
      this.theme = theme;
      this.render();
    }

    bindEvents() {
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        this.render();
      });

      this.canvas.addEventListener('mouseleave', () => {
        this.mousePos = { x: -1, y: -1 };
        this.render();
      });
    }

    update(statsResult) {
      this.stats = statsResult;
      this.render();
    }

    getThemeColors() {
      const isDark = this.theme === 'dark';
      return {
        background: isDark ? '#131722' : '#ffffff',
        text: isDark ? '#d1d4dc' : '#1e222d',
        textMuted: isDark ? '#787b86' : '#8c919d',
        gridLine: isDark ? 'rgba(240, 243, 250, 0.08)' : 'rgba(42, 46, 57, 0.08)',
        callBar: '#2962ff',
        callBarHover: '#448aff',
        putBar: '#ff9800',
        putBarHover: '#ffa726',
        futureStlLine: '#f23645',
        openPriceLine: '#22c55e',
        volStlCurve: '#ff7043',
        bellCurveFill: isDark ? 'rgba(54, 98, 148, 0.20)' : 'rgba(180, 205, 235, 0.30)',
        bellCurveCore: isDark ? 'rgba(74, 138, 208, 0.28)' : 'rgba(160, 195, 235, 0.45)',
        tooltipBg: isDark ? '#1e222d' : '#f8f9fa',
        tooltipBorder: isDark ? '#363a45' : '#e0e3eb',
        tooltipText: isDark ? '#f0f3fa' : '#131722',
      };
    }

    resize() {
      const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
      const rect = this.canvas.getBoundingClientRect();
      const width = rect.width || 760;
      const height = rect.height || 380;

      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this.width = width;
      this.height = height;
    }

    render() {
      if (!this.stats || !this.stats.strikesData || this.stats.strikesData.length === 0) {
        return;
      }

      this.resize();
      const ctx = this.ctx;
      const colors = this.getThemeColors();
      const { width, height, padding } = this;

      const plotW = width - padding.left - padding.right;
      const plotH = height - padding.top - padding.bottom;

      // Clear Canvas
      ctx.fillStyle = colors.background;
      ctx.fillRect(0, 0, width, height);

      // Multi-Asset Perspective Shift (GOLD.F, XAUUSD, or 0DTE GCV2026)
      const isShifted = this.perspectiveConfig && this.perspectiveConfig.mode !== '0dte' && !isNaN(this.perspectiveConfig.basis);
      const basis = isShifted ? Number(this.perspectiveConfig.basis) : 0;

      const baseS = this.stats.underlyingPrice;
      const targetS = isShifted && this.perspectiveConfig.targetPrice
        ? Number(this.perspectiveConfig.targetPrice)
        : (baseS + basis);
      const S = isShifted ? targetS : baseS;

      const rawVolAnchor = (this.stats.volAnchorPrice && this.stats.volAnchorPrice > 100)
        ? this.stats.volAnchorPrice
        : baseS;
      const volAnchorS = isShifted ? (rawVolAnchor + basis) : rawVolAnchor;

      const rawOpen = (this.stats.openPrice && this.stats.openPrice > 100)
        ? this.stats.openPrice
        : null;
      const openPrice = isShifted
        ? (this.perspectiveConfig.targetOpen || (rawOpen ? rawOpen + basis : S))
        : rawOpen;

      // Active converted SD ranges
      const activeRanges = (isShifted && this.perspectiveConfig.convertedRanges)
        ? this.perspectiveConfig.convertedRanges
        : this.stats.stdDevRanges;

      // Shift all strikes by Basis
      const allStrikes = (this.stats.strikesData || [])
        .map((d) => {
          const k = Number(d.strike);
          return isShifted ? Math.round((k + basis) * 10) / 10 : k;
        })
        .filter((k) => !isNaN(k) && k > 0);

      if (allStrikes.length === 0) return;

      const minDataStrike = Math.min(...allStrikes);
      const maxDataStrike = Math.max(...allStrikes);

      // Ensure SD boundaries fit (anchored to volAnchorS / Open)
      const sd3Low = Math.min(
        activeRanges?.['-3'] || volAnchorS * 0.88,
        (this.stats.stdDevRangesFromOpen?.['-3'] ? this.stats.stdDevRangesFromOpen['-3'] + basis : volAnchorS * 0.88)
      );
      const sd3High = Math.max(
        activeRanges?.['+3'] || volAnchorS * 1.12,
        (this.stats.stdDevRangesFromOpen?.['+3'] ? this.stats.stdDevRangesFromOpen['+3'] + basis : volAnchorS * 1.12)
      );

      // Base anchor prices to always keep in view (volAnchorS and Day Open)
      const baseMin = Math.min(volAnchorS, (openPrice || volAnchorS));
      const baseMax = Math.max(volAnchorS, (openPrice || volAnchorS));

      let targetMin, targetMax;
      if (this.strikeRangeMode === 'near3') {
        // Near ±3% (Tight Intraday Focus)
        targetMin = baseMin * 0.97;
        targetMax = baseMax * 1.03;
      } else if (this.strikeRangeMode === 'near10') {
        // Near ±10% (Broad Range)
        targetMin = baseMin * 0.90;
        targetMax = baseMax * 1.10;
      } else if (this.strikeRangeMode === 'sd3') {
        // Statistical ±3 SD Range
        targetMin = sd3Low;
        targetMax = sd3High;
      } else if (this.strikeRangeMode === 'all') {
        // All strikes in dataset
        targetMin = Math.min(minDataStrike, sd3Low);
        targetMax = Math.max(maxDataStrike, sd3High);
      } else {
        // Default: 'near5' -> Near ±5% (ATM Focus)
        targetMin = baseMin * 0.95;
        targetMax = baseMax * 1.05;
      }

      // Add a clean 1.5% margin padding on left and right edges
      const strikeSpan = targetMax - targetMin || 100;
      const margin = strikeSpan * 0.015;

      // Snap to round 10-point boundaries so minStrike and maxStrike remain completely stationary on ticks
      const minStrike = Math.floor((targetMin - margin) / 10) * 10;
      const maxStrike = Math.ceil((targetMax + margin) / 10) * 10;

      // Filter visible strikes within range and attach originalStrike for tooltip
      const processedStrikesData = (this.stats.strikesData || []).map((d) => {
        const origK = Number(d.strike);
        const shiftK = isShifted ? Math.round((origK + basis) * 10) / 10 : origK;
        return {
          ...d,
          strike: shiftK,
          originalStrike: origK,
        };
      });

      let visibleStrikesData = processedStrikesData;
      if (this.strikeRangeMode !== 'all') {
        const filtered = processedStrikesData.filter((d) => {
          const k = Number(d.strike);
          return !isNaN(k) && k >= minStrike && k <= maxStrike;
        });
        if (filtered.length > 0) {
          visibleStrikesData = filtered;
        }
      }

      // Max Volume for Left Y-axis across visible strikes
      let maxVol = 0;
      for (const row of visibleStrikesData) {
        if (row.callVol > maxVol) maxVol = row.callVol;
        if (row.putVol > maxVol) maxVol = row.putVol;
      }
      maxVol = Math.max(Math.ceil((maxVol * 1.25) / 50) * 50, 50);

      // Calculate Vol Stl (Right Y-axis) Scale matching CME QuikStrike
      const atmVol = this.stats.atmVolatility;
      // Step of 3.0% (like CME: 21.00, 24.00, 27.00, 30.00, 33.00, 36.00)
      const ivStep = 3.0;
      const minIv = Math.floor((atmVol - 2.5) / ivStep) * ivStep;
      const maxIv = minIv + 5 * ivStep; // exactly 5 intervals = 6 ticks

      // Coordinate scaling functions
      const getX = (strike) => {
        return padding.left + ((strike - minStrike) / (maxStrike - minStrike)) * plotW;
      };

      const getYVol = (vol) => {
        return padding.top + plotH - (vol / maxVol) * plotH;
      };

      const getYIv = (iv) => {
        return padding.top + plotH - ((iv - minIv) / (maxIv - minIv)) * plotH;
      };

      // 1. Draw Grid Lines
      this.drawGrid(ctx, colors, padding, plotW, plotH, maxVol, minIv, maxIv, minStrike, maxStrike);

      // 2. Draw Selectable Standard Deviation Bands Overlay (1SD, 2SD, 3SD)
      this.drawStandardDeviationBands(ctx, colors, padding, plotW, plotH, getX, S, activeRanges, isShifted);

      // 3. Draw Expected Range Bell Curve (if enabled, anchored to volAnchorS or openPrice)
      if (this.sdOverlayConfig.showBellCurve !== false) {
        const anchor = this.sdOverlayConfig.anchor || 'current';
        const bellCenter = (anchor === 'open' && openPrice && openPrice > 0) ? openPrice : volAnchorS;
        const isOpenAnchor = anchor === 'open';
        this.drawExpectedRangeBellCurve(
          ctx,
          colors,
          padding,
          plotW,
          plotH,
          minStrike,
          maxStrike,
          getX,
          bellCenter,
          atmVol,
          this.stats.dte,
          isOpenAnchor
        );
      }

      // 4. Draw Volume Bars (Orange = Puts, Blue = Calls) across visible strikes with dynamic width
      this.drawVolumeBars(ctx, colors, visibleStrikesData, getX, getYVol, plotH, padding, minStrike, maxStrike, plotW);

      // 5. Draw Calculated Vol Stl (IV Smile Curve) anchored to volAnchorS so it stays stationary
      this.drawVolStlCurve(ctx, colors, minStrike, maxStrike, volAnchorS, atmVol, this.stats.dte, getX, getYIv, plotW, plotH, padding);

      // 6. Draw Open Price Line (Green Dotted Line) & Future Stl Line (Red/Amber/Cyan Dotted Line)
      if (openPrice && openPrice > 0) {
        this.drawOpenPriceLine(ctx, colors, padding, plotW, plotH, getX, openPrice, S);
      }
      this.drawFutureStlLine(ctx, colors, padding, plotW, plotH, getX, S, openPrice, isShifted);

      // 7. Interactive Tooltip
      this.drawTooltip(ctx, colors, padding, plotW, plotH, getX, visibleStrikesData, S, atmVol, this.stats.dte, activeRanges, basis, isShifted);
    }

    drawGrid(ctx, colors, padding, plotW, plotH, maxVol, minIv, maxIv, minStrike, maxStrike) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.gridLine;
      ctx.fillStyle = colors.textMuted;
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      // Horizontal volume & Vol Stl grid lines (5 intervals = 6 ticks)
      const numSteps = 5;
      for (let i = 0; i <= numSteps; i++) {
        const ratio = i / numSteps;
        const y = padding.top + plotH * (1 - ratio);
        const volVal = Math.round(maxVol * ratio);
        const ivVal = (minIv + ratio * (maxIv - minIv)).toFixed(2);

        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + plotW, y);
        ctx.stroke();

        // Left Y (Volume)
        ctx.textAlign = 'right';
        ctx.fillText(volVal.toLocaleString(), padding.left - 8, y + 4);

        // Right Y (Vol Stl %)
        ctx.textAlign = 'left';
        ctx.fillText(ivVal, padding.left + plotW + 8, y + 4);
      }

      // X Grid lines (Strikes) with intelligent round tick intervals
      const rawSpan = maxStrike - minStrike;
      const targetTicks = Math.max(5, Math.min(8, Math.floor(plotW / 90)));
      const rawStep = rawSpan / targetTicks;
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
      const norm = rawStep / magnitude;
      let cleanStep;
      if (norm < 1.5) cleanStep = 1 * magnitude;
      else if (norm < 3.5) cleanStep = 2.5 * magnitude;
      else if (norm < 7.5) cleanStep = 5 * magnitude;
      else cleanStep = 10 * magnitude;

      const firstTick = Math.ceil(minStrike / cleanStep) * cleanStep;
      for (let tick = firstTick; tick <= maxStrike; tick += cleanStep) {
        const x = padding.left + ((tick - minStrike) / rawSpan) * plotW;
        if (x >= padding.left + 15 && x <= padding.left + plotW - 15) {
          ctx.beginPath();
          ctx.setLineDash([2, 3]);
          ctx.moveTo(x, padding.top);
          ctx.lineTo(x, padding.top + plotH);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.textAlign = 'center';
          ctx.fillText(tick.toLocaleString(), x, padding.top + plotH + 20);
        }
      }
    }

    drawStandardDeviationBands(ctx, colors, padding, plotW, plotH, getX, S, activeRanges, isShifted) {
      if (!this.stats) return;

      const { showSd1, showSd2, showSd3, anchor } = this.sdOverlayConfig;
      if (!showSd1 && !showSd2 && !showSd3) return;

      const isDark = this.theme === 'dark';
      const clampX = (x) => Math.max(padding.left, Math.min(padding.left + plotW, x));
      const mode = this.perspectiveConfig?.mode || '0dte';
      const basis = isShifted ? Number(this.perspectiveConfig.basis || 0) : 0;

      const renderBandSet = (ranges, type) => {
        if (!ranges) return;

        const isCurrent = type === 'current';
        let bandColors;
        if (!isCurrent) {
          bandColors = {
            sd1Fill: isDark ? 'rgba(34, 197, 94, 0.22)' : 'rgba(34, 197, 94, 0.15)',
            sd2Fill: isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.08)',
            sd3Fill: isDark ? 'rgba(16, 185, 129, 0.07)' : 'rgba(16, 185, 129, 0.05)',
            lineColor: isDark ? 'rgba(74, 222, 128, 0.45)' : 'rgba(22, 163, 74, 0.40)',
            textColor: isDark ? '#4ade80' : '#15803d',
            tagPrefix: 'Op ',
          };
        } else if (isShifted && mode === 'goldf') {
          bandColors = {
            sd1Fill: isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.15)',
            sd2Fill: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
            sd3Fill: isDark ? 'rgba(217, 119, 6, 0.07)' : 'rgba(217, 119, 6, 0.05)',
            lineColor: isDark ? 'rgba(251, 191, 36, 0.45)' : 'rgba(217, 119, 6, 0.40)',
            textColor: isDark ? '#fbbf24' : '#d97706',
            tagPrefix: 'GF ',
          };
        } else if (isShifted && mode === 'xau') {
          bandColors = {
            sd1Fill: isDark ? 'rgba(6, 182, 212, 0.22)' : 'rgba(6, 182, 212, 0.15)',
            sd2Fill: isDark ? 'rgba(6, 182, 212, 0.12)' : 'rgba(6, 182, 212, 0.08)',
            sd3Fill: isDark ? 'rgba(8, 145, 178, 0.07)' : 'rgba(8, 145, 178, 0.05)',
            lineColor: isDark ? 'rgba(34, 211, 238, 0.45)' : 'rgba(8, 145, 178, 0.40)',
            textColor: isDark ? '#22d3ee' : '#0891b2',
            tagPrefix: 'XAU ',
          };
        } else {
          bandColors = {
            sd1Fill: isDark ? 'rgba(41, 98, 255, 0.22)' : 'rgba(41, 98, 255, 0.15)',
            sd2Fill: isDark ? 'rgba(41, 98, 255, 0.12)' : 'rgba(41, 98, 255, 0.08)',
            sd3Fill: isDark ? 'rgba(99, 102, 241, 0.07)' : 'rgba(99, 102, 241, 0.05)',
            lineColor: isDark ? 'rgba(68, 138, 255, 0.45)' : 'rgba(33, 82, 214, 0.40)',
            textColor: isDark ? '#82b1ff' : '#1e53e5',
            tagPrefix: '',
          };
        }

        const sd3L = ranges['-3'] != null ? clampX(getX(ranges['-3'])) : null;
        const sd2L = ranges['-2'] != null ? clampX(getX(ranges['-2'])) : null;
        const sd1L = ranges['-1'] != null ? clampX(getX(ranges['-1'])) : null;
        const sd1H = ranges['+1'] != null ? clampX(getX(ranges['+1'])) : null;
        const sd2H = ranges['+2'] != null ? clampX(getX(ranges['+2'])) : null;
        const sd3H = ranges['+3'] != null ? clampX(getX(ranges['+3'])) : null;

        // 1. Shaded Background Zones (Modular Layering)
        // Zone 3: [-3 to -2] and [+2 to +3]
        if (showSd3 && sd3L != null && sd3H != null && sd2L != null && sd2H != null) {
          ctx.fillStyle = bandColors.sd3Fill;
          if (sd2L > sd3L) ctx.fillRect(sd3L, padding.top, sd2L - sd3L, plotH);
          if (sd3H > sd2H) ctx.fillRect(sd2H, padding.top, sd3H - sd2H, plotH);
        }

        // Zone 2: [-2 to -1] and [+1 to +2]
        if (showSd2 && sd2L != null && sd2H != null && sd1L != null && sd1H != null) {
          ctx.fillStyle = bandColors.sd2Fill;
          if (sd1L > sd2L) ctx.fillRect(sd2L, padding.top, sd1L - sd2L, plotH);
          if (sd2H > sd1H) ctx.fillRect(sd1H, padding.top, sd2H - sd1H, plotH);
        }

        // Zone 1: [-1 to +1]
        if (showSd1 && sd1L != null && sd1H != null) {
          ctx.fillStyle = bandColors.sd1Fill;
          if (sd1H > sd1L) ctx.fillRect(sd1L, padding.top, sd1H - sd1L, plotH);
        }

        // 2. Boundary Lines & Top Tag Labels
        ctx.save();
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = bandColors.lineColor;
        ctx.fillStyle = bandColors.textColor;
        ctx.font = '9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';

        const drawBoundary = (x, label) => {
          if (x == null || x <= padding.left || x >= padding.left + plotW) return;
          ctx.beginPath();
          ctx.moveTo(x, padding.top);
          ctx.lineTo(x, padding.top + plotH);
          ctx.stroke();

          // Header tag indicator at top
          ctx.fillText(label, x, padding.top + 12);
        };

        if (showSd1) {
          if (sd1L != null) drawBoundary(sd1L, `${bandColors.tagPrefix}-1σ`);
          if (sd1H != null) drawBoundary(sd1H, `${bandColors.tagPrefix}+1σ`);
        }

        if (showSd2) {
          if (sd2L != null) drawBoundary(sd2L, `${bandColors.tagPrefix}-2σ`);
          if (sd2H != null) drawBoundary(sd2H, `${bandColors.tagPrefix}+2σ`);
        }

        if (showSd3) {
          if (sd3L != null) drawBoundary(sd3L, `${bandColors.tagPrefix}-3σ`);
          if (sd3H != null) drawBoundary(sd3H, `${bandColors.tagPrefix}+3σ`);
        }

        ctx.restore();
      };

      const openRanges = (isShifted && this.stats.stdDevRangesFromOpen)
        ? Object.fromEntries(
            Object.entries(this.stats.stdDevRangesFromOpen).map(([k, v]) => [k, v != null ? v + basis : null])
          )
        : this.stats.stdDevRangesFromOpen;

      const currentRanges = activeRanges || this.stats.stdDevRanges;

      if (anchor === 'open') {
        renderBandSet(openRanges, 'open');
      } else if (anchor === 'both') {
        renderBandSet(currentRanges, 'current');
        if (openRanges) {
          renderBandSet(openRanges, 'open');
        }
      } else {
        renderBandSet(currentRanges, 'current');
      }
    }

    drawExpectedRangeBellCurve(ctx, colors, padding, plotW, plotH, minStrike, maxStrike, getX, S, atmVol, dte, isOpenAnchor = false) {
      if (typeof OptionsMath === 'undefined') return;

      const bellPoints = OptionsMath.generateBellCurve({
        S,
        atmVol,
        dte,
        minK: minStrike,
        maxK: maxStrike,
        steps: 120,
      });

      if (!bellPoints || bellPoints.length === 0) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(padding.left, padding.top, plotW, plotH);
      ctx.clip();

      const baseY = padding.top + plotH;
      const peakHeight = plotH * 0.90;

      // Draw smoothed Bell Curve
      ctx.beginPath();
      ctx.moveTo(getX(bellPoints[0].strike), baseY);

      for (const pt of bellPoints) {
        const x = getX(pt.strike);
        const y = baseY - pt.normPdf * peakHeight;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(getX(bellPoints[bellPoints.length - 1].strike), baseY);
      ctx.closePath();

      const isDark = this.theme === 'dark';
      const grad = ctx.createLinearGradient(0, padding.top, 0, baseY);
      if (isOpenAnchor) {
        grad.addColorStop(0, isDark ? 'rgba(34, 197, 94, 0.22)' : 'rgba(34, 197, 94, 0.18)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = isDark ? 'rgba(74, 222, 128, 0.40)' : 'rgba(34, 197, 94, 0.45)';
      } else {
        grad.addColorStop(0, colors.bellCurveFill);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = colors.bellCurveCore;
      }
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    drawVolumeBars(ctx, colors, strikesData, getX, getYVol, plotH, padding, minStrike, maxStrike, plotW) {
      if (!strikesData || strikesData.length === 0) return;

      const baseY = padding.top + plotH;

      // Dynamically compute optimal bar width based on strike density
      const sortedStrikes = strikesData
        .map((d) => d.strike)
        .filter((k) => k != null && !isNaN(k))
        .sort((a, b) => a - b);

      let minPxDiff = Infinity;
      for (let i = 1; i < sortedStrikes.length; i++) {
        const diff = sortedStrikes[i] - sortedStrikes[i - 1];
        if (diff > 0) {
          const px = (diff / (maxStrike - minStrike)) * plotW;
          if (px < minPxDiff) minPxDiff = px;
        }
      }

      // Allow bar width to scale comfortably between 1.5px (dense/all) and 7.5px (near range)
      let barW = 4.0;
      if (minPxDiff !== Infinity && minPxDiff > 0) {
        barW = Math.max(1.5, Math.min(7.5, Math.floor(minPxDiff * 0.38 * 10) / 10));
      }
      const gap = barW >= 2.0 ? 0.5 : 0;

      ctx.save();
      ctx.beginPath();
      ctx.rect(padding.left, padding.top, plotW, plotH);
      ctx.clip();

      for (const row of strikesData) {
        const cx = Math.round(getX(row.strike));

        // Put Bar (Orange)
        if (row.putVol > 0) {
          const putY = Math.round(getYVol(row.putVol));
          const putH = Math.max(1, baseY - putY);
          ctx.fillStyle = colors.putBar;
          ctx.fillRect(cx - barW - gap, putY, barW, putH);
        }

        // Call Bar (Blue)
        if (row.callVol > 0) {
          const callY = Math.round(getYVol(row.callVol));
          const callH = Math.max(1, baseY - callY);
          ctx.fillStyle = colors.callBar;
          ctx.fillRect(cx + gap, callY, barW, callH);
        }
      }

      ctx.restore();
    }

    drawVolStlCurve(ctx, colors, minStrike, maxStrike, S, atmVol, dte, getX, getYIv, plotW, plotH, padding) {
      if (typeof OptionsMath === 'undefined') return;

      const curvePoints = OptionsMath.generateVolSmile({
        S,
        atmVol,
        dte,
        minK: minStrike,
        maxK: maxStrike,
        steps: 120,
      });

      if (!curvePoints || curvePoints.length === 0) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(padding.left, padding.top, plotW, plotH);
      ctx.clip();

      ctx.beginPath();
      ctx.strokeStyle = colors.volStlCurve;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < curvePoints.length; i++) {
        const pt = curvePoints[i];
        const x = getX(pt.strike);
        const y = getYIv(pt.iv);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    drawOpenPriceLine(ctx, colors, padding, plotW, plotH, getX, openPrice, S) {
      const x = getX(openPrice);
      if (x < padding.left || x > padding.left + plotW) return;

      ctx.save();
      ctx.strokeStyle = colors.openPriceLine;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);

      ctx.beginPath();
      ctx.moveTo(x, padding.top - 5);
      ctx.lineTo(x, padding.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = colors.openPriceLine;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';

      // If openPrice and S are very close, stagger Y position so labels do not overlap
      const sX = getX(S);
      const isClose = Math.abs(x - sX) < 45;
      const labelY = isClose ? padding.top - 20 : padding.top - 10;
      ctx.fillText(`Open ${openPrice.toFixed(1)}`, x, labelY);
      ctx.restore();
    }

    drawFutureStlLine(ctx, colors, padding, plotW, plotH, getX, S, openPrice, isShifted) {
      const x = getX(S);
      if (x < padding.left || x > padding.left + plotW) return;

      const mode = this.perspectiveConfig?.mode || '0dte';
      const isShift = isShifted || (this.perspectiveConfig && mode !== '0dte');
      const label = isShift
        ? `${this.perspectiveConfig.label || 'Stl'} ${S.toFixed(1)}`
        : `Stl ${S.toFixed(1)}`;
      const lineColor = isShift && this.perspectiveConfig?.color
        ? this.perspectiveConfig.color
        : colors.futureStlLine;

      ctx.save();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);

      ctx.beginPath();
      ctx.moveTo(x, padding.top - 5);
      ctx.lineTo(x, padding.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = lineColor;
      ctx.font = 'bold 10.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, padding.top - 8);
      ctx.restore();
    }

    drawTooltip(ctx, colors, padding, plotW, plotH, getX, visibleStrikesData, S, atmVol, dte, activeRanges, basis = 0, isShifted = false) {
      if (this.mousePos.x < padding.left || this.mousePos.x > padding.left + plotW) return;
      if (this.mousePos.y < padding.top || this.mousePos.y > padding.top + plotH) return;

      let nearestRow = null;
      let minDistance = Infinity;

      for (const row of visibleStrikesData) {
        const x = getX(row.strike);
        const dist = Math.abs(x - this.mousePos.x);
        if (dist < minDistance) {
          minDistance = dist;
          nearestRow = row;
        }
      }

      if (!nearestRow || minDistance > 30) return;

      const strikeX = getX(nearestRow.strike);

      // Strike guideline
      ctx.strokeStyle = colors.textMuted;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(strikeX, padding.top);
      ctx.lineTo(strikeX, padding.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      const diffFromAtm = nearestRow.strike - S;
      const diffStr = (diffFromAtm >= 0 ? '+' : '') + diffFromAtm.toFixed(1);
      const diffPct = ((diffFromAtm / S) * 100).toFixed(2);

      // Exact Vol Stl for this strike
      const safeDte = Number(dte) === 0 ? 1 : Math.max(Number(dte), 0.1);
      const volStlVal = OptionsMath.computeVolStl({
        K: nearestRow.strike,
        F: S,
        atmVol,
        T: safeDte / 365,
      });

      const basisNum = Number(basis) || 0;
      const basisSign = basisNum >= 0 ? `+${basisNum.toFixed(1)}` : basisNum.toFixed(1);

      let strikeLine;
      if (isShifted && nearestRow.originalStrike != null) {
        strikeLine = `Strike: ${nearestRow.strike.toLocaleString()} (0DTE ${nearestRow.originalStrike.toLocaleString()} | Basis ${basisSign})`;
      } else {
        strikeLine = `Strike: ${nearestRow.strike.toLocaleString()} (${diffStr} | ${diffPct}%)`;
      }

      const lines = [
        strikeLine,
        `Calls: ${nearestRow.callVol.toLocaleString()}`,
        `Puts: ${nearestRow.putVol.toLocaleString()}`,
        `Vol Stl: ${volStlVal.toFixed(2)}%`,
      ];

      // SD Zone detection
      const activeAnchor = this.sdOverlayConfig.anchor === 'open' ? 'open' : 'current';
      const refRanges = (activeAnchor === 'open')
        ? ((isShifted && this.stats.stdDevRangesFromOpen)
            ? Object.fromEntries(
                Object.entries(this.stats.stdDevRangesFromOpen).map(([k, v]) => [k, v != null ? v + basisNum : null])
              )
            : this.stats.stdDevRangesFromOpen)
        : (activeRanges || this.stats.stdDevRanges);

      if (refRanges) {
        const k = nearestRow.strike;
        const sd1L = refRanges['-1'];
        const sd1H = refRanges['+1'];
        const sd2L = refRanges['-2'];
        const sd2H = refRanges['+2'];
        const sd3L = refRanges['-3'];
        const sd3H = refRanges['+3'];

        let zoneLbl = '';
        if (sd1L != null && sd1H != null && k >= sd1L && k <= sd1H) {
          zoneLbl = 'Zone: ±1 SD (68.3% Prob)';
        } else if (sd2L != null && sd2H != null && ((k >= sd2L && k < sd1L) || (k > sd1H && k <= sd2H))) {
          zoneLbl = 'Zone: ±2 SD (95.4% Prob)';
        } else if (sd3L != null && sd3H != null && ((k >= sd3L && k < sd2L) || (k > sd2H && k <= sd3H))) {
          zoneLbl = 'Zone: ±3 SD (99.7% Prob)';
        } else if ((sd3L != null && k < sd3L) || (sd3H != null && k > sd3H)) {
          zoneLbl = 'Zone: Beyond 3 SD (>99.7%)';
        }

        if (zoneLbl) {
          lines.push(zoneLbl);
        }
      }

      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const boxW = isShifted ? 255 : 180;
      const boxH = lines.length * 18 + 12;

      let boxX = strikeX + 15;
      if (boxX + boxW > padding.left + plotW) {
        boxX = strikeX - boxW - 15;
      }
      let boxY = Math.max(this.mousePos.y - boxH / 2, padding.top + 10);

      ctx.fillStyle = colors.tooltipBg;
      ctx.strokeStyle = colors.tooltipBorder;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      lines.forEach((line, idx) => {
        if (idx === 0) {
          ctx.fillStyle = colors.tooltipText;
          ctx.font = 'bold 12px sans-serif';
        } else if (line.startsWith('Calls:')) {
          ctx.fillStyle = colors.callBarHover;
          ctx.font = '12px sans-serif';
        } else if (line.startsWith('Puts:')) {
          ctx.fillStyle = colors.putBarHover;
          ctx.font = '12px sans-serif';
        } else if (line.startsWith('Vol Stl:')) {
          ctx.fillStyle = colors.volStlCurve;
          ctx.font = 'bold 12px sans-serif';
        } else if (line.startsWith('Zone:')) {
          const mode = this.perspectiveConfig?.mode || '0dte';
          let zoneColor = '#82b1ff';
          if (activeAnchor === 'open') zoneColor = '#4ade80';
          else if (isShifted && mode === 'goldf') zoneColor = '#fbbf24';
          else if (isShifted && mode === 'xau') zoneColor = '#22d3ee';
          ctx.fillStyle = zoneColor;
          ctx.font = 'bold 11px sans-serif';
        } else {
          ctx.fillStyle = colors.tooltipText;
          ctx.font = '12px sans-serif';
        }
        ctx.fillText(line, boxX + 10, boxY + 20 + idx * 18);
      });
    }
  }

  return Vol2VolChart;
});

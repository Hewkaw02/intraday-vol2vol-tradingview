/**
 * src/ui/overlay-panel.js
 * Injected floating dashboard UI and controller for TradingView
 * Supports DTE Selection (0DTE default), calculated Vol Stl (IV) smile, series switcher, and data inspector
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OverlayPanel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MaterialIcons = {
    candlestick: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 3h2v3h2v10H9v5H7v-5H5V6h2V3zm10 0h2v7h2v6h-2v5h-2v-5h-2v-6h2V3z"/></svg>`,
    analytics: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-5h2v5zm4 0h-2v-8h2v8zm4 0h-2v-3h2v3z"/></svg>`,
    tableChart: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M10 10.02h5V21h-5zM17 21h3c1.1 0 2-.9 2-2v-9h-5v11zm3-18H4c-1.1 0-2 .9-2 2v3h20V5c0-1.1-.9-2-2-2zM2 19c0 1.1.9 2 2 2h4V10.02H2V19z"/></svg>`,
    darkMode: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>`,
    lightMode: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>`,
    remove: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>`,
    add: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
    sync: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`,
    tune: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>`,
    contentCopy: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
    showChart: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>`,
    toll: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M15 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zM3 12c0-2.61 1.67-4.83 4-5.65V4.26C3.55 5.15 1 8.27 1 12s2.55 6.85 6 7.74v-2.09c-2.33-.82-4-3.04-4-5.65z"/></svg>`,
    currencyExchange: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12.89 11.1c-1.78-.59-2.64-.96-2.64-1.9 0-1.02 1.11-1.39 1.81-1.39 1.31 0 1.79.99 1.9 1.34l1.58-.67c-.15-.44-.82-1.91-2.66-2.23V5h-1.75v1.26c-2.6.56-2.62 2.85-2.62 2.96 0 2.27 2.21 2.88 3.14 3.16 1.77.53 2.13 1.02 2.13 1.73 0 1.06-1.05 1.57-1.98 1.57-.96 0-1.83-.57-2.09-1.64l-1.61.66c.58 1.62 1.57 2.33 3.03 2.56V19h1.75v-1.73c.7-.12 2.85-.78 2.85-3.15 0-1.6-.8-2.67-2.84-3.42z"/></svg>`,
    eventNote: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M17 10H7v2h10v-2zm2-7h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-5-5H7v2h7v-2z"/></svg>`,
    compareArrows: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M9.01 14H2v2h7.01v3L13 15l-3.99-4v3zm5.98-1v-3H22V8h-7.01V5L11 9l3.99 4z"/></svg>`,
    openInNew: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>`,
    dashboard: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>`,
  };

  class OverlayPanel {
    constructor(options = {}) {
      this.container = null;
      this.chart = null;
      this.isMinimized = false;
      this.showRawTable = false;
      this.theme = options.theme || 'dark';
      this.currentData = null;
      this.fullVoiLensPayload = null;
      this.termStructureData = [];
      this.termStructureMeta = {};
      this.selectedDteMode = '0'; // Default 0 DTE!
      this.strikeRangeMode = 'near5'; // Default Near ±5%!
      this.activePerspective = '0dte'; // '0dte' | 'goldf' | 'xau'
      this.latestConvertedGc1 = null;
      this.latestConvertedXau = null;
      this.onParameterChange = options.onParameterChange || null;

      this.init();
    }

    init() {
      if (document.getElementById('cme-vol2vol-root')) {
        this.container = document.getElementById('cme-vol2vol-root');
        return;
      }

      this.container = document.createElement('div');
      this.container.id = 'cme-vol2vol-root';
      this.container.className = `cme-v2v-theme-${this.theme}`;
      this.container.innerHTML = this.getTemplate();
      document.body.appendChild(this.container);

      this.bindDOMElements();
      this.bindEvents();
      this.makeDraggable();

      const canvas = this.container.querySelector('#cme-v2v-canvas');
      if (canvas && typeof Vol2VolChart !== 'undefined') {
        this.chart = new Vol2VolChart(canvas, { theme: this.theme });
        this.loadSdOverlayPreferences();
      }
    }

    getTemplate() {
      return `
        <!-- Floating Launcher Toggle Pill -->
        <button id="cme-v2v-launcher" class="cme-v2v-launcher-btn" title="CME Vol2Vol Options Intelligence">
          <span class="cme-v2v-launcher-icon">${MaterialIcons.candlestick}</span>
          <span class="cme-v2v-launcher-text">CME Vol2Vol (0DTE)</span>
        </button>

        <!-- Main Floating Window -->
        <div id="cme-v2v-modal" class="cme-v2v-window">
          <!-- Window Header -->
          <div class="cme-v2v-header" id="cme-v2v-drag-handle">
            <div class="cme-v2v-header-title">
              <span class="cme-v2v-logo">${MaterialIcons.analytics}</span>
              <strong id="cme-v2v-title-text">COMEX:GCV2026 Vol2Vol™ Expected Range</strong>
              <span class="cme-v2v-badge-tag cme-v2v-live-badge" id="cme-v2v-source-badge">
                <span class="cme-v2v-live-dot"></span>
                <span id="cme-v2v-badge-label">REALTIME 0DTE</span>
              </span>
            </div>
            <div class="cme-v2v-header-actions">
              <button class="cme-v2v-btn-icon" id="cme-v2v-readme-btn" title="Open README &amp; User Guide">${MaterialIcons.help || `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>`}</button>
              <button class="cme-v2v-btn-icon" id="cme-v2v-dash-btn" title="Open Full Widescreen Dashboard in New Tab">${MaterialIcons.openInNew}</button>
              <button class="cme-v2v-btn-icon" id="cme-v2v-table-toggle-btn" title="Toggle Raw Strikes & Vol Stl Inspector">${MaterialIcons.tableChart}</button>
              <button class="cme-v2v-btn-icon" id="cme-v2v-theme-btn" title="Toggle Theme">${this.theme === 'dark' ? MaterialIcons.lightMode : MaterialIcons.darkMode}</button>
              <button class="cme-v2v-btn-icon" id="cme-v2v-minimize-btn" title="Minimize to Compact Bar">${MaterialIcons.remove}</button>
              <button class="cme-v2v-btn-icon cme-v2v-btn-close" id="cme-v2v-close-btn" title="Close">${MaterialIcons.close}</button>
            </div>
          </div>

          <!-- Compact Mini-HUD (Visible only when minimized for easy reading) -->
          <div class="cme-v2v-mini-hud" id="cme-v2v-mini-hud" style="display: none;" title="Click to expand Full Dashboard">
            <div class="cme-v2v-mini-item">
              <span class="cme-v2v-mini-lbl">FUTURE STL</span>
              <strong class="cme-v2v-mini-val cme-v2v-price-text" id="cme-v2v-mini-price">--</strong>
            </div>
            <div class="cme-v2v-mini-divider"></div>
            <div class="cme-v2v-mini-item">
              <span class="cme-v2v-mini-lbl">1SD RANGE</span>
              <strong class="cme-v2v-mini-val" id="cme-v2v-mini-1sd" style="color: #60a5fa;">--</strong>
            </div>
            <div class="cme-v2v-mini-divider"></div>
            <div class="cme-v2v-mini-item">
              <span class="cme-v2v-mini-lbl">DOMINANCE</span>
              <strong class="cme-v2v-mini-val" id="cme-v2v-mini-dom">--</strong>
            </div>
            <div class="cme-v2v-mini-divider"></div>
            <div class="cme-v2v-mini-item">
              <span class="cme-v2v-mini-lbl">EXPIRY</span>
              <strong class="cme-v2v-mini-val" id="cme-v2v-mini-dte" style="color: #f59e0b;">0 DTE</strong>
            </div>
            <div class="cme-v2v-mini-expand-hint">
              <span>Full ↗</span>
            </div>
          </div>

          <!-- Window Body -->
          <div class="cme-v2v-body" id="cme-v2v-body-content">
            <!-- Header Subtitle & Metric Banner -->
            <div class="cme-v2v-headline" id="cme-v2v-headline-text">
              COMEX:GC1! Vol2Vol™ Expected Range (0 DTE Intraday) vs 4347.4 at 23.58% Volatility
            </div>

            <!-- CME Std Dev Ranges Table -->
            <div class="cme-v2v-stddev-section">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div class="cme-v2v-table-title" style="margin-bottom: 0;">Standard Deviation Expected Ranges (1SD, 2SD, 3SD)</div>
                <div id="cme-v2v-expected-move-summary" style="font-size: 11px; color: #787b86;">
                  1SD Move: ±$53.8 (1.24%)
                </div>
              </div>
              <div class="cme-v2v-table-wrap">
                <table class="cme-v2v-table" id="cme-v2v-table-ranges">
                  <thead>
                    <tr>
                      <th style="text-align: left; padding-left: 10px; width: 130px;">Reference Anchor</th>
                      <th>-3 SD</th>
                      <th>-2 SD</th>
                      <th>-1 SD</th>
                      <th class="cme-v2v-th-atm">Center / Base</th>
                      <th>+1 SD</th>
                      <th>+2 SD</th>
                      <th>+3 SD</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr id="cme-v2v-ranges-current-row" class="cme-v2v-ranges-row-selectable cme-v2v-ranges-row-active" title="Click to anchor SD chart overlay to 0DTE Future Stl">
                      <td style="text-align: left; padding-left: 10px; font-weight: 600; color: #f23645;">
                        <span id="cme-v2v-lbl-stl-row">0DTE Stl (GCV2026)</span>
                      </td>
                      <td>--</td>
                      <td>--</td>
                      <td>--</td>
                      <td class="cme-v2v-td-atm">--</td>
                      <td>--</td>
                      <td>--</td>
                      <td>--</td>
                    </tr>
                    <tr id="cme-v2v-ranges-gc1-row" class="cme-v2v-ranges-row-selectable cme-v2v-row-gc1" title="Gold Futures Continuous (BLACKBULL:GOLD.F / COMEX:GC1!) Basis Spread Shift">
                      <td style="text-align: left; padding-left: 10px; font-weight: 600; color: #f59e0b;">
                        <span>GOLD.F</span>
                        <span class="cme-v2v-diff-badge" id="cme-v2v-diff-gc1">Basis: --</span>
                      </td>
                      <td>--</td>
                      <td>--</td>
                      <td>--</td>
                      <td class="cme-v2v-td-atm-gc1" style="font-weight: 700; color: #f59e0b;">--</td>
                      <td>--</td>
                      <td>--</td>
                      <td>--</td>
                    </tr>
                    <tr id="cme-v2v-ranges-xau-row" class="cme-v2v-ranges-row-selectable cme-v2v-row-xau" title="Spot Gold CFD (OANDA:XAUUSD) Basis Spread Shift">
                      <td style="text-align: left; padding-left: 10px; font-weight: 600; color: #06b6d4;">
                        <span>XAU Spot</span>
                        <span class="cme-v2v-diff-badge" id="cme-v2v-diff-xau">Basis: --</span>
                      </td>
                      <td>--</td>
                      <td>--</td>
                      <td>--</td>
                      <td class="cme-v2v-td-atm-xau" style="font-weight: 700; color: #06b6d4;">--</td>
                      <td>--</td>
                      <td>--</td>
                      <td>--</td>
                    </tr>
                    <tr id="cme-v2v-ranges-open-row" class="cme-v2v-ranges-row-selectable" title="Click to anchor SD chart overlay to Session Open Price">
                      <td style="text-align: left; padding-left: 10px; font-weight: 600; color: #22c55e;">From Open (0DTE)</td>
                      <td>--</td>
                      <td>--</td>
                      <td>--</td>
                      <td style="font-weight: 700; color: #22c55e;">--</td>
                      <td>--</td>
                      <td>--</td>
                      <td>--</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Volume Dominance & Means Highlight Cards -->
            <div class="cme-v2v-cards-grid">
              <!-- Dominance Card -->
              <div class="cme-v2v-card" id="cme-v2v-card-dom">
                <div class="cme-v2v-card-label">Volume Dominance</div>
                <div class="cme-v2v-card-value" id="cme-v2v-val-dom">CALLS (+57.7%)</div>
                <div class="cme-v2v-card-sub" id="cme-v2v-sub-dom">PCR: 0.27 | CPR: 3.71</div>
              </div>

              <!-- Mean Call Strike -->
              <div class="cme-v2v-card cme-v2v-card-call">
                <div class="cme-v2v-card-label">Mean Call Strike</div>
                <div class="cme-v2v-card-value" id="cme-v2v-val-meancall">4,423.0</div>
                <div class="cme-v2v-card-sub" id="cme-v2v-sub-meancall">+$75.6 from ATM</div>
              </div>

              <!-- Mean Put Strike -->
              <div class="cme-v2v-card cme-v2v-card-put">
                <div class="cme-v2v-card-label">Mean Put Strike</div>
                <div class="cme-v2v-card-value" id="cme-v2v-val-meanput">4,270.2</div>
                <div class="cme-v2v-card-sub" id="cme-v2v-sub-meanput">-$77.2 from ATM</div>
              </div>

              <!-- Mean Both Strike -->
              <div class="cme-v2v-card cme-v2v-card-both">
                <div class="cme-v2v-card-label">Mean Both (Center)</div>
                <div class="cme-v2v-card-value" id="cme-v2v-val-meanboth">4,390.7</div>
                <div class="cme-v2v-card-sub" id="cme-v2v-sub-meanboth">+$43.3 from ATM</div>
              </div>
            </div>

            <!-- Vol Term Structure (CME Event Vol Equivalent) -->
            <div id="cme-v2v-term-structure" class="cme-v2v-term-structure" style="margin-top: 8px;">
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 10px; background: rgba(30,34,45,0.7); border-radius: 6px 6px 0 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                <span style="font-size: 11px; font-weight: 600; color: #d1d4dc; letter-spacing: 0.3px;">
                  ${MaterialIcons.analytics} Vol Term Structure
                </span>
                <span id="cme-v2v-ts-update" style="font-size: 10px; color: #787b86;">--</span>
              </div>
              <div style="overflow-x: auto;">
                <table class="cme-v2v-ts-table" style="width: 100%; border-collapse: collapse; font-size: 11px;">
                  <thead>
                    <tr style="color: #787b86; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px;">
                      <th style="text-align: left; padding: 5px 8px; min-width: 80px;">Series</th>
                      <th style="padding: 5px 6px; min-width: 40px;">DTE</th>
                      <th style="padding: 5px 6px; min-width: 60px;">ATM IV</th>
                      <th style="padding: 5px 6px; min-width: 70px;">1SD Move</th>
                      <th style="padding: 5px 6px; min-width: 60px;">Fwd Vol</th>
                      <th style="padding: 5px 6px; min-width: 80px;">Volume</th>
                    </tr>
                  </thead>
                  <tbody id="cme-v2v-ts-body">
                    <tr><td colspan="6" style="text-align: center; padding: 12px; color: #787b86;">Waiting for voi-lens data...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Raw Strikes Data Drawer (Toggleable) -->
            <div id="cme-v2v-raw-drawer" class="cme-v2v-raw-drawer" style="display: none;">
              <div class="cme-v2v-raw-header">
                <strong>Strike Volume & Calculated Vol Stl Inspector</strong>
                <span id="cme-v2v-raw-count" style="font-size: 11px; color: #787b86;"></span>
              </div>
              <div class="cme-v2v-raw-table-wrap">
                <table class="cme-v2v-raw-table">
                  <thead>
                    <tr>
                      <th>Strike</th>
                      <th>Calls Vol</th>
                      <th>Puts Vol</th>
                      <th>Calculated Vol Stl</th>
                      <th>Dist to ATM</th>
                    </tr>
                  </thead>
                  <tbody id="cme-v2v-raw-tbody"></tbody>
                </table>
              </div>
            </div>

            <!-- Chart Title & CME Legend -->
            <div class="cme-v2v-chart-section">
              <div class="cme-v2v-chart-header">
                <div class="cme-v2v-chart-title" id="cme-v2v-chart-title-text">
                  COMEX:GCV2026 VOL2VOL™ EXPECTED RANGE INTRADAY VOLUME
                </div>
                <div class="cme-v2v-legend">
                  <span class="cme-v2v-legend-item">
                    <span class="cme-v2v-legend-swatch cme-v2v-legend-put"></span>
                    <span id="cme-v2v-legend-put-text">Puts (569)</span>
                  </span>
                  <span class="cme-v2v-legend-item">
                    <span class="cme-v2v-legend-swatch cme-v2v-legend-call"></span>
                    <span id="cme-v2v-legend-call-text">Calls (2,120)</span>
                  </span>
                  <span class="cme-v2v-legend-item">
                    <span class="cme-v2v-legend-dash cme-v2v-legend-vol"></span>
                    <span id="cme-v2v-legend-vol-text">Vol Stl (23.58)</span>
                  </span>
                  <span class="cme-v2v-legend-item">
                    <span class="cme-v2v-legend-dot cme-v2v-legend-future"></span>
                    <span id="cme-v2v-legend-future-text">Future Stl (4347.4)</span>
                  </span>
                  <span class="cme-v2v-legend-item">
                    <span class="cme-v2v-legend-open"></span>
                    <span id="cme-v2v-legend-open-text" style="color: #22c55e;">Open (4359.4)</span>
                  </span>
                </div>
              </div>

              <!-- SD Overlay Selection Bar -->
              <div class="cme-v2v-sd-bar">
                <div class="cme-v2v-sd-toggles">
                  <span class="cme-v2v-sd-bar-title">SD Bands:</span>
                  <div class="cme-v2v-highlight-btn-group">
                    <button type="button" class="cme-v2v-highlight-btn sd1 active" id="cme-v2v-chk-sd1" title="Toggle ±1 Standard Deviation Range (68.3% Prob)">±1 SD</button>
                    <button type="button" class="cme-v2v-highlight-btn sd2 active" id="cme-v2v-chk-sd2" title="Toggle ±2 Standard Deviation Range (95.4% Prob)">±2 SD</button>
                    <button type="button" class="cme-v2v-highlight-btn sd3" id="cme-v2v-chk-sd3" title="Toggle ±3 Standard Deviation Range (99.7% Prob)">±3 SD</button>
                  </div>
                </div>

                <div class="cme-v2v-sd-anchor-group">
                  <label for="cme-v2v-sel-sd-anchor">Anchor:</label>
                  <select id="cme-v2v-sel-sd-anchor" class="cme-v2v-select-sm" title="Select reference price anchor for SD ranges">
                    <option value="current" selected>From Current (S)</option>
                    <option value="open">From Session Open</option>
                    <option value="both">Both (Current & Open)</option>
                  </select>
                </div>

                <div class="cme-v2v-sd-range-group">
                  <label for="cme-v2v-sel-strike-range">Strikes:</label>
                  <select id="cme-v2v-sel-strike-range" class="cme-v2v-select-sm" title="Select Strike Range Window (Near ±5%, etc.)">
                    <option value="near5" selected>Near ±5% (ATM)</option>
                    <option value="near3">Near ±3% (Tight)</option>
                    <option value="near10">Near ±10% (Wide)</option>
                    <option value="sd3">±3 SD Range</option>
                    <option value="all">All Strikes (Full)</option>
                  </select>
                </div>

                <div class="cme-v2v-sd-extra-group">
                  <button type="button" class="cme-v2v-highlight-btn bell active" id="cme-v2v-chk-bell" title="Toggle Probability Bell Curve">Bell Curve</button>
                </div>

                <div class="cme-v2v-persp-group">
                  <span class="cme-v2v-sd-bar-title">View:</span>
                  <div class="cme-v2v-persp-pills">
                    <button type="button" class="cme-v2v-persp-btn active" id="cme-v2v-btn-persp-0dte" data-persp="0dte" title="View in 0DTE Options Strike & Future Stl Baseline">0DTE</button>
                    <button type="button" class="cme-v2v-persp-btn" id="cme-v2v-btn-persp-goldf" data-persp="goldf" title="Shift Strike & SD Ranges to GOLD.F (Basis Spread)">GOLD.F</button>
                    <button type="button" class="cme-v2v-persp-btn" id="cme-v2v-btn-persp-xau" data-persp="xau" title="Shift Strike & SD Ranges to XAU Spot (Basis Spread)">XAUUSD</button>
                  </div>
                </div>
              </div>

              <!-- Canvas Container -->
              <div class="cme-v2v-canvas-wrapper">
                <canvas id="cme-v2v-canvas"></canvas>
              </div>
            </div>

            <!-- Series & DTE Control Toolbar -->
            <div class="cme-v2v-toolbar">
              <div class="cme-v2v-toolbar-left">
                <!-- Series Dropdown -->
                <div class="cme-v2v-toolbar-group">
                  <label>Series:</label>
                  <select id="cme-v2v-sel-series" class="cme-v2v-select">
                    <option value="">Auto Detect</option>
                  </select>
                </div>

                <!-- DTE Selector (Default 0 DTE) -->
                <div class="cme-v2v-toolbar-group">
                  <label>DTE Setting:</label>
                  <select id="cme-v2v-sel-dte" class="cme-v2v-select" style="font-weight: 600; color: #f59e0b;">
                    <option value="0" selected>0 DTE (Intraday Default)</option>
                    <option value="1">1 DTE (Next Day)</option>
                    <option value="7">7 DTE (Weekly)</option>
                    <option value="14">14 DTE (2 Weeks)</option>
                    <option value="30">30 DTE (Monthly)</option>
                    <option value="auto">Auto (Series Date)</option>
                    <option value="custom">Custom...</option>
                  </select>
                  <input type="number" id="cme-v2v-inp-dte-custom" class="cme-v2v-input" style="width: 50px; display: none;" value="0" min="0" step="1" />
                </div>

                <div class="cme-v2v-toolbar-group">
                  <label>Future Stl (S):</label>
                  <input type="number" step="0.1" id="cme-v2v-inp-price" class="cme-v2v-input" style="width: 75px;" title="Current Underlying Price (Future Stl)" />
                </div>

                <div class="cme-v2v-toolbar-group">
                  <label>Open:</label>
                  <input type="number" step="0.1" id="cme-v2v-inp-open" class="cme-v2v-input" style="width: 75px; color: #22c55e;" />
                </div>

                <div class="cme-v2v-toolbar-group">
                  <label>ATM Vol Stl %:</label>
                  <input type="number" step="0.1" id="cme-v2v-inp-iv" class="cme-v2v-input" style="width: 65px;" />
                </div>
              </div>

              <div class="cme-v2v-toolbar-buttons">
                <button id="cme-v2v-btn-refresh" class="cme-v2v-btn cme-v2v-btn-primary" title="Fetch Live TradingView Data">${MaterialIcons.sync} <span>Sync TV</span></button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    bindDOMElements() {
      this.modal = this.container.querySelector('#cme-v2v-modal');
      this.launcher = this.container.querySelector('#cme-v2v-launcher');
      this.bodyContent = this.container.querySelector('#cme-v2v-body-content');

      this.titleText = this.container.querySelector('#cme-v2v-title-text');
      this.headlineText = this.container.querySelector('#cme-v2v-headline-text');
      this.chartTitleText = this.container.querySelector('#cme-v2v-chart-title-text');

      this.legendPut = this.container.querySelector('#cme-v2v-legend-put-text');
      this.legendCall = this.container.querySelector('#cme-v2v-legend-call-text');
      this.legendVol = this.container.querySelector('#cme-v2v-legend-vol-text');
      this.legendFuture = this.container.querySelector('#cme-v2v-legend-future-text');
      this.legendOpen = this.container.querySelector('#cme-v2v-legend-open-text');

      this.rangesCurrentRow = this.container.querySelector('#cme-v2v-ranges-current-row');
      this.rangesGc1Row = this.container.querySelector('#cme-v2v-ranges-gc1-row');
      this.rangesXauRow = this.container.querySelector('#cme-v2v-ranges-xau-row');
      this.rangesOpenRow = this.container.querySelector('#cme-v2v-ranges-open-row');
      this.expectedMoveSummary = this.container.querySelector('#cme-v2v-expected-move-summary');

      this.valDom = this.container.querySelector('#cme-v2v-val-dom');
      this.subDom = this.container.querySelector('#cme-v2v-sub-dom');

      this.valMeanCall = this.container.querySelector('#cme-v2v-val-meancall');
      this.subMeanCall = this.container.querySelector('#cme-v2v-sub-meancall');
      this.valMeanPut = this.container.querySelector('#cme-v2v-val-meanput');
      this.subMeanPut = this.container.querySelector('#cme-v2v-sub-meanput');
      this.valMeanBoth = this.container.querySelector('#cme-v2v-val-meanboth');
      this.subMeanBoth = this.container.querySelector('#cme-v2v-sub-meanboth');

      this.selSeries = this.container.querySelector('#cme-v2v-sel-series');
      this.selDte = this.container.querySelector('#cme-v2v-sel-dte');
      this.inpDteCustom = this.container.querySelector('#cme-v2v-inp-dte-custom');
      this.inpPrice = this.container.querySelector('#cme-v2v-inp-price');
      this.inpOpen = this.container.querySelector('#cme-v2v-inp-open');
      this.inpIv = this.container.querySelector('#cme-v2v-inp-iv');
      this.sourceBadge = this.container.querySelector('#cme-v2v-source-badge');

      this.rawDrawer = this.container.querySelector('#cme-v2v-raw-drawer');
      this.rawTbody = this.container.querySelector('#cme-v2v-raw-tbody');
      this.rawCount = this.container.querySelector('#cme-v2v-raw-count');

      // SD Overlay Controls (Highlight Buttons)
      this.chkSd1 = this.container.querySelector('#cme-v2v-chk-sd1');
      this.chkSd2 = this.container.querySelector('#cme-v2v-chk-sd2');
      this.chkSd3 = this.container.querySelector('#cme-v2v-chk-sd3');
      this.selSdAnchor = this.container.querySelector('#cme-v2v-sel-sd-anchor');
      this.selStrikeRange = this.container.querySelector('#cme-v2v-sel-strike-range');
      this.chkBell = this.container.querySelector('#cme-v2v-chk-bell');
      this.perspBtns = this.container.querySelectorAll('.cme-v2v-persp-btn');

      [this.chkSd1, this.chkSd2, this.chkSd3, this.chkBell].forEach((btn) => {
        if (!btn) return;
        Object.defineProperty(btn, 'checked', {
          get() { return this.classList.contains('active'); },
          set(val) { this.classList.toggle('active', !!val); },
          configurable: true,
        });
      });

      // Compact Mini-HUD elements (for minimized view)
      this.miniHud = this.container.querySelector('#cme-v2v-mini-hud');
      this.miniPrice = this.container.querySelector('#cme-v2v-mini-price');
      this.mini1sd = this.container.querySelector('#cme-v2v-mini-1sd');
      this.miniDom = this.container.querySelector('#cme-v2v-mini-dom');
      this.miniDte = this.container.querySelector('#cme-v2v-mini-dte');
    }

    bindEvents() {
      this.launcher.addEventListener('click', () => this.open());
      this.container.querySelector('#cme-v2v-close-btn').addEventListener('click', () => this.close());
      this.container.querySelector('#cme-v2v-minimize-btn').addEventListener('click', () => this.toggleMinimize());
      this.container.querySelector('#cme-v2v-theme-btn').addEventListener('click', () => this.toggleTheme());

      const readmeBtn = this.container.querySelector('#cme-v2v-readme-btn');
      if (readmeBtn) {
        readmeBtn.addEventListener('click', () => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
            window.open(chrome.runtime.getURL('docs/readme.html'), '_blank');
          } else {
            window.open('docs/readme.html', '_blank');
          }
        });
      }

      const dashBtn = this.container.querySelector('#cme-v2v-dash-btn');
      if (dashBtn) {
        dashBtn.addEventListener('click', () => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
            window.open(chrome.runtime.getURL('src/dashboard/dashboard.html'), '_blank');
          }
        });
      }

      // Click mini-HUD bar to expand Full Dashboard
      if (this.miniHud) {
        this.miniHud.addEventListener('click', () => {
          if (this.isMinimized) this.toggleMinimize();
        });
      }

      // Toggle Raw Strikes Drawer
      this.container.querySelector('#cme-v2v-table-toggle-btn').addEventListener('click', () => {
        this.showRawTable = !this.showRawTable;
        this.rawDrawer.style.display = this.showRawTable ? 'block' : 'none';
        if (this.showRawTable) this.renderRawStrikesTable();
      });

      // SD Overlay Highlight Button Controls
      const handleSdBtnClick = (btn) => {
        if (!btn) return;
        btn.classList.toggle('active');
        this.updateSdOverlayState();
        this.saveSdOverlayPreferences();
      };
      if (this.chkSd1) this.chkSd1.addEventListener('click', () => handleSdBtnClick(this.chkSd1));
      if (this.chkSd2) this.chkSd2.addEventListener('click', () => handleSdBtnClick(this.chkSd2));
      if (this.chkSd3) this.chkSd3.addEventListener('click', () => handleSdBtnClick(this.chkSd3));
      if (this.chkBell) this.chkBell.addEventListener('click', () => handleSdBtnClick(this.chkBell));
      if (this.selSdAnchor) {
        this.selSdAnchor.addEventListener('change', () => {
          this.updateSdOverlayState();
          this.saveSdOverlayPreferences();
        });
      }

      // Strike Range Window Selector (Near ±5%, etc.)
      if (this.selStrikeRange) {
        this.selStrikeRange.addEventListener('change', () => {
          this.strikeRangeMode = this.selStrikeRange.value;
          if (this.chart) this.chart.setStrikeRangeMode(this.strikeRangeMode);
          this.saveSdOverlayPreferences();
          if (this.showRawTable) this.renderRawStrikesTable();
        });
      }

      // Perspective Pills Click
      if (this.perspBtns) {
        this.perspBtns.forEach((btn) => {
          btn.addEventListener('click', () => {
            const persp = btn.getAttribute('data-persp');
            this.setPerspectiveMode(persp);
          });
        });
      }

      // Interactive Click on Table Rows to switch Perspective & Anchors
      if (this.rangesCurrentRow) {
        this.rangesCurrentRow.addEventListener('click', () => {
          this.setPerspectiveMode('0dte');
          if (this.selSdAnchor) {
            this.selSdAnchor.value = 'current';
            this.updateSdOverlayState();
          }
        });
      }
      if (this.rangesGc1Row) {
        this.rangesGc1Row.addEventListener('click', () => {
          this.setPerspectiveMode('goldf');
        });
      }
      if (this.rangesXauRow) {
        this.rangesXauRow.addEventListener('click', () => {
          this.setPerspectiveMode('xau');
        });
      }
      if (this.rangesOpenRow) {
        this.rangesOpenRow.addEventListener('click', () => {
          if (this.selSdAnchor) {
            this.selSdAnchor.value = 'open';
            this.updateSdOverlayState();
          }
        });
      }

      // DTE Selector Change (Default 0 DTE)
      this.selDte.addEventListener('change', () => {
        const val = this.selDte.value;
        this.selectedDteMode = val;

        if (val === 'custom') {
          this.inpDteCustom.style.display = 'inline-block';
          this.inpDteCustom.focus();
        } else {
          this.inpDteCustom.style.display = 'none';
        }

        this.applyDteChange();
      });

      this.inpDteCustom.addEventListener('change', () => {
        this.applyDteChange();
      });

      // Series Dropdown Change
      this.selSeries.addEventListener('change', async () => {
        const seriesId = this.selSeries.value;
        if (this.fullVoiLensPayload && typeof DataParser !== 'undefined') {
          const matchedItem = this.fullVoiLensPayload.items.find((i) => i.id === seriesId);
          const parsed = DataParser.processVoiLensPayload(this.fullVoiLensPayload, seriesId);
          if (parsed && matchedItem) {
            const targetContract = matchedItem.underlying || parsed.symbol || 'COMEX:GCV2026';
            const itemDte = DataParser.calculateDteFromSeries(matchedItem.exp);

            let contractPrice = 0;
            let contractOpen = 0;
            if (typeof document !== 'undefined') {
              const chainRow = document.querySelector('[data-qa-id="option-chain-underlying-row"]');
              if (chainRow) {
                const info = DataParser.extractUnderlyingInfoFromRow ? DataParser.extractUnderlyingInfoFromRow(chainRow) : null;
                if (info && info.price > 100) {
                  const cleanInfo = (info.symbol || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                  const cleanTarget = targetContract.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                  if (!cleanInfo || cleanTarget.includes(cleanInfo) || cleanInfo.includes(cleanTarget)) {
                    contractPrice = info.price;
                    // NOTE: info.openPrice = Previous Settlement (price-change), NOT session open.
                  }
                }
              }
            }

            // Always fetch Scanner for session open (even if DOM has price)
            if (typeof this.fetchSymbolQuote === 'function') {
              const live = await this.fetchSymbolQuote(targetContract);
              if (live && live.openPrice > 100) contractOpen = live.openPrice;
              if (!contractPrice && live && live.price > 100) contractPrice = live.price;
            }

            if (!contractPrice) {
              contractPrice = this.currentData.underlyingPrice || 4355.0;
            }

            let seriesAtmIV = this.currentData.atmVolatility || 23.66;
            if (this.termStructureData && this.termStructureData.length > 0) {
              const ts = this.termStructureData.find(t => t.id === seriesId);
              if (ts && ts.atmIV > 0) seriesAtmIV = ts.atmIV;
            }

            this.updateData({
              symbol: targetContract,
              underlyingPrice: contractPrice,
              openPrice: contractOpen || this.currentData.openPrice || 4328.0,
              atmVolatility: seriesAtmIV,
              dte: this.getResolvedDte(itemDte),
              series: parsed.selectedSeriesId,
              strikesData: parsed.strikesData,
            }, 'SERIES ' + parsed.selectedExp);
          }
        }
      });

      // Price, Open, and IV input changes
      const handleParamChange = () => {
        if (!this.currentData) return;
        const newP = parseFloat(this.inpPrice.value);
        if (!isNaN(newP) && newP > 100) {
          this.currentData.underlyingPrice = newP;
          this.currentData.spotPrice = newP;
          this.currentData.volAnchorPrice = newP; // Re-anchor Vol Stl when user changes price manually
        }
        if (this.inpOpen) {
          this.currentData.openPrice = parseFloat(this.inpOpen.value) || this.currentData.openPrice;
        }
        this.currentData.atmVolatility = parseFloat(this.inpIv.value) || this.currentData.atmVolatility;
        this.recalculateAndRender();
      };

      this.inpPrice.addEventListener('change', handleParamChange);
      if (this.inpOpen) {
        this.inpOpen.addEventListener('change', handleParamChange);
      }
      this.inpIv.addEventListener('change', handleParamChange);

      // Refresh button (triggers live fetch inside TradingView)
      this.container.querySelector('#cme-v2v-btn-refresh').addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('__TV_TRIGGER_FETCH__'));
      });
    }

    loadSdOverlayPreferences() {
      try {
        const savedStr = localStorage.getItem('cme_v2v_sd_overlay_cfg');
        if (savedStr) {
          const saved = JSON.parse(savedStr);
          if (this.chkSd1 && saved.showSd1 !== undefined) this.chkSd1.checked = !!saved.showSd1;
          if (this.chkSd2 && saved.showSd2 !== undefined) this.chkSd2.checked = !!saved.showSd2;
          if (this.chkSd3 && saved.showSd3 !== undefined) this.chkSd3.checked = !!saved.showSd3;
          if (this.selSdAnchor && saved.anchor !== undefined) this.selSdAnchor.value = saved.anchor;
          if (this.selStrikeRange && saved.strikeRangeMode !== undefined) {
            this.selStrikeRange.value = saved.strikeRangeMode;
            this.strikeRangeMode = saved.strikeRangeMode;
          }
          if (this.chkBell && saved.showBellCurve !== undefined) this.chkBell.checked = !!saved.showBellCurve;
        }

        const savedPersp = localStorage.getItem('cme_v2v_persp_mode');
        if (savedPersp && ['0dte', 'goldf', 'xau'].includes(savedPersp)) {
          this.activePerspective = savedPersp;
        }
      } catch (e) {}
      this.updateSdOverlayState();
      if (this.activePerspective && this.activePerspective !== '0dte') {
        this.setPerspectiveMode(this.activePerspective);
      }
    }

    saveSdOverlayPreferences() {
      try {
        const cfg = {
          showSd1: this.chkSd1 ? this.chkSd1.checked : true,
          showSd2: this.chkSd2 ? this.chkSd2.checked : true,
          showSd3: this.chkSd3 ? this.chkSd3.checked : false,
          anchor: this.selSdAnchor ? this.selSdAnchor.value : 'current',
          strikeRangeMode: this.selStrikeRange ? this.selStrikeRange.value : this.strikeRangeMode,
          showBellCurve: this.chkBell ? this.chkBell.checked : true,
        };
        localStorage.setItem('cme_v2v_sd_overlay_cfg', JSON.stringify(cfg));
      } catch (e) {}
    }

    updateSdOverlayState() {
      const cfg = {
        showSd1: this.chkSd1 ? this.chkSd1.checked : true,
        showSd2: this.chkSd2 ? this.chkSd2.checked : true,
        showSd3: this.chkSd3 ? this.chkSd3.checked : false,
        anchor: this.selSdAnchor ? this.selSdAnchor.value : 'current',
        strikeRangeMode: this.selStrikeRange ? this.selStrikeRange.value : this.strikeRangeMode,
        showBellCurve: this.chkBell ? this.chkBell.checked : true,
      };

      if (this.chart) {
        this.chart.setSdOverlayConfig(cfg);
        this.chart.setStrikeRangeMode(this.strikeRangeMode);
      }

      if (this.rangesCurrentRow && this.rangesOpenRow) {
        this.rangesCurrentRow.classList.toggle('cme-v2v-ranges-row-active', cfg.anchor === 'current' || cfg.anchor === 'both');
        this.rangesOpenRow.classList.toggle('cme-v2v-ranges-row-active', cfg.anchor === 'open' || cfg.anchor === 'both');
      }

      this.saveSdOverlayPreferences();
    }

    setPerspectiveMode(mode = '0dte') {
      this.activePerspective = mode;

      let config = {
        mode: '0dte',
        basis: 0,
        targetPrice: null,
        targetOpen: null,
        label: '0DTE',
        color: '#f23645',
        convertedRanges: null,
      };

      const basePrice = Number(this.currentData?.underlyingPrice || 0);
      const sym = this.currentData?.symbol || 'COMEX:GCV2026';
      const cleanSym = sym.replace('COMEX:', '');

      if (mode === 'goldf') {
        const gc1Quote = this.comparisonQuotes?.gc1;
        const gc1Price = gc1Quote?.price;
        const conv = this.latestConvertedGc1;
        const basis = conv ? conv.diff : (gc1Price && basePrice ? gc1Price - basePrice : 0);
        const baseOpen = Number(this.currentData?.openPrice || basePrice);
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
        const xauQuote = this.comparisonQuotes?.xau;
        const xauPrice = xauQuote?.price;
        const conv = this.latestConvertedXau;
        const basis = conv ? conv.diff : (xauPrice && basePrice ? xauPrice - basePrice : 0);
        const baseOpen = Number(this.currentData?.openPrice || basePrice);
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

      if (this.chart) {
        this.chart.setPerspective(config);
      }

      // Update Toolbar Pill Active States
      if (this.perspBtns) {
        this.perspBtns.forEach((btn) => {
          const btnPersp = btn.getAttribute('data-persp');
          btn.classList.toggle('active', btnPersp === mode);
          if (btnPersp === 'goldf') btn.classList.toggle('active-goldf', mode === 'goldf');
          if (btnPersp === 'xau') btn.classList.toggle('active-xau', mode === 'xau');
        });
      }

      // Update Table Row Active Border Styles
      if (this.rangesCurrentRow) {
        this.rangesCurrentRow.classList.toggle('cme-v2v-persp-active', mode === '0dte');
      }
      if (this.rangesGc1Row) {
        this.rangesGc1Row.classList.toggle('cme-v2v-persp-active', mode === 'goldf');
      }
      if (this.rangesXauRow) {
        this.rangesXauRow.classList.toggle('cme-v2v-persp-active', mode === 'xau');
      }

      // Update Chart Section Title & Color dynamically
      if (this.chartTitleText) {
        if (mode === 'goldf') {
          const basisStr = config.basis >= 0 ? `+${config.basis.toFixed(1)}` : config.basis.toFixed(1);
          this.chartTitleText.textContent = `GOLD.F FUTURES VOL2VOL™ EXPECTED RANGE (BASIS ${basisStr})`;
          this.chartTitleText.style.color = '#f59e0b';
        } else if (mode === 'xau') {
          const basisStr = config.basis >= 0 ? `+${config.basis.toFixed(1)}` : config.basis.toFixed(1);
          this.chartTitleText.textContent = `XAUUSD SPOT VOL2VOL™ EXPECTED RANGE (BASIS ${basisStr})`;
          this.chartTitleText.style.color = '#06b6d4';
        } else {
          this.chartTitleText.textContent = `${cleanSym} VOL2VOL™ EXPECTED RANGE INTRADAY VOLUME`;
          this.chartTitleText.style.color = '';
        }
      }

      // Save preference & Broadcast state
      try {
        localStorage.setItem('cme_v2v_persp_mode', mode);
      } catch (e) {}

      if (this.latestStats) {
        this.renderUI(this.latestStats);
        this.broadcastState(this.latestStats);
      }
    }

    async applyDteChange() {
      if (!this.currentData) return;
      const targetDteMode = this.selectedDteMode;
      const resolvedDte = this.getResolvedDte(this.currentData.dte);
      this.currentData.dte = resolvedDte;

      // If we have full voi-lens payload, find the series matching this DTE
      if (this.fullVoiLensPayload && Array.isArray(this.fullVoiLensPayload.items) && typeof DataParser !== 'undefined') {
        let bestItem = null;
        if (targetDteMode === '0') {
          bestItem = this.fullVoiLensPayload.items.find((it) => DataParser.calculateDteFromSeries(it.exp) === 0) || this.fullVoiLensPayload.items[0];
        } else if (targetDteMode === 'auto') {
          const curId = this.selSeries ? this.selSeries.value : null;
          bestItem = this.fullVoiLensPayload.items.find((it) => it.id === curId) || this.fullVoiLensPayload.items[0];
        } else {
          const targetNum = targetDteMode === 'custom'
            ? (parseInt(this.inpDteCustom.value, 10) || 0)
            : (parseInt(targetDteMode, 10) || 0);

          let minDiff = Infinity;
          for (const it of this.fullVoiLensPayload.items) {
            const d = DataParser.calculateDteFromSeries(it.exp);
            const diff = Math.abs(d - targetNum);
            if (diff < minDiff) {
              minDiff = diff;
              bestItem = it;
            }
          }
        }

        if (bestItem) {
          if (this.selSeries) {
            this.selSeries.value = bestItem.id;
          }

          const parsed = DataParser.processVoiLensPayload(this.fullVoiLensPayload, bestItem.id);
          if (parsed) {
            let targetContract = bestItem.underlying || parsed.symbol || 'COMEX:GCV2026';
            if (!targetContract || targetContract.includes('1!') || targetContract.includes('2!')) {
              targetContract = 'COMEX:GCV2026';
            }

            // 1. Check if Options Chain table row is currently showing this contract
            let contractPrice = 0;
            let contractOpen = 0;
            if (typeof document !== 'undefined') {
              const chainRow = document.querySelector('[data-qa-id="option-chain-underlying-row"]');
              if (chainRow) {
                const info = DataParser.extractUnderlyingInfoFromRow ? DataParser.extractUnderlyingInfoFromRow(chainRow) : null;
                if (info && info.price > 100) {
                  const cleanInfo = (info.symbol || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                  const cleanTarget = targetContract.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                  if (!cleanInfo || cleanTarget.includes(cleanInfo) || cleanInfo.includes(cleanTarget)) {
                    contractPrice = info.price;
                    // NOTE: info.openPrice = Previous Settlement (price-change), NOT session open.
                  }
                }
              }
            }

            // 2. Always fetch Scanner for session open (even if DOM has price)
            if (typeof this.fetchSymbolQuote === 'function') {
              const live = await this.fetchSymbolQuote(targetContract);
              if (live && live.openPrice > 100) contractOpen = live.openPrice;
              if (!contractPrice && live && live.price > 100) contractPrice = live.price;
            }

            if (!contractPrice) {
              const prev = this.currentData.underlyingPrice;
              contractPrice = (prev && prev > 100 && !this.currentData.symbol.includes('1!')) ? prev : 4366.1;
            }

            this.updateData({
              symbol: targetContract,
              underlyingPrice: contractPrice,
              openPrice: contractOpen || this.currentData.openPrice || 4328.0,
              atmVolatility: this.currentData.atmVolatility || 23.66,
              dte: resolvedDte,
              series: bestItem.id,
              strikesData: parsed.strikesData,
            }, `DTE ${resolvedDte} (${bestItem.exp})`);
            return;
          }
        }
      }

      this.recalculateAndRender();
    }

    getResolvedDte(seriesDte) {
      if (this.selectedDteMode === '0') return 0; // Default 0DTE!
      if (this.selectedDteMode === '1') return 1;
      if (this.selectedDteMode === '7') return 7;
      if (this.selectedDteMode === '14') return 14;
      if (this.selectedDteMode === '30') return 30;
      if (this.selectedDteMode === 'auto') return seriesDte || 0;
      if (this.selectedDteMode === 'custom') return parseInt(this.inpDteCustom.value, 10) || 0;
      return 0;
    }

    open() {
      this.modal.style.display = 'flex';
      this.launcher.style.display = 'none';
      if (this.chart) {
        setTimeout(() => this.chart.render(), 50);
      }
    }

    close() {
      this.modal.style.display = 'none';
      this.launcher.style.display = 'flex';
    }

    toggleMinimize() {
      this.isMinimized = !this.isMinimized;
      this.bodyContent.style.display = this.isMinimized ? 'none' : 'block';
      if (this.miniHud) {
        this.miniHud.style.display = this.isMinimized ? 'flex' : 'none';
      }
      if (this.isMinimized) {
        this.modal.classList.add('cme-v2v-minimized');
        if (this.latestStats) this.updateCompactHud(this.latestStats);
      } else {
        this.modal.classList.remove('cme-v2v-minimized');
        if (this.chart) {
          setTimeout(() => this.chart.render(), 30);
        }
      }
      const minBtn = this.container.querySelector('#cme-v2v-minimize-btn');
      if (minBtn) {
        minBtn.innerHTML = this.isMinimized ? MaterialIcons.add : MaterialIcons.remove;
        minBtn.title = this.isMinimized ? 'Expand Full Dashboard' : 'Minimize to Compact Bar';
      }
    }

    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      this.container.className = `cme-v2v-theme-${this.theme}`;
      const themeBtn = this.container.querySelector('#cme-v2v-theme-btn');
      if (themeBtn) {
        themeBtn.innerHTML = this.theme === 'dark' ? MaterialIcons.lightMode : MaterialIcons.darkMode;
      }
      if (this.chart) {
        this.chart.setTheme(this.theme);
      }
    }

    makeDraggable() {
      const handle = this.container.querySelector('#cme-v2v-drag-handle');
      let isDragging = false;
      let startX, startY, initialLeft, initialTop;

      handle.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = this.modal.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        this.modal.style.position = 'fixed';
        this.modal.style.right = 'auto';
        this.modal.style.bottom = 'auto';
        this.modal.style.left = `${initialLeft}px`;
        this.modal.style.top = `${initialTop}px`;

        const onMouseMove = (moveEvent) => {
          if (!isDragging) return;
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;
          this.modal.style.left = `${Math.max(10, initialLeft + dx)}px`;
          this.modal.style.top = `${Math.max(10, initialTop + dy)}px`;
        };

        const onMouseUp = () => {
          isDragging = false;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }

    /**
     * Store full voi-lens payload to populate series dropdown
     */
    setVoiLensPayload(payload, activeSeriesId = null) {
      this.fullVoiLensPayload = payload;
      if (!payload || !Array.isArray(payload.items)) return;

      const currentVal = activeSeriesId || this.selSeries.value;
      this.selSeries.innerHTML = '';

      for (const item of payload.items) {
        let callVol = 0;
        let putVol = 0;
        if (item.strikes) {
          for (const s of item.strikes) {
            callVol += s.c?.v || 0;
            putVol += s.p?.v || 0;
          }
        }
        const dte = DataParser.calculateDteFromSeries(item.exp);
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = `${item.exp} (${dte === 0 ? '0DTE' : dte + 'DTE'}) — [C:${callVol.toLocaleString()} | P:${putVol.toLocaleString()}]`;
        if (item.id === currentVal || String(item.exp) === String(currentVal)) {
          opt.selected = true;
        }
        this.selSeries.appendChild(opt);
      }
      // NOTE: Term structure is populated separately by setTermStructure() which uses
      // real IV from TradingView Scanner "options" market (not voi-lens which has volume only).
    }

    /**
     * Receive pre-computed Vol Term Structure rows from content.js.
     * @param {Array} rows - Output of OptionsMath.calculateSeriesVolTermStructure()
     * @param {Object} meta - { updatedAt, source, error }
     */
    setTermStructure(rows, meta = {}) {
      this.termStructureData = rows || [];
      this.termStructureMeta = meta;
      this.renderTermStructure();

      // Sync active series' real ATM IV into the main chart (SD bands / bell curve)
      const activeId = this.selSeries ? this.selSeries.value : null;
      const active = this.termStructureData.find((r) => r.id === activeId);
      if (active && active.atmIV > 0 && this.currentData &&
          Math.abs((this.currentData.atmVolatility || 0) - active.atmIV) >= 0.01) {
        if (typeof this.recalculateAndRender === 'function') {
          this.recalculateAndRender();
        } else if (this.latestStats) {
          this.broadcastState(this.latestStats);
        }
      } else if (this.latestStats) {
        this.broadcastState(this.latestStats);
      }
    }

    /**
     * Render Vol Term Structure table (CME Event Vol Calculator equivalent)
     */
    renderTermStructure() {
      const tbody = this.container.querySelector('#cme-v2v-ts-body');
      const tsUpdate = this.container.querySelector('#cme-v2v-ts-update');
      if (!tbody) return;

      if (!this.termStructureData || this.termStructureData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#787b86; padding:8px;">Waiting for IV data...</td></tr>';
        return;
      }

      const meta = this.termStructureMeta || {};
      if (tsUpdate) {
        const src = meta.source ? ` (${meta.source})` : '';
        const err = meta.error ? ` [${meta.error}]` : '';
        if (meta.updatedAt) {
          const d = new Date(meta.updatedAt);
          tsUpdate.textContent = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}${src}${err}`;
        } else {
          tsUpdate.textContent = err || '';
        }
      }

      const activeId = this.selSeries ? this.selSeries.value : '';

      tbody.innerHTML = '';
      for (const s of this.termStructureData) {
        const isActive = s.id === activeId;
        const is0DTE = s.dte === 0;
        const fam = s.family || '';

        // Color coding: OG=amber, GC=blue
        const famColor = fam.startsWith('OG') ? '#f59e0b' : '#3b82f6';
        const rowBg = isActive ? 'rgba(34,197,94,0.08)' : 'transparent';
        const rowBorder = isActive ? 'border-left: 2px solid #22c55e;' : 'border-left: 2px solid transparent;';

        // Format expiry label
        const expLabel = s.exp ? `${s.exp.slice(4,6)}/${s.exp.slice(6,8)}` : '--';
        const seriesLabel = is0DTE ? '0DTE' : `${fam} ${expLabel}`;

        // DTE display: hours if < 1 day
        const dteDisplay = s.hoursToExpiry < 24
          ? `${Math.max(0, Math.round(s.hoursToExpiry))}h`
          : String(s.dte);

        // Forward Vol bar width (relative, max at 40%)
        const maxFwd = Math.max(...this.termStructureData.map(x => x.forwardVol || 0), 1);
        const fwdBarWidth = s.forwardVol ? Math.round((s.forwardVol / maxFwd) * 40) : 0;

        // ATM IV bar width (relative)
        const maxIV = Math.max(...this.termStructureData.map(x => x.atmIV || 0), 1);
        const ivBarWidth = Math.round((s.atmIV / maxIV) * 50);

        const tr = document.createElement('tr');
        tr.style.cssText = `background: ${rowBg}; ${rowBorder} cursor: pointer; transition: background 0.15s;`;
        tr.addEventListener('mouseenter', () => { tr.style.background = 'rgba(255,255,255,0.04)'; });
        tr.addEventListener('mouseleave', () => { tr.style.background = rowBg; });

        // Forward vol cell (trading-day weighted; tooltip shows calendar-day if weekend excluded)
        let fwdCell;
        if (s.forwardVol) {
          const hasWeekend = s.forwardVolCalendar && Math.abs(s.forwardVol - s.forwardVolCalendar) > 0.05;
          const tip = hasWeekend
            ? `Trading-day Fwd Vol: ${s.forwardVol.toFixed(2)}% (Weekend excluded | Calendar: ${s.forwardVolCalendar.toFixed(2)}%)`
            : `Forward Vol: ${s.forwardVol.toFixed(2)}%`;
          fwdCell = `<div style="position: relative;" title="${tip}">
                       <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${fwdBarWidth}%; background: rgba(249,115,22,0.12); border-radius: 2px;"></div>
                       <span style="position: relative; color: #f97316; font-weight: 500;">${s.forwardVol.toFixed(2)}%</span>
                     </div>`;
        } else if (s.forwardInverted) {
          fwdCell = '<span style="color: #f23645;" title="Inverted term structure (near-term total variance > far-term total variance)">INV</span>';
        } else {
          fwdCell = '<span style="color: #787b86;">--</span>';
        }

        tr.innerHTML = `
          <td style="text-align: left; padding: 4px 8px; font-weight: ${isActive ? 700 : 500};">
            <span style="color: ${famColor}; font-size: 10px; margin-right: 3px;">${fam}</span>
            <span style="color: ${isActive ? '#22c55e' : '#d1d4dc'};">${seriesLabel}</span>
          </td>
          <td style="text-align: center; padding: 4px 6px; color: ${is0DTE ? '#f23645' : '#d1d4dc'}; font-weight: ${is0DTE ? 700 : 400};">
            ${dteDisplay}
          </td>
          <td style="text-align: center; padding: 4px 6px; position: relative;">
            <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${ivBarWidth}%; background: rgba(59,130,246,0.1); border-radius: 2px;"></div>
            <span style="position: relative; font-weight: 600; color: #3b82f6;">${s.atmIV.toFixed(2)}%</span>
          </td>
          <td style="text-align: center; padding: 4px 6px; color: #d1d4dc;">
            <span style="font-size: 10px; color: #787b86;">±</span>$${s.expectedMove.toFixed(1)}
            <span style="font-size: 9px; color: #787b86; margin-left: 2px;">(${s.expectedMovePct.toFixed(2)}%)</span>
          </td>
          <td style="text-align: center; padding: 4px 6px;">${fwdCell}</td>
          <td style="text-align: center; padding: 4px 6px; font-size: 10px; color: #787b86;">
            ${s.totalVol > 0 ? s.totalVol.toLocaleString() : '--'}
          </td>
        `;

        // Click to switch series
        tr.addEventListener('click', () => {
          if (this.selSeries && s.id !== activeId) {
            this.selSeries.value = s.id;
            this.selSeries.dispatchEvent(new Event('change'));
          }
        });

        tbody.appendChild(tr);
      }
    }

    updateData(dataPayload, sourceTag = 'LIVE') {
      if (this.pendingRealtimePrice) {
        if (this.pendingRealtimePrice.price > 100) {
          dataPayload.underlyingPrice = this.pendingRealtimePrice.price;
          dataPayload.spotPrice = this.pendingRealtimePrice.price;
        }
        if (this.pendingRealtimePrice.openPrice > 100) {
          dataPayload.openPrice = this.pendingRealtimePrice.openPrice;
        }
        if (this.pendingRealtimePrice.symbol) {
          dataPayload.symbol = this.pendingRealtimePrice.symbol;
        }
        this.pendingRealtimePrice = null;
      }

      // Safeguard: Protect against corrupted underlyingPrice (e.g. net change like +37.0 or -18.7)
      const refP = (this.currentData && this.currentData.underlyingPrice > 100) ? this.currentData.underlyingPrice : 0;
      if (refP > 100) {
        const newP = Number(dataPayload.underlyingPrice);
        if (!newP || newP < 100 || (newP / refP < 0.5) || (newP / refP > 1.5)) {
          dataPayload.underlyingPrice = this.currentData.underlyingPrice;
        }
        const newOpen = Number(dataPayload.openPrice);
        if ((!newOpen || newOpen < 100) && this.currentData.openPrice > 100) {
          dataPayload.openPrice = this.currentData.openPrice;
        }
      }

      // Ensure underlyingPrice and spotPrice are valid numbers
      const rawPrice = Number(dataPayload.underlyingPrice);
      if (rawPrice > 100) {
        dataPayload.underlyingPrice = rawPrice;
        dataPayload.spotPrice = rawPrice;
      }

      // Initialize volAnchorPrice to snapshot price so Vol Stl stays stationary
      if (!dataPayload.volAnchorPrice && dataPayload.underlyingPrice > 100) {
        dataPayload.volAnchorPrice = dataPayload.underlyingPrice;
      }

      this.currentData = dataPayload;
      if (this.sourceBadge) {
        const labelEl = this.sourceBadge.querySelector('#cme-v2v-badge-label');
        if (labelEl) {
          labelEl.textContent = sourceTag;
        } else {
          this.sourceBadge.innerHTML = `<span class="cme-v2v-live-dot"></span><span id="cme-v2v-badge-label">${sourceTag}</span>`;
        }
      }
      this.recalculateAndRender();
    }

    /**
     * Real-time tick update: smoothly updates price and flashes tick indicator.
     */
    setRealtimePrice(newPrice, newOpenPrice = null, newSymbol = null) {
      const numPrice = parseFloat(newPrice);
      const numOpen = parseFloat(newOpenPrice);

      if (!this.currentData) {
        if (!isNaN(numPrice) && numPrice > 100) {
          this.pendingRealtimePrice = {
            price: numPrice,
            openPrice: (!isNaN(numOpen) && numOpen > 100) ? numOpen : null,
            symbol: newSymbol || null,
          };
        }
        return;
      }

      // Guard: strictly ignore invalid, sub-100 values (e.g. net daily change like +37.0 or -18.7)
      if (isNaN(numPrice) || numPrice < 100) {
        return;
      }

      // Guard: outlier filter (prevent 37.0 or sudden tenfold drops/spikes)
      const currentRef = this.currentData.underlyingPrice;
      if (currentRef > 100) {
        const ratio = numPrice / currentRef;
        if (ratio < 0.5 || ratio > 1.5) {
          console.warn('[CME-V2V] Discarded outlier realtime price:', numPrice, 'vs current:', currentRef);
          return;
        }
      }

      // Ensure volAnchorPrice is established on first tick
      if (!this.currentData.volAnchorPrice && this.currentData.underlyingPrice > 100) {
        this.currentData.volAnchorPrice = this.currentData.underlyingPrice;
      }

      let changed = false;

      // Update symbol if provided — only accept real delivery contracts (e.g. GCV2026), never continuous GC1!
      if (newSymbol && typeof newSymbol === 'string' && newSymbol.length >= 3) {
        if (!newSymbol.includes('1!') && !newSymbol.includes('2!')) {
          const cleanNew = newSymbol.trim().includes(':') ? newSymbol.trim() : `COMEX:${newSymbol.trim()}`;
          if (this.currentData.symbol !== cleanNew) {
            this.currentData.symbol = cleanNew;
            changed = true;
          }
        }
      }

      const prevPrice = this.currentData.underlyingPrice;
      const isUp = numPrice > prevPrice;

      if (Math.abs(numPrice - prevPrice) >= 0.01) {
        this.currentData.underlyingPrice = numPrice;
        this.currentData.spotPrice = numPrice;
        changed = true;

        // Flash indicator on Future Stl legend item
        if (this.legendFuture) {
          this.legendFuture.classList.remove('cme-v2v-tick-up', 'cme-v2v-tick-down');
          void this.legendFuture.offsetWidth; // force reflow
          this.legendFuture.classList.add(isUp ? 'cme-v2v-tick-up' : 'cme-v2v-tick-down');
        }
      }

      if (!isNaN(numOpen) && numOpen > 100 && Math.abs(numOpen - (this.currentData.openPrice || 0)) >= 0.01) {
        this.currentData.openPrice = numOpen;
        changed = true;
      }

      if (changed) {
        this.recalculateAndRender();
      }
    }

    recalculateAndRender() {
      if (!this.currentData || typeof OptionsMath === 'undefined') return;

      const resolvedDte = this.getResolvedDte(this.currentData.dte);

      const stats = OptionsMath.calculateStats({
        underlyingPrice: this.currentData.underlyingPrice,
        spotPrice: this.currentData.underlyingPrice,
        openPrice: this.currentData.openPrice,
        volAnchorPrice: this.currentData.volAnchorPrice || this.currentData.underlyingPrice,
        atmVolatility: this.currentData.atmVolatility,
        dte: resolvedDte,
        strikesData: this.currentData.strikesData,
      });

      this.latestStats = stats;
      this.renderUI(stats);
      if (this.chart) {
        this.chart.update(stats);
        if (this.activePerspective && this.activePerspective !== '0dte') {
          this.setPerspectiveMode(this.activePerspective);
        }
      }
      if (this.showRawTable) {
        this.renderRawStrikesTable();
      }
      this.broadcastState(stats);
    }

    renderUI(stats) {
      // Ensure symbol is the active delivery contract (e.g. COMEX:GCV2026), never continuous GC1!
      let sym = this.currentData.symbol || 'COMEX:GCV2026';
      if (!sym || sym.includes('1!') || sym.includes('2!')) {
        sym = 'COMEX:GCV2026';
        this.currentData.symbol = sym;
      }
      const S = stats.underlyingPrice;
      const openP = stats.openPrice;
      const iv = stats.atmVolatility;
      const dteText = stats.is0DTE ? '0 DTE Intraday' : `${stats.dte} DTE`;

      // Titles
      this.titleText.textContent = `${sym} Vol2Vol™ Expected Range`;
      this.headlineText.textContent = `${sym} Vol2Vol™ Expected Range (${dteText}) vs Future Stl: ${S.toFixed(1)} (Open: ${openP.toFixed(1)}) at ${iv.toFixed(2)}% Volatility`;
      this.chartTitleText.textContent = `${sym.split(':')[0]} VOL2VOL™ EXPECTED RANGE INTRADAY VOLUME`;

      // Legend
      this.legendPut.textContent = `Puts (${stats.totalPutVol.toLocaleString()})`;
      this.legendCall.textContent = `Calls (${stats.totalCallVol.toLocaleString()})`;
      this.legendVol.textContent = `Vol Stl (${iv.toFixed(2)})`;
      // Legend (Dynamic Perspective Aware)
      const legendFutureDot = this.container.querySelector('.cme-v2v-legend-dot.cme-v2v-legend-future');
      if (this.activePerspective === 'goldf') {
        const gc1Quote = this.comparisonQuotes?.gc1;
        const gc1Price = gc1Quote?.price;
        const basis = this.latestConvertedGc1 ? this.latestConvertedGc1.diff : (gc1Price && S ? gc1Price - S : 0);
        const targetPrice = gc1Price || (S > 0 ? S + basis : 0);
        const targetOpen = openP ? Math.round((openP + basis) * 10) / 10 : openP;

        if (this.legendFuture) this.legendFuture.textContent = `GOLD.F (${targetPrice.toFixed(1)})`;
        if (this.legendOpen) this.legendOpen.textContent = `Open (${targetOpen.toFixed(1)})`;
        if (legendFutureDot) legendFutureDot.style.background = '#f59e0b';
      } else if (this.activePerspective === 'xau') {
        const xauQuote = this.comparisonQuotes?.xau;
        const xauPrice = xauQuote?.price;
        const basis = this.latestConvertedXau ? this.latestConvertedXau.diff : (xauPrice && S ? xauPrice - S : 0);
        const targetPrice = xauPrice || (S > 0 ? S + basis : 0);
        const targetOpen = openP ? Math.round((openP + basis) * 10) / 10 : openP;

        if (this.legendFuture) this.legendFuture.textContent = `XAU Spot (${targetPrice.toFixed(1)})`;
        if (this.legendOpen) this.legendOpen.textContent = `Open (${targetOpen.toFixed(1)})`;
        if (legendFutureDot) legendFutureDot.style.background = '#06b6d4';
      } else {
        if (this.legendFuture) this.legendFuture.textContent = `0DTE Stl (${S.toFixed(1)})`;
        if (this.legendOpen) this.legendOpen.textContent = `Open (${openP.toFixed(1)})`;
        if (legendFutureDot) legendFutureDot.style.background = '#f23645';
      }

      // Expected Move Summary
      if (this.expectedMoveSummary) {
        this.expectedMoveSummary.textContent = `Future 1SD: ±$${stats.oneStdDevValue} (${stats.oneStdDevPct}%) | Open 1SD: ±$${stats.oneStdDevFromOpenValue}`;
      }

      // Table Ranges (-3 to +3)
      const r = stats.stdDevRanges;
      const activeAnchor = this.selSdAnchor ? this.selSdAnchor.value : 'current';
      const fmt = (v) => (v != null && !isNaN(v)) ? Number(v).toFixed(1) : '--';

      const cleanSym = sym ? sym.replace('COMEX:', '') : '';
      const stlLabel = cleanSym ? `0DTE ${cleanSym}` : '0DTE Stl';
      if (this.rangesCurrentRow) {
        this.rangesCurrentRow.classList.add('cme-v2v-ranges-row-selectable');
        this.rangesCurrentRow.classList.toggle('cme-v2v-ranges-row-active', activeAnchor === 'current' || activeAnchor === 'both');
        this.rangesCurrentRow.innerHTML = `
          <td style="text-align: left; padding-left: 10px; font-weight: 600; color: #f23645;">${stlLabel}</td>
          <td>${fmt(r['-3'])}</td>
          <td>${fmt(r['-2'])}</td>
          <td>${fmt(r['-1'])}</td>
          <td class="cme-v2v-td-atm">${fmt(r['ATM'] != null ? r['ATM'] : S)}</td>
          <td>${fmt(r['+1'])}</td>
          <td>${fmt(r['+2'])}</td>
          <td>${fmt(r['+3'])}</td>
        `;
      }

      // GOLD.F / GC1! Futures Converted Row
      if (this.rangesGc1Row) {
        const gc1Price = this.comparisonQuotes?.gc1?.price;
        const gc1Label = this.comparisonQuotes?.gc1?.displaySymbol || 'GOLD.F';
        if (gc1Price && typeof OptionsMath !== 'undefined' && OptionsMath.computeConvertedRanges) {
          const conv = OptionsMath.computeConvertedRanges(r, S, gc1Price);
          this.latestConvertedGc1 = conv;
          const diffCls = conv.diff >= 0 ? 'diff-pos' : 'diff-neg';
          this.rangesGc1Row.innerHTML = `
            <td style="text-align: left; padding-left: 10px; font-weight: 600; color: #f59e0b;">
              <span>${gc1Label}</span>
              <span class="cme-v2v-diff-badge ${diffCls}">Basis ${conv.diffFormatted}</span>
            </td>
            <td>${fmt(conv.ranges['-3'])}</td>
            <td>${fmt(conv.ranges['-2'])}</td>
            <td>${fmt(conv.ranges['-1'])}</td>
            <td style="font-weight: 700; color: #f59e0b;">${fmt(conv.ranges['ATM'] != null ? conv.ranges['ATM'] : gc1Price)}</td>
            <td>${fmt(conv.ranges['+1'])}</td>
            <td>${fmt(conv.ranges['+2'])}</td>
            <td>${fmt(conv.ranges['+3'])}</td>
          `;
        } else {
          this.rangesGc1Row.innerHTML = `
            <td style="text-align: left; padding-left: 10px; font-weight: 600; color: #f59e0b;">
              <span>${gc1Label}</span>
              <span class="cme-v2v-diff-badge">Basis: --</span>
            </td>
            <td>--</td><td>--</td><td>--</td><td style="color: #f59e0b;">--</td><td>--</td><td>--</td><td>--</td>
          `;
        }
      }

      // XAUUSD CFD Converted Row
      if (this.rangesXauRow) {
        const xauPrice = this.comparisonQuotes?.xau?.price;
        if (xauPrice && typeof OptionsMath !== 'undefined' && OptionsMath.computeConvertedRanges) {
          const conv = OptionsMath.computeConvertedRanges(r, S, xauPrice);
          this.latestConvertedXau = conv;
          const diffCls = conv.diff >= 0 ? 'diff-pos' : 'diff-neg';
          this.rangesXauRow.innerHTML = `
            <td style="text-align: left; padding-left: 10px; font-weight: 600; color: #06b6d4;">
              <span>XAU Spot</span>
              <span class="cme-v2v-diff-badge ${diffCls}">Basis ${conv.diffFormatted}</span>
            </td>
            <td>${fmt(conv.ranges['-3'])}</td>
            <td>${fmt(conv.ranges['-2'])}</td>
            <td>${fmt(conv.ranges['-1'])}</td>
            <td style="font-weight: 700; color: #06b6d4;">${fmt(conv.ranges['ATM'] != null ? conv.ranges['ATM'] : xauPrice)}</td>
            <td>${fmt(conv.ranges['+1'])}</td>
            <td>${fmt(conv.ranges['+2'])}</td>
            <td>${fmt(conv.ranges['+3'])}</td>
          `;
        } else {
          this.rangesXauRow.innerHTML = `
            <td style="text-align: left; padding-left: 10px; font-weight: 600; color: #06b6d4;">
              <span>XAU Spot</span>
              <span class="cme-v2v-diff-badge">Basis: --</span>
            </td>
            <td>--</td><td>--</td><td>--</td><td style="color: #06b6d4;">--</td><td>--</td><td>--</td><td>--</td>
          `;
        }
      }

      const ro = stats.stdDevRangesFromOpen;
      if (this.rangesOpenRow && ro) {
        this.rangesOpenRow.classList.add('cme-v2v-ranges-row-selectable');
        this.rangesOpenRow.classList.toggle('cme-v2v-ranges-row-active', activeAnchor === 'open' || activeAnchor === 'both');

        let activeOpen = openP;
        let openLabel = 'From Open (0DTE)';
        let activeOpenRanges = ro;

        if (this.activePerspective === 'goldf') {
          const gc1Quote = this.comparisonQuotes?.gc1;
          const conv = this.latestConvertedGc1;
          const basis = conv ? conv.diff : (gc1Quote?.price && S ? gc1Quote.price - S : 0);
          activeOpen = openP ? Math.round((openP + basis) * 10) / 10 : 0;
          openLabel = 'From Open (GOLD.F)';
          if (typeof OptionsMath !== 'undefined' && OptionsMath.computeConvertedRanges && openP > 0 && activeOpen > 0) {
            activeOpenRanges = OptionsMath.computeConvertedRanges(ro, openP, activeOpen).ranges;
          }
        } else if (this.activePerspective === 'xau') {
          const xauQuote = this.comparisonQuotes?.xau;
          const conv = this.latestConvertedXau;
          const basis = conv ? conv.diff : (xauQuote?.price && S ? xauQuote.price - S : 0);
          activeOpen = openP ? Math.round((openP + basis) * 10) / 10 : 0;
          openLabel = 'From Open (XAU Spot)';
          if (typeof OptionsMath !== 'undefined' && OptionsMath.computeConvertedRanges && openP > 0 && activeOpen > 0) {
            activeOpenRanges = OptionsMath.computeConvertedRanges(ro, openP, activeOpen).ranges;
          }
        } else {
          const cleanSym = sym ? sym.replace('COMEX:', '').trim() : '';
          openLabel = cleanSym ? `From Open (${cleanSym})` : 'From Open (0DTE)';
        }

        this.rangesOpenRow.innerHTML = `
          <td style="text-align: left; padding-left: 10px; font-weight: 600; color: #22c55e;">${openLabel}</td>
          <td>${fmt(activeOpenRanges['-3'])}</td>
          <td>${fmt(activeOpenRanges['-2'])}</td>
          <td>${fmt(activeOpenRanges['-1'])}</td>
          <td style="font-weight: 700; color: #22c55e;">${fmt(activeOpenRanges['Open'] != null ? activeOpenRanges['Open'] : activeOpen)}</td>
          <td>${fmt(activeOpenRanges['+1'])}</td>
          <td>${fmt(activeOpenRanges['+2'])}</td>
          <td>${fmt(activeOpenRanges['+3'])}</td>
        `;
      }

      // Dominance Card
      const domColor = stats.dominance === 'CALLS' ? '#2962ff' : stats.dominance === 'PUTS' ? '#ff9800' : '#888';
      this.valDom.textContent = `${stats.dominance} (+${stats.dominancePct}%)`;
      this.valDom.style.color = domColor;
      this.subDom.textContent = `PCR: ${stats.pcr} | CPR: ${stats.callPutRatio} | 1SD: ±$${stats.oneStdDevValue} (${stats.oneStdDevPct}%)`;

      // Means
      const fmtDist = (d) => (d >= 0 ? `+$${d.toFixed(1)}` : `-$${Math.abs(d).toFixed(1)}`) + ' from ATM';
      this.valMeanCall.textContent = stats.meanCall.toLocaleString();
      this.subMeanCall.textContent = fmtDist(stats.meanCallDistance);

      this.valMeanPut.textContent = stats.meanPut.toLocaleString();
      this.subMeanPut.textContent = fmtDist(stats.meanPutDistance);

      this.valMeanBoth.textContent = stats.meanBoth.toLocaleString();
      this.subMeanBoth.textContent = fmtDist(stats.meanBothDistance);

      // Populate Inputs (only if user is not actively typing)
      if (document.activeElement !== this.inpPrice) {
        this.inpPrice.value = S;
      }
      if (this.inpOpen && document.activeElement !== this.inpOpen) {
        this.inpOpen.value = openP;
      }
      if (document.activeElement !== this.inpIv) {
        this.inpIv.value = iv;
      }

      // Maintain active perspective row highlight
      if (this.rangesCurrentRow) {
        this.rangesCurrentRow.classList.toggle('cme-v2v-persp-active', this.activePerspective === '0dte');
      }
      if (this.rangesGc1Row) {
        this.rangesGc1Row.classList.toggle('cme-v2v-persp-active', this.activePerspective === 'goldf');
      }
      if (this.rangesXauRow) {
        this.rangesXauRow.classList.toggle('cme-v2v-persp-active', this.activePerspective === 'xau');
      }
    }

    renderRawStrikesTable() {
      if (!this.currentData || !this.currentData.strikesData) return;
      const S = this.currentData.underlyingPrice;
      const allRows = this.currentData.strikesData;

      let rows = allRows;
      let rangeLabel = 'All Strikes';

      if (this.strikeRangeMode === 'near3') {
        rows = allRows.filter((r) => Math.abs((r.strike - S) / S) <= 0.035);
        rangeLabel = 'Near ±3%';
      } else if (this.strikeRangeMode === 'near10') {
        rows = allRows.filter((r) => Math.abs((r.strike - S) / S) <= 0.105);
        rangeLabel = 'Near ±10%';
      } else if (this.strikeRangeMode === 'sd3') {
        const sd3L = S * 0.96;
        const sd3H = S * 1.04;
        rows = allRows.filter((r) => r.strike >= sd3L && r.strike <= sd3H);
        rangeLabel = '±3 SD';
      } else if (this.strikeRangeMode === 'all') {
        rows = allRows;
        rangeLabel = 'All Strikes';
      } else {
        // Default 'near5': Near ±5%
        rows = allRows.filter((r) => Math.abs((r.strike - S) / S) <= 0.055);
        rangeLabel = 'Near ±5%';
      }

      if (rows.length === 0) rows = allRows;

      this.rawCount.textContent = `(${rows.length} strikes in ${rangeLabel} / ${allRows.length} total)`;
      let html = '';

      for (const r of rows) {
        const diff = r.strike - S;
        const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1);
        const volStlText = r.volStl ? `${r.volStl.toFixed(2)}%` : '-';

        html += `
          <tr>
            <td><strong>${r.strike.toLocaleString()}</strong></td>
            <td style="color: #2962ff;">${r.callVol ? r.callVol.toLocaleString() : '-'}</td>
            <td style="color: #ff9800;">${r.putVol ? r.putVol.toLocaleString() : '-'}</td>
            <td style="color: #ff7043; font-weight: 600;">${volStlText}</td>
            <td style="color: #787b86;">${diffStr}</td>
          </tr>
        `;
      }
      this.rawTbody.innerHTML = html;
    }

    updateCompactHud(stats) {
      if (!stats) return;
      const S = Number(stats.underlyingPrice || 0);
      if (this.miniPrice) {
        this.miniPrice.textContent = S.toFixed(1);
      }
      if (this.mini1sd && stats.stdDevRanges) {
        const lo = stats.stdDevRanges['-1'] || '--';
        const hi = stats.stdDevRanges['+1'] || '--';
        this.mini1sd.textContent = `${lo} — ${hi}`;
      }
      if (this.miniDom) {
        this.miniDom.textContent = `${stats.dominance || 'CALLS'} (+${stats.dominancePct || 0}%)`;
        this.miniDom.style.color = stats.dominance === 'CALLS' ? '#2962ff' : '#ff9800';
      }
      if (this.miniDte) {
        this.miniDte.textContent = stats.is0DTE ? '0 DTE' : `${stats.dte} DTE`;
      }
      // Also update launcher pill text when closed
      if (this.launcher) {
        const lbl = this.launcher.querySelector('.cme-v2v-launcher-text');
        if (lbl) {
          lbl.textContent = `CME Vol2Vol (${S.toFixed(1)} | ${stats.is0DTE ? '0DTE' : stats.dte + 'DTE'})`;
        }
      }
    }

    broadcastState(stats) {
      this.updateCompactHud(stats);

      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const payload = {
            symbol: this.currentData?.symbol || 'COMEX:GCV2026',
            series: this.currentData?.series || '',
            underlyingPrice: Number(this.currentData?.underlyingPrice || 0),
            openPrice: Number(this.currentData?.openPrice || 0),
            atmVolatility: Number(this.currentData?.atmVolatility || 23.58),
            volAnchorPrice: Number(this.currentData?.volAnchorPrice || 0),
            dteMode: this.selectedDteMode || '0',
            resolvedDte: stats?.dte !== undefined ? stats.dte : 0,
            is0Dte: Boolean(stats?.is0DTE),
            dominance: stats?.dominance || 'CALLS',
            dominancePct: stats?.dominancePct || 0,
            pcr: stats?.pcr || 0,
            callPutRatio: stats?.callPutRatio || 0,
            totalCallVol: stats?.totalCallVol || 0,
            totalPutVol: stats?.totalPutVol || 0,
            totalVolume: (stats?.totalCallVol || 0) + (stats?.totalPutVol || 0),
            meanCall: stats?.meanCall || 0,
            meanPut: stats?.meanPut || 0,
            meanBoth: stats?.meanBoth || 0,
            oneStdDevValue: stats?.oneStdDevValue || '0',
            oneStdDevPct: stats?.oneStdDevPct || '0',
            stdDevRanges: stats?.stdDevRanges || {},
            stdDevRangesFromOpen: stats?.stdDevRangesFromOpen || {},
            comparisonQuotes: this.comparisonQuotes || null,
            convertedGc1: this.latestConvertedGc1 || null,
            convertedXau: this.latestConvertedXau || null,
            activePerspective: this.activePerspective || '0dte',
            strikesData: this.currentData?.strikesData || [],
            stats: stats || null,
            currentData: this.currentData || null,
            termStructureData: this.termStructureData || [],
            termStructureMeta: this.termStructureMeta || {},
            updatedAt: Date.now(),
          };
          chrome.storage.local.set({ cme_v2v_live_state: payload });
        }
      } catch (e) {
        // Ignore errors in environments where chrome.storage is not available
      }
    }

    setComparisonQuotes(quotes) {
      if (!quotes) return;
      this.comparisonQuotes = Object.assign(this.comparisonQuotes || {}, quotes);
      if (this.latestStats) {
        this.renderUI(this.latestStats);
        this.broadcastState(this.latestStats);
      }
    }
  }

  return OverlayPanel;
});

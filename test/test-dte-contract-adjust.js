/**
 * test/test-dte-contract-adjust.js
 * Verification of DTE-based underlying futures contract dynamic adjustment
 * (e.g. 0DTE -> COMEX:GCV2026 at 4,355.0 USD vs 30DTE -> COMEX:GCZ2026 at 4,384.8 USD)
 */

const assert = require('assert');
const DataParser = require('../src/core/data-parser.js');
const OptionsMath = require('../src/core/options-math.js');

console.log('================================================================');
console.log(' TEST: DTE-BASED CONTRACT & PRICE DYNAMIC ADJUSTMENT');
console.log('================================================================');

// 1. Test extractUnderlyingInfoFromRow with exact TradingView DOM representation
const mockDomRow = {
  querySelector(sel) {
    if (sel === 'td') {
      return {
        getAttribute(attr) {
          if (attr === 'data-cell-id') return 'COMEX:GCV2026';
          return null;
        },
      };
    }
    if (sel === '[class*="priceWrap"]') {
      return {
        querySelectorAll(s) {
          if (s === 'span') {
            return [
              { textContent: '4,355.0' },
              { textContent: 'USD' },
            ];
          }
          return [];
        },
      };
    }
    return null;
  },
  querySelectorAll(sel) {
    if (sel === 'span') {
      return [
        { textContent: 'GCV2026' },
        { textContent: '4,355.0' },
        { textContent: 'USD' },
        { textContent: '\u221218.7' }, // unicode minus
        { textContent: '\u22120.43%' },
      ];
    }
    return [];
  },
};

const extractedInfo = DataParser.extractUnderlyingInfoFromRow(mockDomRow);
console.log('\n[Extracted DOM Underlying Info]:', extractedInfo);

assert.strictEqual(extractedInfo.price, 4355.0, 'Extracted price must be exactly 4355.0');
assert.strictEqual(extractedInfo.change, -18.7, 'Extracted change must be -18.7');
assert.strictEqual(extractedInfo.changePct, -0.43, 'Extracted changePct must be -0.43');
assert.strictEqual(extractedInfo.openPrice, 4373.7, 'Calculated openPrice must be 4373.7');
assert(
  extractedInfo.symbol.includes('GCV2026'),
  `Extracted symbol must be GCV2026, got: ${extractedInfo.symbol}`
);
console.log('  ✓ Successfully parsed GCV2026 4,355.0 USD -18.7 (-0.43%) from Options Chain DOM');

// 2. Test voi-lens payload processing for 0DTE vs 30DTE
const mockVoiLensPayload = {
  items: [
    {
      id: 'COMEX:GCV2026;OG2;20260911',
      exp: '20260911',
      underlying: 'COMEX:GCV2026',
      strikes: [
        { s: 4340, c: { v: 165, iv: 23.66 }, p: { v: 42, iv: 23.66 } },
        { s: 4355, c: { v: 195, iv: 23.66 }, p: { v: 38, iv: 23.66 } },
        { s: 4360, c: { v: 220, iv: 23.8 }, p: { v: 24, iv: 23.8 } },
      ],
    },
    {
      id: 'COMEX:GCZ2026;OG;20261027',
      exp: '20261027',
      underlying: 'COMEX:GCZ2026',
      strikes: [
        { s: 4380, c: { v: 320, iv: 22.5 }, p: { v: 150, iv: 22.5 } },
        { s: 4400, c: { v: 510, iv: 22.8 }, p: { v: 230, iv: 22.8 } },
      ],
    },
  ],
};

// 0DTE selection
const parsed0Dte = DataParser.processVoiLensPayload(mockVoiLensPayload, 'COMEX:GCV2026;OG2;20260911');
assert.strictEqual(parsed0Dte.symbol, 'COMEX:GCV2026', '0DTE series must map to COMEX:GCV2026');
assert.strictEqual(parsed0Dte.underlyingContract, 'COMEX:GCV2026', 'underlyingContract must be COMEX:GCV2026');
assert.strictEqual(parsed0Dte.dte, 0, '0DTE dte must be 0');
console.log('  ✓ 0DTE series correctly resolves to contract:', parsed0Dte.symbol);

// 30DTE selection
const parsed30Dte = DataParser.processVoiLensPayload(mockVoiLensPayload, 'COMEX:GCZ2026;OG;20261027');
assert.strictEqual(parsed30Dte.symbol, 'COMEX:GCZ2026', 'October series must map to COMEX:GCZ2026');
assert.strictEqual(parsed30Dte.underlyingContract, 'COMEX:GCZ2026', 'underlyingContract must be COMEX:GCZ2026');
console.log('  ✓ 30DTE series correctly resolves to contract:', parsed30Dte.symbol);

// 3. Verify that SD bands calculated at Future Stl = 4355.0 do not snap to arbitrary strike
const stats = OptionsMath.calculateStats({
  underlyingPrice: 4355.0,
  spotPrice: 4355.0,
  openPrice: 4328.0,
  atmVolatility: 23.66,
  dte: 0,
  strikesData: parsed0Dte.strikesData,
});

assert.strictEqual(stats.underlyingPrice, 4355.0, 'Underlying price must remain exactly 4355.0');
assert.strictEqual(stats.stdDevRanges['ATM'], 4355.0, 'ATM range center must be exactly 4355.0');
console.log('  ✓ SD bands center correctly at Future Stl 4355.0 without snapping:', stats.stdDevRanges);

console.log('\n>>> ALL DTE CONTRACT & PRICE ADJUSTMENT TESTS PASSED! <<<');

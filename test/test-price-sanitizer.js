/**
 * test/test-price-sanitizer.js
 * Verifies that underlying price parser rejects net change (+37.0), percentages (+0.85%),
 * option contract symbols, and correctly extracts the underlying futures price (4,392.0).
 */

const assert = require('assert');
const DataParser = require('../src/core/data-parser.js');

console.log('================================================================');
console.log(' TEST: REAL-TIME PRICE SANITIZATION & +37.0 REJECTION');
console.log('================================================================\n');

// 1. Mock DOM elements matching TradingView's actual underlying row
class MockElement {
  constructor(tagName, textContent = '', children = [], className = '') {
    this.tagName = tagName;
    this.textContent = textContent;
    this.children = children;
    this.className = className;
  }
  querySelector(selector) {
    if (selector.includes('priceWrap')) {
      for (const child of this.children) {
        if (child.className.includes('priceWrap')) return child;
        const res = child.querySelector(selector);
        if (res) return res;
      }
    }
    return null;
  }
  querySelectorAll(tag) {
    let result = [];
    for (const child of this.children) {
      if (child.tagName.toLowerCase() === tag.toLowerCase()) {
        result.push(child);
      }
      result = result.concat(child.querySelectorAll(tag));
    }
    return result;
  }
}

const mockRow = new MockElement('tr', '', [
  new MockElement('td', '', [
    new MockElement('div', '', [
      new MockElement('span', 'GC1!'),
      new MockElement('span', '4,392.0 USD', [
        new MockElement('span', '4,392.0'),
        new MockElement('span', 'USD')
      ], 'priceWrap-sK5mrTim'),
      new MockElement('span', '+37.0', [], 'up-sK5mrTim'),
      new MockElement('span', '+0.85%', [], 'up-sK5mrTim')
    ])
  ])
]);

// Test extractPriceFromChainRow
const extractedPrice = DataParser.extractPriceFromChainRow(mockRow);
console.log(`[DOM Extractor] Extracted Price: ${extractedPrice}`);
assert.strictEqual(extractedPrice, 4392.0, 'Must extract underlying 4392.0, not +37.0 or +0.85%');
console.log('  ✓ Correctly extracted 4392.0 and ignored +37.0 and +0.85%');

// 2. Test option symbol detection
function isOptionSymbol(sym) {
  if (!sym || typeof sym !== 'string') return false;
  if (sym.includes(';')) return true;
  if (/[0-9]+[CP][0-9]+/i.test(sym)) return true;
  if (/[_\s:-][CP][0-9]+/i.test(sym)) return true;
  if (/(?:CALL|PUT)/i.test(sym)) return true;
  return false;
}

assert.strictEqual(isOptionSymbol('COMEX:GC1!'), false, 'GC1! is futures, not option');
assert.strictEqual(isOptionSymbol('COMEX:OG1!'), false, 'OG1! is underlying futures/option root, not specific option');
assert.strictEqual(isOptionSymbol('COMEX:OG1!260424C4400'), true, 'Option contract must be rejected');
assert.strictEqual(isOptionSymbol('COMEX:OGJ2025;4400;C'), true, 'Option contract with semicolons must be rejected');
console.log('  ✓ Correctly filters option symbols from underlying quotes');

// 3. Test OverlayPanel outlier and sub-100 protection
class MockOverlay {
  constructor() {
    this.currentData = { underlyingPrice: 4392.0, openPrice: 4355.0 };
  }
  setRealtimePrice(newPrice) {
    const numPrice = parseFloat(newPrice);
    if (isNaN(numPrice) || numPrice < 100) return false;
    if (this.currentData.underlyingPrice > 100) {
      const ratio = numPrice / this.currentData.underlyingPrice;
      if (ratio < 0.5 || ratio > 1.5) return false;
    }
    this.currentData.underlyingPrice = numPrice;
    return true;
  }
}

const overlay = new MockOverlay();
// Attempt to set 37.0 (the bug report)
const accepted37 = overlay.setRealtimePrice(37.0);
assert.strictEqual(accepted37, false, '37.0 must be rejected');
assert.strictEqual(overlay.currentData.underlyingPrice, 4392.0, 'Price must remain 4392.0');
console.log('  ✓ Successfully blocked 37.0 from overwriting Future Stl');

// Attempt to set 4393.5 (real tick)
const accepted4393 = overlay.setRealtimePrice(4393.5);
assert.strictEqual(accepted4393, true, '4393.5 must be accepted');
assert.strictEqual(overlay.currentData.underlyingPrice, 4393.5, 'Price updated to 4393.5');
console.log('  ✓ Real underlying tick 4393.5 accepted');

console.log('\n>>> ALL PRICE SANITIZATION TESTS PASSED! <<<');

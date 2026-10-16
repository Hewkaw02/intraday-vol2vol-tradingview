/**
 * Unified Test Runner — Runs all 10 automated verification suites
 */
const { execFileSync } = require('child_process');
const path = require('path');

const suites = [
  'test-math.js',
  'test-vol-anchor.js',
  'test-price-sanitizer.js',
  'test-dte-contract-adjust.js',
  'test-popup-sync.js',
  'test-comparison-diff.js',
  'test-perspective-shift.js',
  'test-dashboard-sync.js',
  'test-anchor-bell-curve-and-legend.js',
  'test-series-vol.js',
];

let passed = 0;
let failed = 0;

console.log('================================================================');
console.log(' CME Vol2Vol Options Intelligence — Full Test Suite');
console.log('================================================================\n');

for (const file of suites) {
  const fullPath = path.join(__dirname, file);
  try {
    execFileSync(process.execPath, [fullPath], { stdio: 'pipe' });
    console.log(`  [PASS] ${file}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${file}`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    failed++;
  }
}

console.log('\n================================================================');
console.log(` SUMMARY: ${passed}/${suites.length} test suites passed`);
console.log('================================================================');

if (failed > 0) process.exit(1);

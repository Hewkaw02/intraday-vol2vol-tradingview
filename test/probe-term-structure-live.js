// Live E2E: voi-lens -> scanner quotes -> options IV -> term structure (same logic as content.js)
const OptionsMath = require('../src/core/options-math.js');
const DataParser = require('../src/core/data-parser.js');

(async () => {
  const vl = await (await fetch('https://options-charting.tradingview.com/v1/voi-lens/COMEX:GC1!?include_expired_series=true')).json();
  const now = Date.now();
  const up = vl.items.map(it => ({ it, expMs: OptionsMath.resolveExpiryMs(it.exp_time, it.exp) }))
    .filter(x => x.it.underlying && x.expMs > now).sort((a, b) => a.expMs - b.expMs).slice(0, 10);
  const byU = {};
  for (const c of up) (byU[c.it.underlying] = byU[c.it.underlying] || []).push(c);
  const all = [];
  for (const [und, list] of Object.entries(byU)) {
    const q = await (await fetch(`https://scanner.tradingview.com/symbol?symbol=${encodeURIComponent(und)}&fields=close`)).json();
    const F = q.close;
    const exps = list.map(x => Number(x.it.exp));
    const body = {
      filter: [
        { left: 'type', operation: 'equal', right: 'option' },
        { left: 'expiration', operation: 'in_range', right: [Math.min(...exps), Math.max(...exps)] },
        { left: 'strike', operation: 'in_range', right: [F * 0.97, F * 1.03] },
      ],
      columns: DataParser.SCANNER_IV_COLUMNS,
      index_filters: [{ name: 'underlying_symbol', values: [und] }],
      range: [0, 5000],
    };
    const ivJson = await (await fetch('https://scanner.tradingview.com/options/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    const smiles = DataParser.parseScannerOptionIvRows(ivJson);
    console.log(`${und} F=${F} rows=${ivJson.totalCount} smiles=${Object.keys(smiles).length}`);
    for (const { it, expMs } of list) {
      const sm = smiles[`${it.exp}|${it.family}`] || Object.values(smiles).find(s => String(s.exp) === String(it.exp));
      const v = DataParser.sumSeriesVolume(it);
      all.push({ id: it.id, exp: it.exp, expTime: expMs, family: it.family, underlying: und, forward: F,
        ivPoints: sm ? sm.points : [], totalCallVol: v.call, totalPutVol: v.put, dte: DataParser.calculateDteFromSeries(it.exp) });
    }
  }
  const rows = OptionsMath.calculateSeriesVolTermStructure(all, { now: Date.now() });
  console.table(rows.map(r => ({ fam: r.family, exp: r.exp, und: r.underlying, F: r.forward, hrs: r.hoursToExpiry.toFixed(1),
    atmIV: r.atmIV, move: r.expectedMove, fwd: r.forwardVol ?? (r.forwardInverted ? 'INV' : '--'), vol: r.totalVol })));
  const missing = all.filter(s => s.ivPoints.length === 0).map(s => `${s.family} ${s.exp}`);
  console.log('Series without IV:', missing.length ? missing.join(', ') : 'none');
})().catch(e => { console.error(e); process.exit(1); });

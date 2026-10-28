import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = ts.transpileModule(await readFile(new URL('../src/main.mts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const D = 'QmXCPG1uRf1YhxYmzdr83kQSEoviL4ja2e5JBB4KezvpE9', H = '0x' + 'a'.repeat(64);
const P = '0xa98dacb3fc964a6a0d2ce3b77294241585eaba6d', a = n => '0x' + n.toString(16).padStart(40, '0');
const market = n => ({ id: a(n * 4), outputToken: { id: a(n * 4) }, protocol: { id: P },
  inputToken: { id: a(n * 4 + 1), name: 'Asset ' + n, symbol: 'ASSET' + n },
  _vToken: { id: a(n * 4 + 2), name: 'Spark Variable Debt Asset ' + n, symbol: 'variableDebt' + n },
  _sToken: { id: a(n * 4 + 3), name: 'Spark Stable Debt Asset ' + n, symbol: 'stableDebt' + n } });
async function fixture(rows, settings = {}) {
  const requests = [], context = vm.createContext({ AbortController, setTimeout, clearTimeout });
  const fetch = async (url, options) => {
    assert.equal(url, 'https://gateway.thegraph.com/api/deployments/id/' + D);
    assert.equal(options.headers.Authorization, 'Bearer synthetic-key');
    const query = JSON.parse(options.body).query; requests.push(query);
    const meta = { deployment: D, hasIndexingErrors: false, block: { number: 100, hash: H } };
    let data = { _meta: meta };
    if (query.includes('markets(')) {
      assert.ok(query.includes(H)); const cursor = JSON.parse(/id_gt: ("[^"]*")/.exec(query)[1]);
      data = { _meta: settings.changedBlock ? { ...meta, block: { number: 101, hash: H } } : meta,
        markets: rows.filter(v => v.id > cursor).slice(0, 1000) };
    }
    return { ok: !settings.httpError, json: async () => settings.graphError ? { errors: [{ message: 'failed' }] } : { data } };
  };
  const m = new vm.SourceTextModule(source, { context });
  await m.link(async name => { assert.equal(name, 'node-fetch'); return new vm.SyntheticModule(['default'], function () {
    this.setExport('default', fetch);
  }, { context }); });
  await m.evaluate(); return { run: m.namespace.returnTags, requests };
}
test('returns both complete debt roles with official names and excludes deposit receipts', async () => {
  const row = market(1), f = await fixture([row]), tags = await f.run('100', 'synthetic-key');
  assert.equal(tags.length, 2); assert.deepEqual(Array.from(tags, v => v['Contract Address']), ['eip155:100:' + row._vToken.id, 'eip155:100:' + row._sToken.id]);
  assert.deepEqual(Array.from(tags, v => v['Public Name Tag']), [row._vToken.name, row._sToken.name]);
  assert.ok(tags.every(v => v['Public Note'].includes('ERC-20') && v['Public Note'].includes('historical')));
  assert.ok(tags[1]['Public Note'].includes('not a stablecoin'));
});
test('enumerates a full page and a final empty page without trimming historical debt roles', async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => market(i + 1)), f = await fixture(rows);
  assert.equal((await f.run('100', 'synthetic-key')).length, 2000);
  assert.equal(f.requests.filter(q => q.includes('markets(')).length, 2);
});
test('invalid chain arguments and absent key fail before requests', async () => {
  const f = await fixture([market(1)]);
  for (const chain of [100, '1', '__proto__', null]) await assert.rejects(f.run(chain, 'synthetic-key'), /Unsupported/);
  await assert.rejects(f.run('100', ''), /API key/); assert.equal(f.requests.length, 0);
});
test('null debt reference is absent; unknown reserve identity and source errors fail atomically', async () => {
  const row = market(1); row._sToken = null;
  assert.equal((await (await fixture([row])).run('100', 'synthetic-key')).length, 1);
  const bad = market(2); bad.outputToken = null;
  await assert.rejects((await fixture([market(1), bad])).run('100', 'synthetic-key'), /Missing reserve identity/);
  for (const settings of [{ httpError: true }, { graphError: true }, { changedBlock: true }])
    await assert.rejects((await fixture([market(1)], settings)).run('100', 'synthetic-key'));
});
test('long official names use ellipsis and contradictory protocol or token identities hold', async () => {
  const row = market(1); row._vToken.name = 'A'.repeat(60);
  assert.equal((await (await fixture([row])).run('100', 'synthetic-key'))[0]['Public Name Tag'], 'A'.repeat(47) + '...');
  const bad = market(2); bad.protocol.id = a(9000);
  await assert.rejects((await fixture([market(1), bad])).run('100', 'synthetic-key'), /provider/);
  const duplicate = market(2); duplicate._sToken.id = duplicate._vToken.id;
  await assert.rejects((await fixture([duplicate])).run('100', 'synthetic-key'), /repeated accounting/);
});

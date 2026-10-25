const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('src/clientDirectory.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const context = vm.createContext({ exports: {} });
vm.runInContext(code, context);
const { buildClientDirectory, recentJobs, filterClients, readClients, readJobs } = context.exports;
const client = (id, first_name, last_name, city = '') => ({ id, first_name, last_name, city });
const job = (id, client_name, date = '2026-10-17T10:00:00Z') => ({ id, client_name, created_at: date, status: 'rozpracovano' });

test('clients created by JARVIS appear even without a job', () => {
  const entries = buildClientDirectory([client('c1', 'Jiří', 'Boček', 'Praha')], []);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'c1');
  assert.equal(entries[0].jobs.length, 0);
  assert.equal(entries[0].city, 'Praha');
});
test('surname sorting follows Czech alphabet, including Ch and accented letters', () => {
  const entries = buildClientDirectory([
    client('z', 'Anna', 'Žáková'), client('i', 'Zdeněk', 'Ivanov'),
    client('ch', 'Petr', 'Chalupa'), client('h', 'Zuzana', 'Hájková'), client('b', 'Jiří', 'Boček'),
  ], []);
  assert.equal(entries.map(x => x.id).join(','), 'b,h,ch,i,z');
});
test('all historical jobs remain reachable exactly once, alongside clients without jobs', () => {
  const jobs = Array.from({ length: 27 }, (_, i) => job(`j${i}`, i % 3 ? 'Jiří Boček' : 'Starý zákazník'));
  jobs.push(job('anonymous', ''));
  const entries = buildClientDirectory([client('c1', 'Jiří', 'Boček'), client('c2', 'Eva', 'Nová')], jobs);
  const ids = entries.flatMap(x => Array.from(x.jobs, j => j.id));
  assert.equal(ids.length, jobs.length);
  assert.equal(new Set(ids).size, jobs.length);
  assert.equal(entries.find(x => x.id === 'c2').jobs.length, 0);
  assert.equal(entries.at(-1).name, 'Bez klienta');
});
test('historical client names match spacing, case, canonical accents and reversed name order', () => {
  const entries = buildClientDirectory([client('c1', 'Jiří', 'Boček')], [
    job('j1', '  JIŘÍ   BOČEK '), job('j2', 'Boček, Jiří'), job('j3', 'Jiří Boček'.normalize('NFD')),
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].jobs.length, 3);
});
test('namesakes never receive each other’s ambiguous historical jobs', () => {
  const entries = buildClientDirectory([client('a', 'Jan', 'Novák', 'Praha'), client('b', 'Jan', 'Novák', 'Brno')], [job('j', 'Jan Novák')]);
  assert.equal(entries.find(x => x.id === 'a').jobs.length, 0);
  assert.equal(entries.find(x => x.id === 'b').jobs.length, 0);
  const unmatched = entries.find(x => x.legacy);
  assert.equal(unmatched.jobs[0].id, 'j');
  assert.equal(unmatched.ambiguous, true);
});
test('client search ignores accents and searches city as well', () => {
  const entries = buildClientDirectory([client('c1', 'Jiří', 'Boček', 'Plzeň'), client('c2', 'Eva', 'Nová', 'Praha')], []);
  assert.equal(filterClients(entries, 'bocek')[0].id, 'c1');
  assert.equal(filterClients(entries, 'plzen')[0].id, 'c1');
});
test('main directory shows the globally newest ten, without mutating the API response', () => {
  const jobs = Array.from({ length: 18 }, (_, i) => job(`j${i}`, 'Klient', `2026-10-${String(i + 1).padStart(2, '0')}T12:00:00Z`));
  const recent = recentJobs(jobs);
  assert.equal(recent.length, 10);
  assert.equal(recent[0].id, 'j17');
  assert.equal(recent[9].id, 'j8');
  assert.equal(jobs[0].id, 'j0');
  assert.equal(buildClientDirectory([], jobs)[0].jobs.length, 18);
});
test('search/status filters do not reintroduce older archived jobs into the latest ten', () => {
  const jobs = Array.from({ length: 11 }, (_, i) => ({ ...job(`j${i}`, i ? 'Jiří Boček' : 'Starý klient', `2026-10-${String(i + 1).padStart(2, '0')}T12:00:00Z`), status: i ? 'rozpracovano' : 'dokonceno' }));
  assert.equal(recentJobs(jobs, 'Starý').length, 0);
  assert.equal(recentJobs(jobs, '', 'dokonceno').length, 0);
  assert.equal(recentJobs(jobs, 'bocek', 'rozpracovano').length, 10);
  assert.equal(buildClientDirectory([], jobs).find(x => x.name === 'Starý klient').jobs.length, 1);
});
test('API adapters accept existing arrays and wrapped lists, and reject failed response shapes', () => {
  assert.equal(readClients({ clients: [client('a', 'Jan', 'Novák')] })[0].id, 'a');
  assert.equal(readJobs([job('j', 'Jan Novák')])[0].id, 'j');
  assert.throws(() => readClients({ error: 'unavailable' }));
  assert.throws(() => readJobs(null));
});

test('historical-client route IDs are URL-safe, stable and distinguish literal percent/slash names', () => {
  const entries = buildClientDirectory([], [job('a', 'Starší firma'), job('b', 'A/B'), job('c', 'A%2FB')]);
  for (const entry of entries) {
    assert.match(entry.id, /^legacy:[0-9a-f-]*$/);
    assert.equal(decodeURIComponent(decodeURIComponent(encodeURIComponent(entry.id))), entry.id);
  }
  assert.equal(new Set(entries.map(x => x.id)).size, 3);
  const refreshed = buildClientDirectory([], [job('new', 'Starší firma'), job('old', 'Starší firma')]);
  assert.equal(refreshed[0].id, entries.find(x => x.name === 'Starší firma').id);
});

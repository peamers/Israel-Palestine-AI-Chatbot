'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, loadDataset, queryDataset, runQuery, createServer, DATASET } = require('./server');

const data = loadDataset(DATASET);

test('CSV parser preserves quoted commas, newlines and escaped quotes', () => {
  assert.deepEqual(parseCsv('a,b\r\n"one,\ntwo","say ""hi"""\r\n'), [
    ['a', 'b'], ['one,\ntwo', 'say "hi"']
  ]);
  assert.throws(() => parseCsv('a,"unfinished'), /Unclosed/);
  assert.throws(() => parseCsv('"a"x,b'), /Malformed/);
});

test('real CSV count and missing classifications are represented accurately', () => {
  const result = queryDataset(DATASET, data.hash, `SELECT COUNT(*) AS total,
    COUNT(CASE WHEN took_part_in_the_hostilities IS NULL THEN 1 END) AS missing,
    COUNT(CASE WHEN took_part_in_the_hostilities = 'Unknown' THEN 1 END) AS unknown
    FROM fatalities`);
  assert.deepEqual({ ...result.rows[0] }, { total: 11124, missing: 1430, unknown: 603 });
});

test('record identifiers identify CSV records and oversized listings are marked', () => {
  const one = queryDataset(DATASET, data.hash, 'SELECT record_id, name FROM fatalities WHERE record_id = 2');
  assert.equal(one.rows[0].name, data.rows[0][0]);
  const many = queryDataset(DATASET, data.hash, 'SELECT record_id FROM fatalities ORDER BY record_id');
  assert.equal(many.rows.length, 100);
  assert.equal(many.truncated, true);
  const exact = queryDataset(DATASET, data.hash, 'SELECT record_id FROM fatalities WHERE record_id < 102');
  assert.equal(exact.rows.length, 100);
  assert.equal(exact.truncated, false);
});

test('only permitted read queries run against the original fingerprint', () => {
  assert.throws(() => queryDataset(DATASET, data.hash, 'DELETE FROM fatalities'), /read-only/);
  assert.throws(() => queryDataset(DATASET, data.hash, 'SELECT 1; DELETE FROM fatalities'), /read-only/);
  assert.throws(() => queryDataset(DATASET, data.hash, 'SELECT * FROM sqlite_schema'), /access|authoriz/i);
  assert.throws(() => queryDataset(DATASET, data.hash, "SELECT load_extension('example')"), /authoriz/i);
  assert.throws(() => queryDataset(DATASET, 'wrong hash', 'SELECT 1'), /changed/);
  assert.throws(() => queryDataset(DATASET, data.hash, 'SELECT name, name FROM fatalities'), /duplicate/);
});

test('worker returns actual query results', async () => {
  const result = await runQuery(DATASET, data.hash, "SELECT COUNT(*) AS n FROM fatalities WHERE citizenship = 'Israeli'");
  assert.equal(result.rows[0].n, 1029);
});

test('local HTTP flow executes the model SQL and rejects cross-origin requests', async t => {
  const fakeModel = async (question, history) => {
    assert.equal(question, 'How many records?');
    assert.deepEqual(history, []);
    return { message: 'Count the records.', sql: 'SELECT COUNT(*) AS total FROM fatalities' };
  };
  const server = createServer(data, fakeModel);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base)).status, 200);
  const input = JSON.stringify({ question: 'How many records?', history: [] });
  const rejected = await fetch(`${base}/api/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' }, body: input });
  assert.equal(rejected.status, 403);
  const response = await fetch(`${base}/api/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: input });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.rows[0].total, 11124);
  assert.equal(result.sql, 'SELECT COUNT(*) AS total FROM fatalities');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DDG_BASE_URL, listTools, getTool, getSchemas, callTool } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'tools.json'), 'utf8'));
const tools = raw.tools;

// These tests never touch the network.

test('tools.json parses and base URL is consistent', () => {
  assert.ok(Array.isArray(tools));
  assert.equal(raw.base_url, DDG_BASE_URL);
  assert.match(DDG_BASE_URL, /^https:\/\//);
});

test('catalog declares at least 20 paid tools', () => {
  const paid = tools.filter((t) => t.free !== true && t.price_usd > 0);
  assert.ok(paid.length >= 20, `expected >= 20 paid tools, got ${paid.length}`);
});

test('catalog includes free metadata tools', () => {
  const free = tools.filter((t) => t.free === true);
  assert.ok(free.length >= 3, `expected >= 3 free tools, got ${free.length}`);
});

test('every tool has a valid OpenAI function schema', () => {
  for (const t of tools) {
    const s = t.openai_schema;
    assert.equal(s.type, 'function', `${t.name}: schema type`);
    assert.equal(typeof s.function, 'object', `${t.name}: function missing`);
    assert.equal(s.function.name, t.name, `${t.name}: schema name must match tool name`);
    assert.equal(typeof s.function.description, 'string', `${t.name}: description`);

    const p = s.function.parameters;
    assert.equal(typeof p, 'object', `${t.name}: parameters missing`);
    assert.equal(p.type, 'object', `${t.name}: parameters.type`);
    assert.equal(typeof p.properties, 'object', `${t.name}: parameters.properties`);
    assert.ok(Array.isArray(p.required), `${t.name}: parameters.required`);
    assert.ok(
      Object.keys(p.properties).length <= 6,
      `${t.name}: more than 6 parameters`,
    );
  }
});

test('listTools() and getSchemas() lengths match the catalog', () => {
  assert.equal(listTools().length, tools.length);
  assert.equal(getSchemas().length, tools.length);
  assert.equal(getSchemas().length, listTools().length);
});

test('getSchemas() returns OpenAI-shaped function objects', () => {
  for (const s of getSchemas()) {
    assert.equal(s.type, 'function');
    assert.equal(typeof s.function.name, 'string');
  }
});

test('getTool returns metadata for a known name, undefined otherwise', () => {
  const t = getTool('chainsGas');
  assert.ok(t, 'chainsGas should exist');
  assert.equal(t.path, '/v1/chains/gas');
  assert.equal(t.method, 'POST');
  assert.equal(getTool('not-a-real-tool'), undefined);
});

test('tool names are unique', () => {
  const names = tools.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
});

test('callTool throws on an unknown tool without touching the network', async () => {
  await assert.rejects(() => callTool('nope', {}), /Unknown DDG tool/);
});

// Compatibility shim: newer Node releases no longer expand a bare directory
// argument for the test runner, so `node --test test/` resolves this file.
// It simply re-exports the suite. `node --test test/tools.test.mjs` and the
// default `node --test` discovery both work with or without this file.
import './tools.test.mjs';

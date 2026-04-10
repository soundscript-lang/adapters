import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, 'package.json'), 'utf8'));

test('webpack-loader package manifest exposes the expected dependency contract', () => {
  assert.equal(pkg.name, '@soundscript/webpack-loader');
  assert.equal(pkg.version, '0.1.22');
  assert.equal(pkg.dependencies?.['@soundscript/adapter-core'], undefined);
  assert.equal(pkg.peerDependencies['@soundscript/soundscript'], '^0.1.22');
  assert.equal(pkg.peerDependencies.webpack, '^5.0.0');
  assert.equal(pkg.exports['.'].default, './index.js');
  assert.deepEqual(pkg.files, ['index.js', 'index.d.ts', 'README.md', 'LICENSE']);
});

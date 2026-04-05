import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageDirectories = [
  'packages/register',
  'packages/vite',
  'packages/webpack-loader',
  'packages/bun-plugin',
];

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

const packages = packageDirectories.map((directory) => ({
  directory,
  manifest: readJson(join(directory, 'package.json')),
}));

const [firstPackage] = packages;
assert(firstPackage, 'Expected at least one adapter package.');

const releaseVersion = firstPackage.manifest.version;
assert.equal(typeof releaseVersion, 'string');

for (const { directory, manifest } of packages) {
  assert.equal(
    manifest.version,
    releaseVersion,
    `${directory} should use release version ${releaseVersion}.`,
  );
  assert.equal(
    manifest.dependencies?.['@soundscript/adapter-core'],
    undefined,
    `${directory} should not depend on @soundscript/adapter-core.`,
  );
  assert.equal(
    manifest.peerDependencies?.['@soundscript/soundscript'],
    `^${releaseVersion}`,
    `${directory} should peer depend on @soundscript/soundscript ^${releaseVersion}.`,
  );
}

console.log(
  JSON.stringify(
    {
      releaseVersion,
      packages: packages.map(({ manifest }) => manifest.name),
    },
    null,
    2,
  ),
);

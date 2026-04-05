import { execFileSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const packages = [
  {
    directory: 'register',
    name: '@soundscript/register',
    requiredFiles: ['LICENSE', 'README.md', 'index.d.ts', 'index.js', 'package.json'],
  },
  {
    directory: 'vite',
    name: '@soundscript/vite',
    requiredFiles: ['LICENSE', 'README.md', 'index.d.ts', 'index.js', 'package.json'],
  },
  {
    directory: 'webpack-loader',
    name: '@soundscript/webpack-loader',
    requiredFiles: ['LICENSE', 'README.md', 'index.d.ts', 'index.js', 'package.json'],
  },
  {
    directory: 'bun-plugin',
    name: '@soundscript/bun-plugin',
    requiredFiles: ['LICENSE', 'README.md', 'index.d.ts', 'index.js', 'package.json'],
  },
];

const results = [];

for (const pkg of packages) {
  const packageDir = path.join(repoRoot, 'packages', pkg.directory);
  const packOutput = execFileSync('npm', ['pack', '--json', '--dry-run'], {
    cwd: packageDir,
    encoding: 'utf8',
  });
  const [packResult] = JSON.parse(packOutput);

  if (!packResult) {
    throw new Error(`npm pack --json --dry-run did not return a result for ${pkg.name}`);
  }

  if (packResult.name !== pkg.name) {
    throw new Error(`expected packed name ${pkg.name}, got ${packResult.name}`);
  }

  const includedFiles = new Set(packResult.files.map((file) => file.path));
  for (const requiredFile of pkg.requiredFiles) {
    if (!includedFiles.has(requiredFile)) {
      throw new Error(`${pkg.name} is missing ${requiredFile} in npm pack output`);
    }
  }

  if (packResult.entryCount !== pkg.requiredFiles.length) {
    throw new Error(
      `${pkg.name} expected ${pkg.requiredFiles.length} packed files, got ${packResult.entryCount}`,
    );
  }

  results.push({
    package: packResult.id,
    verifiedFiles: pkg.requiredFiles,
  });
}

console.log(JSON.stringify(results, null, 2));

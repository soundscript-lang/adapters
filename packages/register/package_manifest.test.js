import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, 'package.json'), 'utf8'));

test('register package manifest exposes the expected dependency contract', () => {
  assert.equal(pkg.name, '@soundscript/register');
  assert.equal(pkg.version, '0.1.22');
  assert.equal(pkg.dependencies?.['@soundscript/adapter-core'], undefined);
  assert.equal(pkg.peerDependencies['@soundscript/soundscript'], '^0.1.22');
  assert.equal(pkg.exports['.'].default, './index.js');
  assert.deepEqual(pkg.files, ['index.js', 'index.d.ts', 'README.md', 'LICENSE']);
});

test('register package works as a Node --import preload for .sts entrypoints', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'soundscript-register-preload-'));
  const packRoot = await mkdtemp(join(tmpdir(), 'soundscript-register-pack-'));
  const soundscriptStubRoot = await mkdtemp(join(tmpdir(), 'soundscript-register-peer-'));
  await mkdir(join(projectRoot, 'src'), { recursive: true });
  await mkdir(join(soundscriptStubRoot, 'project-transform'), { recursive: true });
  await writeFile(
    join(projectRoot, 'package.json'),
    `${JSON.stringify({ name: 'register-preload-test', private: true, type: 'module' }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(projectRoot, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
        },
        include: ['src/**/*.sts'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(join(projectRoot, 'src', 'main.sts'), 'console.log(42);\n', 'utf8');
  await writeFile(
    join(soundscriptStubRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@soundscript/soundscript',
        version: '0.1.22',
        type: 'module',
        exports: {
          './project-transform': {
            import: './project-transform/index.js',
            default: './project-transform/index.js',
          },
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    join(soundscriptStubRoot, 'project-transform', 'index.js'),
    [
      "import { readFileSync } from 'node:fs';",
      '',
      'export function createOnDemandTransformer() {',
      '  return {',
      '    resolveImportSpecifier() {',
      '      return undefined;',
      '    },',
      '    shouldTransformFile(fileName) {',
      "      return fileName.endsWith('.sts');",
      '    },',
      '    transformModuleSync(fileName) {',
      "      const code = readFileSync(fileName, 'utf8');",
      '      return {',
      '        code,',
      "        mapText: '{\"version\":3,\"sources\":[],\"names\":[],\"mappings\":\"\"}',",
      "        projectPath: fileName,",
      '      };',
      '    },',
      '  };',
      '}',
      '',
      'export function inlineSourceMapComment(mapText) {',
      "  return `//# sourceMappingURL=data:application/json;base64,${Buffer.from(mapText).toString('base64')}`;",
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  const pack = spawnSync(
    'npm',
    ['pack', '--silent', '--pack-destination', packRoot],
    {
      cwd: import.meta.dirname,
      encoding: 'utf8',
      stdio: 'pipe',
    },
  );
  assert.equal(
    pack.status,
    0,
    `npm pack failed.\nstdout:\n${pack.stdout}\nstderr:\n${pack.stderr}`,
  );
  const tarballName = pack.stdout.trim().split('\n').at(-1);
  assert.notEqual(tarballName, undefined, 'npm pack did not return a tarball name.');

  const install = spawnSync(
    'npm',
    ['install', '--silent', soundscriptStubRoot, join(packRoot, tarballName)],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    },
  );
  assert.equal(
    install.status,
    0,
    `npm install failed.\nstdout:\n${install.stdout}\nstderr:\n${install.stderr}`,
  );

  const run = spawnSync(
    'node',
    ['--import', '@soundscript/register', './src/main.sts'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    },
  );
  assert.equal(
    run.status,
    0,
    `node preload failed.\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
  );
  assert.equal(run.stdout.trim(), '42');
});

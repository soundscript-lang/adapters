import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function requiredPath(envVarName) {
  const value = process.env[envVarName];
  if (!value) {
    throw new Error(`Missing required environment variable ${envVarName}.`);
  }

  const resolved = resolve(value);
  if (!existsSync(resolved)) {
    throw new Error(`${envVarName} does not exist: ${resolved}`);
  }

  return resolved;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(' ')} failed.`,
        result.stdout ? `stdout:\n${result.stdout}` : '',
        result.stderr ? `stderr:\n${result.stderr}` : '',
      ].filter(Boolean).join('\n'),
    );
  }

  return result.stdout.trim();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function packWorkspacePackage(packageDirectory, packDirectory) {
  const tarballName = run(
    'npm',
    ['pack', '--silent', '--pack-destination', packDirectory],
    { cwd: join(root, packageDirectory) },
  ).split('\n').at(-1);

  if (!tarballName) {
    throw new Error(`npm pack did not return a tarball name for ${packageDirectory}.`);
  }

  return join(packDirectory, tarballName);
}

async function writeProjectFile(projectRoot, relativePath, contents) {
  const fullPath = join(projectRoot, relativePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, contents, 'utf8');
}

function runNodeEval(projectRoot, source) {
  return run('node', ['--input-type=module', '--eval', source], { cwd: projectRoot });
}

function runJsonNodeEval(projectRoot, source) {
  return JSON.parse(runNodeEval(projectRoot, source));
}

function bunIsAvailable() {
  const result = spawnSync('bun', ['--version'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return result.status === 0;
}

async function main() {
  const canonicalTarballPath = requiredPath('SOUNDSCRIPT_CANONICAL_TARBALL');
  const packDirectory = await mkdtemp(join(tmpdir(), 'soundscript-adapters-pack-'));
  const projectRoot = await mkdtemp(join(tmpdir(), 'soundscript-adapters-smoke-'));

  try {
    const registerTarballPath = packWorkspacePackage('packages/register', packDirectory);
    const viteTarballPath = packWorkspacePackage('packages/vite', packDirectory);
    const webpackLoaderTarballPath = packWorkspacePackage(
      'packages/webpack-loader',
      packDirectory,
    );
    const bunPluginTarballPath = packWorkspacePackage('packages/bun-plugin', packDirectory);

    await writeProjectFile(
      projectRoot,
      'package.json',
      JSON.stringify(
        {
          name: 'soundscript-adapter-smoke',
          private: true,
          type: 'module',
        },
        null,
        2,
      ) + '\n',
    );
    await writeProjectFile(
      projectRoot,
      'tsconfig.json',
      JSON.stringify(
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
      ) + '\n',
    );

    run(
      'npm',
      [
        'install',
        '--silent',
        'vite@6',
        'webpack@5',
        canonicalTarballPath,
        registerTarballPath,
        viteTarballPath,
        webpackLoaderTarballPath,
        bunPluginTarballPath,
      ],
      { cwd: projectRoot },
    );

    await writeProjectFile(projectRoot, 'src/helper.sts', 'export const helper = 21;\n');
    await writeProjectFile(
      projectRoot,
      'src/macros.macro.sts',
      [
        "import { macroSignature } from 'sts:macros';",
        '',
        '// #[macro(call)]',
        'export function Twice() {',
        '  return {',
        '    signature: macroSignature.of(macroSignature.expr("value")),',
        '    expand(ctx: any, signature: any) {',
        '      if (!signature) {',
        "        throw new Error('expected signature');",
        '      }',
        '      return ctx.output.expr(ctx.quote.expr`(${signature.args.value}) * 2`);',
        '    },',
        '  };',
        '}',
        '',
      ].join('\n'),
    );
    await writeProjectFile(
      projectRoot,
      'src/main.sts',
      [
        "import { Twice } from './macros.macro';",
        "import { helper } from './helper';",
        'export const doubled = Twice(helper);',
        '',
      ].join('\n'),
    );

    const registerPayload = runJsonNodeEval(
      projectRoot,
      [
        "import { pathToFileURL } from 'node:url';",
        "import { join } from 'node:path';",
        "import { registerSoundscriptHooks } from '@soundscript/register';",
        'const projectRoot = process.cwd();',
        'await registerSoundscriptHooks({ workingDirectory: projectRoot });',
        "const loaded = await import(pathToFileURL(join(projectRoot, 'src', 'main.sts')).href);",
        'console.log(JSON.stringify(loaded));',
      ].join('\n'),
    );
    assert(registerPayload.doubled === 42, '@soundscript/register did not load the macro fixture.');

    run(
      'node',
      ['--import', '@soundscript/register', './src/main.sts'],
      { cwd: projectRoot },
    );

    const vitePayload = runJsonNodeEval(
      projectRoot,
      [
        "import { mkdtemp, readFile, rm } from 'node:fs/promises';",
        "import { tmpdir } from 'node:os';",
        "import { join } from 'node:path';",
        "import { pathToFileURL } from 'node:url';",
        "import { build } from 'vite';",
        "import { soundscriptVitePlugin } from '@soundscript/vite';",
        'const projectRoot = process.cwd();',
        'const outDir = await mkdtemp(join(tmpdir(), "soundscript-vite-build-"));',
        'try {',
        '  await build({',
        '    appType: "custom",',
        '    configFile: false,',
        '    logLevel: "silent",',
        '    plugins: [soundscriptVitePlugin({ workingDirectory: projectRoot })],',
        '    root: projectRoot,',
        '    build: {',
        '      outDir,',
        '      emptyOutDir: false,',
        '      lib: { entry: join(projectRoot, "src", "main.sts"), formats: ["es"], fileName: () => "main.js" },',
        '    },',
        '  });',
        '  const fileName = "main.js";',
        '  const outputPath = join(outDir, fileName);',
        '  const code = await readFile(outputPath, "utf8");',
        '  const loaded = await import(pathToFileURL(outputPath).href);',
        '  console.log(JSON.stringify({ code, fileName, doubled: loaded.doubled }));',
        '} finally {',
        '  await rm(outDir, { recursive: true, force: true });',
        '}',
      ].join('\n'),
    );
    assert(
      vitePayload.fileName === 'main.js',
      '@soundscript/vite did not emit the expected build output.',
    );
    assert(String(vitePayload.code).includes('doubled'), '@soundscript/vite did not keep the export.');
    assert(
      String(vitePayload.code).includes('__sts_macro_expr(') === false,
      '@soundscript/vite left macro placeholders in the built output.',
    );
    assert(vitePayload.doubled === 42, '@soundscript/vite built output did not execute correctly.');

    const webpackPayload = runJsonNodeEval(
      projectRoot,
      [
        "import { mkdtemp, readFile, rm } from 'node:fs/promises';",
        "import { tmpdir } from 'node:os';",
        "import { join } from 'node:path';",
        "import { pathToFileURL } from 'node:url';",
        "import webpack from 'webpack';",
        'const outDir = await mkdtemp(join(tmpdir(), "soundscript-webpack-build-"));',
        'try {',
        '  const stats = await new Promise((resolve, reject) => {',
        '    webpack({',
        '      context: process.cwd(),',
        '      mode: "development",',
        '      target: "node",',
        '      entry: "./src/main.sts",',
        '      experiments: { outputModule: true },',
        '      output: { path: outDir, filename: "bundle.mjs", module: true, library: { type: "module" } },',
        '      module: { rules: [{ test: /\\.sts$/, use: [{ loader: "@soundscript/webpack-loader" }] }] },',
        '      resolve: { extensions: [".sts", ".js", ".ts"] },',
        '    }, (error, result) => error ? reject(error) : resolve(result));',
        '  });',
        '  const hasErrors = typeof stats.hasErrors === "function" ? stats.hasErrors() : true;',
        '  const outputPath = join(outDir, "bundle.mjs");',
        '  const bundleText = await readFile(outputPath, "utf8");',
        '  const loaded = await import(pathToFileURL(outputPath).href);',
        '  console.log(JSON.stringify({ hasErrors, bundleText, doubled: loaded.doubled }));',
        '} finally {',
        '  await rm(outDir, { recursive: true, force: true });',
        '}',
      ].join('\n'),
    );
    assert(
      webpackPayload.hasErrors === false,
      '@soundscript/webpack-loader produced webpack compilation errors.',
    );
    assert(
      String(webpackPayload.bundleText).includes('doubled'),
      '@soundscript/webpack-loader did not emit the expected export.',
    );
    assert(
      String(webpackPayload.bundleText).includes('__sts_macro_expr(') === false,
      '@soundscript/webpack-loader left macro placeholders in the bundle.',
    );
    assert(
      webpackPayload.doubled === 42,
      '@soundscript/webpack-loader bundle did not execute correctly.',
    );

    let bunPayload = { skipped: true };
    if (bunIsAvailable()) {
      bunPayload = JSON.parse(
        run(
          'bun',
          [
            '--eval',
            [
              "import { mkdtemp, readFile, rm } from 'node:fs/promises';",
              "import { tmpdir } from 'node:os';",
              "import { join } from 'node:path';",
              "import { createSoundscriptBunPlugin } from '@soundscript/bun-plugin';",
              'const outDir = await mkdtemp(join(tmpdir(), "soundscript-bun-build-"));',
              'try {',
              '  const result = await Bun.build({',
              '    entrypoints: [join(process.cwd(), "src", "main.sts")],',
              '    outdir: outDir,',
              '    format: "esm",',
              '    target: "node",',
              '    plugins: [createSoundscriptBunPlugin({ workingDirectory: process.cwd() })],',
              '  });',
              '  const outputPath = result.outputs[0]?.path;',
              '  const bundleText = outputPath ? await readFile(outputPath, "utf8") : "";',
              '  console.log(JSON.stringify({ success: result.success, outputPath, bundleText }));',
              '} finally {',
              '  await rm(outDir, { recursive: true, force: true });',
              '}',
            ].join('\n'),
          ],
          { cwd: projectRoot },
        ),
      );
      assert(bunPayload.success === true, '@soundscript/bun-plugin did not complete a Bun build.');
      assert(
        String(bunPayload.outputPath ?? '').endsWith('.js'),
        '@soundscript/bun-plugin did not emit a JavaScript artifact.',
      );
      assert(
        String(bunPayload.bundleText).includes('doubled'),
        '@soundscript/bun-plugin did not emit the expected export.',
      );
      assert(
        String(bunPayload.bundleText).includes('__sts_macro_expr(') === false,
        '@soundscript/bun-plugin left macro placeholders in the built output.',
      );
    } else if (process.env.SOUNDSCRIPT_SMOKE_REQUIRE_BUN === '1') {
      throw new Error('Bun is required for this smoke but the `bun` binary is not available.');
    }

    console.log(
      JSON.stringify(
        {
          register: registerPayload,
          vite: vitePayload.fileName,
          webpack: true,
          bun: bunPayload,
        },
        null,
        2,
      ),
    );
  } finally {
    await rm(packDirectory, { recursive: true, force: true });
    await rm(projectRoot, { recursive: true, force: true });
  }
}

await main();

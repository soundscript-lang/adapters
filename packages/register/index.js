import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve as resolvePath } from 'node:path';
import process from 'node:process';

import {
  createOnDemandTransformer,
  inlineSourceMapComment,
} from '@soundscript/soundscript/project-transform';

function filePathFromUrl(url) {
  if (!url.startsWith('file:')) {
    return undefined;
  }

  return fileURLToPath(url);
}

function fileUrlFromPath(path) {
  return pathToFileURL(path).href;
}

function preloadSpecifierMatchesCurrentModule(specifier) {
  if (specifier === '@soundscript/register') {
    return true;
  }

  if (specifier.startsWith('file:')) {
    return specifier === import.meta.url;
  }

  if (
    !specifier.startsWith('/') && !specifier.startsWith('./') &&
    !specifier.startsWith('../')
  ) {
    return false;
  }

  return fileUrlFromPath(resolvePath(process.cwd(), specifier)) === import.meta.url;
}

function shouldAutoRegisterFromExecArgv(execArgv = process.execArgv) {
  for (let index = 0; index < execArgv.length; index += 1) {
    const argument = execArgv[index];
    let specifier;
    if (argument === '--import') {
      specifier = execArgv[index + 1];
      index += 1;
    } else if (argument?.startsWith('--import=')) {
      specifier = argument.slice('--import='.length);
    } else {
      continue;
    }

    if (specifier && preloadSpecifierMatchesCurrentModule(specifier)) {
      return true;
    }
  }

  return false;
}

function syncTransformerFromOptions(options) {
  if (!options.transformer) {
    return createOnDemandTransformer({
      projectPath: options.projectPath,
      workingDirectory: options.workingDirectory,
    });
  }

  if ('transformModuleSync' in options.transformer) {
    return options.transformer;
  }

  throw new Error(
    'registerSoundscriptHooks requires a transformer with transformModuleSync(fileName).',
  );
}

function parseNodeVersion(nodeVersion) {
  const match = /^v?(\d+)\.(\d+)/u.exec(nodeVersion ?? '');
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : undefined;
}

function nodeSupportsTypeScriptLoader() {
  const featureSupport = process.features?.typescript;
  if (featureSupport === 'strip' || featureSupport === 'transform') {
    return true;
  }
  if (featureSupport === false) {
    return false;
  }
  if (
    process.execArgv.includes('--no-strip-types') ||
    process.execArgv.includes('--no-experimental-strip-types')
  ) {
    return false;
  }
  if (
    process.execArgv.includes('--experimental-strip-types') ||
    process.execArgv.includes('--experimental-transform-types')
  ) {
    return true;
  }

  const parsed = parseNodeVersion(process.versions.node);
  if (!parsed) {
    return false;
  }
  return parsed.major >= 24 ||
    (parsed.major === 23 && parsed.minor >= 6) ||
    (parsed.major === 22 && parsed.minor >= 18);
}

function filePathSupportsTypeScriptLoaderFormat(filePath) {
  return /\.(?:[cm]?tsx?)$/iu.test(filePath) && !/\.d\.[cm]?ts$/iu.test(filePath);
}

function loaderFormatForTransform(filePath, transformed) {
  if (transformed.loaderFormat === 'module-typescript') {
    return 'module-typescript';
  }
  if (transformed.loaderFormat === 'module') {
    return 'module';
  }
  return nodeSupportsTypeScriptLoader() && filePathSupportsTypeScriptLoaderFormat(filePath)
    ? 'module-typescript'
    : 'module';
}

function loadResultFromTransform(filePath, transformed) {
  return {
    format: loaderFormatForTransform(filePath, transformed),
    shortCircuit: true,
    source: `${transformed.code}\n${inlineSourceMapComment(transformed.mapText)}\n`,
  };
}

const registeredTransformerHooks = new WeakSet();
const registeredDefaultHookKeys = new Set();

function getDefaultHookKey(options) {
  return `${options.projectPath ?? ''}\u0000${options.workingDirectory ?? ''}`;
}

function registerNodeHooks(registerHooks, options = {}) {
  if (options.transformer) {
    if (registeredTransformerHooks.has(options.transformer)) {
      return;
    }
    registeredTransformerHooks.add(options.transformer);
  } else {
    const key = getDefaultHookKey(options);
    if (registeredDefaultHookKeys.has(key)) {
      return;
    }
    registeredDefaultHookKeys.add(key);
  }

  registerHooks(createNodeRegisterHooks(options));
}

export function createNodeLoaderHooks(options = {}) {
  const transformer = options.transformer ??
    createOnDemandTransformer({
      projectPath: options.projectPath,
      workingDirectory: options.workingDirectory,
    });

  return {
    async resolve(specifier, context, nextResolve) {
      const importer = context.parentURL ? filePathFromUrl(context.parentURL) : undefined;
      if (importer) {
        const resolved = transformer.resolveImportSpecifier(specifier, importer);
        if (resolved) {
          return {
            shortCircuit: true,
            url: fileUrlFromPath(resolved),
          };
        }
      }

      const resolved = await nextResolve(specifier, context);
      return resolved.shortCircuit === undefined
        ? {
          ...resolved,
          shortCircuit: true,
        }
        : resolved;
    },

    async load(url, context, nextLoad) {
      const filePath = filePathFromUrl(url);
      if (!filePath || !transformer.shouldTransformFile(filePath)) {
        const loaded = await nextLoad(url, context);
        return loaded.shortCircuit === undefined
          ? {
            ...loaded,
            shortCircuit: true,
          }
          : loaded;
      }

      const transformed = await transformer.transformModule(filePath);
      return loadResultFromTransform(filePath, transformed);
    },
  };
}

function createNodeRegisterHooks(options = {}) {
  const transformer = syncTransformerFromOptions(options);

  return {
    resolve(specifier, context, nextResolve) {
      const importer = context.parentURL ? filePathFromUrl(context.parentURL) : undefined;
      if (importer) {
        const resolved = transformer.resolveImportSpecifier(specifier, importer);
        if (resolved) {
          return {
            shortCircuit: true,
            url: fileUrlFromPath(resolved),
          };
        }
      }

      const resolved = nextResolve(specifier, context);
      return resolved.shortCircuit === undefined
        ? {
          ...resolved,
          shortCircuit: true,
        }
        : resolved;
    },

    load(url, context, nextLoad) {
      const filePath = filePathFromUrl(url);
      if (!filePath || !transformer.shouldTransformFile(filePath)) {
        const loaded = nextLoad(url, context);
        return loaded.shortCircuit === undefined
          ? {
            ...loaded,
            shortCircuit: true,
          }
          : loaded;
      }

      return loadResultFromTransform(filePath, transformer.transformModuleSync(filePath));
    },
  };
}

export async function registerSoundscriptHooks(options = {}) {
  const { registerHooks } = await import('node:module');
  registerNodeHooks(registerHooks, options);
}

if (shouldAutoRegisterFromExecArgv()) {
  await registerSoundscriptHooks({ workingDirectory: process.cwd() });
}

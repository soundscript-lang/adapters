import { fileURLToPath, pathToFileURL } from 'node:url';

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

function loadResultFromTransform(transformed) {
  return {
    format: 'module',
    shortCircuit: true,
    source: `${transformed.code}\n${inlineSourceMapComment(transformed.mapText)}\n`,
  };
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
      return loadResultFromTransform(transformed);
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

      return loadResultFromTransform(transformer.transformModuleSync(filePath));
    },
  };
}

export async function registerSoundscriptHooks(options = {}) {
  const { registerHooks } = await import('node:module');
  registerHooks(createNodeRegisterHooks(options));
}

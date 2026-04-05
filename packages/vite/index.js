import { isAbsolute, join } from 'node:path';

import { createOnDemandTransformer } from '@soundscript/soundscript/project-transform';

function stripQueryAndHash(id) {
  return id.replace(/[?#].*$/u, '');
}

function isAbsoluteFilePath(filePath) {
  return isAbsolute(filePath) || /^[A-Za-z]:[/\\]/u.test(filePath);
}

export function soundscriptVitePlugin(options = {}) {
  const transformer = options.transformer ??
    createOnDemandTransformer({
      projectPath: options.projectPath,
      workingDirectory: options.workingDirectory,
    });

  return {
    name: 'soundscript',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) {
        const cleanSource = stripQueryAndHash(source);
        const entryCandidate = isAbsoluteFilePath(cleanSource)
          ? cleanSource
          : join(options.workingDirectory ?? '.', cleanSource);
        return Promise.resolve(
          transformer.shouldTransformFile(entryCandidate) ? entryCandidate : null,
        );
      }

      const importerPath = stripQueryAndHash(importer);
      if (!isAbsoluteFilePath(importerPath)) {
        return Promise.resolve(null);
      }

      return Promise.resolve(transformer.resolveImportSpecifier(source, importerPath) ?? null);
    },
    async load(id) {
      const cleanId = stripQueryAndHash(id);
      if (!transformer.shouldTransformFile(cleanId)) {
        return null;
      }

      const transformed = await transformer.transformModule(cleanId);
      return {
        code: transformed.code,
        map: transformed.mapText,
      };
    },
  };
}

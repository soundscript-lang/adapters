import { isAbsolute, join } from 'node:path';

import {
  createOnDemandTransformer,
  inlineSourceMapComment,
} from '@soundscript/soundscript/project-transform';

function isAbsoluteFilePath(filePath) {
  return isAbsolute(filePath) || /^[A-Za-z]:[/\\]/u.test(filePath);
}

export function createSoundscriptBunPlugin(options = {}) {
  const transformer = options.transformer ??
    createOnDemandTransformer({
      projectPath: options.projectPath,
      workingDirectory: options.workingDirectory,
    });

  return {
    name: 'soundscript',
    setup(build) {
      build.onResolve({ filter: /.*/u }, (args) => {
        if (args.importer.length === 0) {
          const entryCandidate = isAbsoluteFilePath(args.path)
            ? args.path
            : join(options.workingDirectory ?? '.', args.path);
          if (transformer.shouldTransformFile(entryCandidate)) {
            return Promise.resolve({
              namespace: 'soundscript',
              path: entryCandidate,
            });
          }
        }

        const importer = args.importer.length > 0
          ? args.importer
          : `${options.workingDirectory ?? '.'}/index.sts`;
        const resolved = transformer.resolveImportSpecifier(args.path, importer);
        if (!resolved) {
          return Promise.resolve(undefined);
        }

        return Promise.resolve({
          namespace: 'soundscript',
          path: resolved,
        });
      });

      build.onLoad(
        { filter: /\.[cm]?[jt]sx?$|\.sts$/u, namespace: 'soundscript' },
        async (args) => {
          if (!transformer.shouldTransformFile(args.path)) {
            return undefined;
          }

          const transformed = await transformer.transformModule(args.path);
          return {
            contents: `${transformed.code}\n${inlineSourceMapComment(transformed.mapText)}\n`,
            loader: 'js',
          };
        },
      );
    },
  };
}

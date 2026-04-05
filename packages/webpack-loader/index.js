import { createOnDemandTransformer } from '@soundscript/soundscript/project-transform';

export async function transformWithWebpackLoaderContext(
  context,
  sourceText,
  transformer,
) {
  const callback = context.async();
  if (!callback) {
    throw new Error('@soundscript/webpack-loader requires an async webpack loader context.');
  }

  const options = context.getOptions?.() ?? {};
  const runtimeTransformer = transformer ??
    createOnDemandTransformer({
      projectPath: options.projectPath,
      workingDirectory: options.workingDirectory ?? context.rootContext,
    });

  if (!runtimeTransformer.shouldTransformFile(context.resourcePath)) {
    callback(null, sourceText, undefined);
    return;
  }

  try {
    const transformed = await runtimeTransformer.transformModule(context.resourcePath);
    callback(null, transformed.code, transformed.mapText);
  } catch (error) {
    callback(error instanceof Error ? error : new Error(String(error)));
  }
}

export default async function soundscriptWebpackLoader(sourceText) {
  await transformWithWebpackLoaderContext(this, sourceText);
}

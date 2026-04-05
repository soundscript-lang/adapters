import type {
  OnDemandTransformer,
} from '@soundscript/soundscript/project-transform';

interface WebpackLoaderOptions {
  projectPath?: string;
  workingDirectory?: string;
}

interface WebpackLoaderContext {
  async(): ((error: Error | null, content?: string, map?: string) => void) | undefined;
  getOptions?(): WebpackLoaderOptions;
  resourcePath: string;
  rootContext?: string;
}

export declare function transformWithWebpackLoaderContext(
  context: WebpackLoaderContext,
  sourceText?: string,
  transformer?: OnDemandTransformer,
): Promise<void>;

declare function soundscriptWebpackLoader(
  this: WebpackLoaderContext,
  sourceText: string,
): Promise<void>;

export default soundscriptWebpackLoader;

import type {
  OnDemandTransformer,
} from '@soundscript/soundscript/project-transform';

interface ViteLoadResult {
  code: string;
  map: string;
}

export interface VitePluginLike {
  enforce?: 'pre' | 'post';
  load?(id: string): Promise<ViteLoadResult | null>;
  name: string;
  resolveId?(source: string, importer?: string): Promise<string | null>;
}

export interface SoundscriptVitePluginOptions {
  projectPath?: string;
  transformer?: OnDemandTransformer;
  workingDirectory?: string;
}

export declare function soundscriptVitePlugin(
  options?: SoundscriptVitePluginOptions,
): VitePluginLike;

import type {
  OnDemandTransformer,
} from '@soundscript/soundscript/project-transform';

interface BunOnResolveArgs {
  importer: string;
  path: string;
}

interface BunOnLoadArgs {
  path: string;
}

interface BunPluginBuild {
  onLoad(
    options: { filter: RegExp; namespace?: string },
    callback: (args: BunOnLoadArgs) => Promise<{ contents: string; loader: 'js' } | undefined>,
  ): void;
  onResolve(
    options: { filter: RegExp },
    callback: (args: BunOnResolveArgs) => Promise<{ namespace: string; path: string } | undefined>,
  ): void;
}

export interface BunPluginDefinition {
  name: string;
  setup(build: BunPluginBuild): void;
}

export interface SoundscriptBunPluginOptions {
  projectPath?: string;
  transformer?: OnDemandTransformer;
  workingDirectory?: string;
}

export declare function createSoundscriptBunPlugin(
  options?: SoundscriptBunPluginOptions,
): BunPluginDefinition;

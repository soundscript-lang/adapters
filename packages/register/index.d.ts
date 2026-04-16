import type {
  OnDemandTransformer,
} from '@soundscript/soundscript/project-transform';

interface NodeResolveContext {
  parentURL?: string;
}

interface NodeResolveResult {
  shortCircuit?: boolean;
  url: string;
}

type NodeLoadContext = Record<string, never>;

interface NodeLoadResult {
  format: 'module' | 'module-typescript';
  shortCircuit?: boolean;
  source: string;
}

type NodeResolveNext = (
  specifier: string,
  context: NodeResolveContext,
) => Promise<NodeResolveResult>;

type NodeLoadNext = (
  url: string,
  context: NodeLoadContext,
) => Promise<NodeLoadResult>;

export interface NodeLoaderHooks {
  load(
    url: string,
    context: NodeLoadContext,
    nextLoad: NodeLoadNext,
  ): Promise<NodeLoadResult>;
  resolve(
    specifier: string,
    context: NodeResolveContext,
    nextResolve: NodeResolveNext,
  ): Promise<NodeResolveResult>;
}

export interface NodeLoaderOptions {
  projectPath?: string;
  transformer?: OnDemandTransformer;
  workingDirectory?: string;
}

export declare function createNodeLoaderHooks(options?: NodeLoaderOptions): NodeLoaderHooks;
export declare function registerSoundscriptHooks(options?: NodeLoaderOptions): Promise<void>;

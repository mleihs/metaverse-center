import { msg } from '@lit/localize';
import type {
  GenerationStep,
  VelgGenerationProgress,
} from '../components/shared/GenerationProgress.js';

export interface ProgressConfig {
  title: string;
  steps: GenerationStep[];
  closeable?: boolean;
}

export interface ProgressHandle {
  setStep(stepId: string, text?: string, subText?: string): void;
  setError(message: string): void;
  complete(message?: string): void;
}

/** Pre-configured step sets for generation types. */
const GENERATION_CONFIGS = {
  agent: () => ({
    title: msg('AI generating description'),
    steps: [
      { id: 'prepare', label: msg('Preparing') },
      { id: 'generate_text', label: msg('AI generating description') },
      { id: 'process', label: msg('Processing') },
      { id: 'complete', label: msg('Complete') },
    ] as GenerationStep[],
  }),
  building: () => ({
    title: msg('AI generating description'),
    steps: [
      { id: 'prepare', label: msg('Preparing') },
      { id: 'generate_text', label: msg('AI generating description') },
      { id: 'process', label: msg('Processing') },
      { id: 'complete', label: msg('Complete') },
    ] as GenerationStep[],
  }),
  portrait: () => ({
    title: msg('Generating portrait description'),
    steps: [
      { id: 'prepare', label: msg('Preparing') },
      { id: 'generate_portrait_desc', label: msg('Generating portrait description') },
      { id: 'process', label: msg('Processing') },
      { id: 'complete', label: msg('Complete') },
    ] as GenerationStep[],
  }),
  image: () => ({
    title: msg('AI generating image'),
    steps: [
      { id: 'prepare', label: msg('Preparing') },
      { id: 'generate_image', label: msg('AI generating image') },
      { id: 'process_image', label: msg('Processing image') },
      { id: 'complete', label: msg('Complete') },
    ] as GenerationStep[],
  }),
  transform: () => ({
    title: msg('Transforming article'),
    steps: [
      { id: 'prepare', label: msg('Preparing') },
      { id: 'transform', label: msg('AI transforming article') },
      { id: 'process', label: msg('Processing') },
      { id: 'complete', label: msg('Complete') },
    ] as GenerationStep[],
  }),
  reactions: () => ({
    title: msg('Generating reactions'),
    steps: [
      { id: 'prepare', label: msg('Loading agents') },
      { id: 'generate', label: msg('Generating agent reactions') },
      { id: 'process', label: msg('Processing reactions') },
      { id: 'complete', label: msg('Complete') },
    ] as GenerationStep[],
  }),
} as const;

type GenerationType = keyof typeof GENERATION_CONFIGS;

class GenerationProgressService {
  private _element: VelgGenerationProgress | null = null;

  private async _ensureElement(): Promise<VelgGenerationProgress> {
    if (!this._element || !this._element.isConnected) {
      // Await the import to ensure the custom element is registered
      await import('../components/shared/GenerationProgress.js');
      this._element = document.createElement('velg-generation-progress');
      document.body.appendChild(this._element);
    }
    return this._element;
  }

  /**
   * Run an async callback with automatic progress tracking.
   * The modal opens before the callback and closes after (or shows error).
   */
  async withProgress<T>(
    config: ProgressConfig,
    callback: (progress: ProgressHandle) => Promise<T>,
  ): Promise<T> {
    const el = await this._ensureElement();

    el.show(config.title, config.steps);
    if (config.closeable) el.closeable = true;

    const handle: ProgressHandle = {
      setStep: (id, text, sub) => el.setStep(id, text, sub),
      setError: (message) => el.setError(message),
      complete: (message) => el.complete(message),
    };

    try {
      const result = await callback(handle);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : msg('An unexpected error occurred.');
      el.setError(message);
      throw err;
    }
  }

  /**
   * Pre-configured generation with standard steps.
   * Usage: `await generationProgress.run('agent', async (p) => { ... })`
   */
  async run<T>(
    type: GenerationType,
    callback: (progress: ProgressHandle) => Promise<T>,
  ): Promise<T> {
    const config = GENERATION_CONFIGS[type]();
    return this.withProgress(config, callback);
  }

  /** Hide the progress modal immediately. */
  hide(): void {
    this._element?.hide();
  }
}

export const generationProgress = new GenerationProgressService();

import type { ApiResponse, PromptTemplate } from '../../types/index.js';
import { CrudApiService } from './CrudApiService.js';

export class PromptTemplatesApiService extends CrudApiService<PromptTemplate> {
  protected readonly resource = 'prompt-templates';

  test(
    simulationId: string,
    data: { template_type: string; locale?: string; variables?: Record<string, string> },
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.post(`${this.basePath(simulationId)}/test`, data);
  }
}

export const promptTemplatesApi = new PromptTemplatesApiService();

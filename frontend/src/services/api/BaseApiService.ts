import type { ApiResponse } from '../../types/index.js';
import { appState } from '../AppStateManager.js';

export class BaseApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/v1';
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = appState.accessToken.value;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
    extraHeaders?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    try {
      const url = this.buildUrl(path, params);
      const headers = this.getHeaders();
      if (extraHeaders) {
        Object.assign(headers, extraHeaders);
      }
      const options: RequestInit = {
        method,
        headers,
      };

      if (body !== undefined && method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        let errorCode = `HTTP_${response.status}`;
        let errorMessage = response.statusText;
        try {
          const json = await response.json();
          errorCode = json.code || errorCode;
          errorMessage = json.message || json.detail || errorMessage;
        } catch {
          // Response body is not JSON — use statusText
        }
        return {
          success: false,
          error: { code: errorCode, message: errorMessage },
        };
      }

      const json = await response.json();
      return {
        success: true,
        data: json.data !== undefined ? json.data : json,
        meta: json.meta,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message,
        },
      };
    }
  }

  protected get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, params);
  }

  protected post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  protected put<T>(path: string, body?: unknown, updatedAt?: string): Promise<ApiResponse<T>> {
    const extraHeaders = updatedAt ? { 'If-Updated-At': updatedAt } : undefined;
    return this.request<T>('PUT', path, body, undefined, extraHeaders);
  }

  protected patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body);
  }

  protected delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path);
  }
}

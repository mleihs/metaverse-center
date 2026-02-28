import type { ApiResponse } from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { supabase } from '../supabase/client.js';

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

  /** Shared response handler — parses JSON, extracts errors, handles 401 sign-out. */
  private async handleResponse<T>(
    response: Response,
    signOutOn401 = true,
  ): Promise<ApiResponse<T>> {
    if (!response.ok) {
      let errorCode = `HTTP_${response.status}`;
      let errorMessage = response.statusText;
      try {
        const json = await response.json();
        errorCode = json.code || errorCode;
        if (Array.isArray(json.detail)) {
          errorMessage =
            json.detail
              .map((d: { msg?: string }) => d.msg ?? '')
              .filter(Boolean)
              .join('; ') || errorMessage;
        } else {
          errorMessage = json.message || json.detail || errorMessage;
        }
      } catch {
        // Response body is not JSON — use statusText
      }

      if (signOutOn401 && response.status === 401) {
        await supabase.auth.signOut();
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
      return this.handleResponse<T>(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message },
      };
    }
  }

  protected get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, params);
  }

  /**
   * Public GET — routes to /api/v1/public prefix, no Authorization header.
   * Used for anonymous read access to active simulation data.
   */
  protected async getPublic<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    try {
      const url = this.buildUrl(`/public${path}`, params);
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return this.handleResponse<T>(response, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      return { success: false, error: { code: 'NETWORK_ERROR', message } };
    }
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

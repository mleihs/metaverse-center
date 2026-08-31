import type { ApiResponse } from '../../types/index.js';
import { appState } from '../AppStateManager.js';
import { captureError } from '../SentryService.js';
import { supabase } from '../supabase/client.js';
import type { QueryParams } from './query-params';

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

  private buildUrl(path: string, params?: QueryParams): string {
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
      } catch (err) {
        captureError(err, {
          source: 'BaseApiService.handleResponse.parseError',
          status: String(response.status),
        });
      }

      if (signOutOn401 && response.status === 401) {
        // Destroying the session is the loudest thing this layer does and it
        // used to happen in complete silence. When the backend rejected every
        // token — a local stack whose signing had moved on, an expired signing
        // key, a misconfigured issuer — the client signed itself out on the
        // very first call after login, so signing in looked like a no-op with
        // nothing anywhere to explain it. An involuntary sign-out is a fact
        // worth recording.
        captureError(new Error(`Signed out by a 401 from ${response.url}: ${errorMessage}`), {
          source: 'BaseApiService.handleResponse.signOutOn401',
          code: errorCode,
        });
        await supabase.auth.signOut();
      }

      return {
        success: false,
        error: { code: errorCode, message: errorMessage, status: response.status },
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
    params?: QueryParams,
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
      captureError(err, { source: 'BaseApiService.request', method, path });
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message },
      };
    }
  }

  protected get<T>(path: string, params?: QueryParams): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, params);
  }

  /**
   * GET for simulation-scoped reads. `mode` is chosen by the caller —
   * typically from `appState.currentSimulationMode.value` for sim-scoped
   * reads, or `isAuthenticated ? 'member' : 'public'` for auth-only reads.
   *
   * The API layer does not read `appState.isAuthenticated` or
   * `appState.currentRole` — routing is a pure function of the arguments,
   * and a CI lint gate (`scripts/lint-no-appstate-access-reads.sh`) rejects
   * reintroducing those reads under `src/services/api/`.
   */
  protected getSimulationData<T>(
    path: string,
    mode: 'public' | 'member',
    params?: QueryParams,
  ): Promise<ApiResponse<T>> {
    return mode === 'member' ? this.get<T>(path, params) : this.getPublic<T>(path, params);
  }

  /**
   * Public GET — routes to /api/v1/public prefix, no Authorization header.
   * Used for anonymous read access to active simulation data.
   */
  protected async getPublic<T>(path: string, params?: QueryParams): Promise<ApiResponse<T>> {
    try {
      const url = this.buildUrl(`/public${path}`, params);
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return this.handleResponse<T>(response, false);
    } catch (err) {
      captureError(err, { source: 'BaseApiService.getPublic', path });
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

  protected delete<T>(path: string, params?: QueryParams): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, params);
  }

  /**
   * POST with multipart/form-data body.
   * Does NOT set Content-Type header — browser auto-sets boundary.
   */
  protected async postFormData<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    try {
      const url = this.buildUrl(path);
      const headers: Record<string, string> = {};
      const token = appState.accessToken.value;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      return this.handleResponse<T>(response);
    } catch (err) {
      captureError(err, { source: 'BaseApiService.postFormData', path });
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message },
      };
    }
  }
}

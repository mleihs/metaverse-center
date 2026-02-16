/**
 * Global error-handler utilities.
 *
 * - handleApiError: maps ApiError codes to user-facing actions
 * - showToast: dispatches a custom event consumed by the Toast component
 */

import type { ApiError } from '../types/index.js';

// ---------------------------------------------------------------------------
// Toast helper
// ---------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastDetail {
  message: string;
  type: ToastType;
}

/**
 * Dispatch a `velg-toast` CustomEvent on `window`.
 * The shared Toast component (`<velg-toast>`) listens for this event
 * and renders the notification.
 */
export function showToast(message: string, type: ToastType = 'info'): void {
  window.dispatchEvent(
    new CustomEvent<ToastDetail>('velg-toast', {
      detail: { message, type },
    }),
  );
}

// ---------------------------------------------------------------------------
// API error handler
// ---------------------------------------------------------------------------

/**
 * Translate a structured ApiError into a user-visible action.
 *
 * Error code mapping:
 *   HTTP_401       -> redirect to login
 *   HTTP_403       -> "Access denied" toast
 *   NETWORK_ERROR  -> "Connection lost" toast
 *   default        -> show the error message as-is
 */
export function handleApiError(error: ApiError): void {
  switch (error.code) {
    case 'HTTP_401':
      showToast('Session expired. Redirecting to login.', 'warning');
      window.location.hash = '#/login';
      break;

    case 'HTTP_403':
      showToast('Access denied. You do not have permission for this action.', 'error');
      break;

    case 'NETWORK_ERROR':
      showToast('Connection lost. Please check your network and try again.', 'error');
      break;

    default:
      showToast(error.message || 'An unexpected error occurred.', 'error');
      break;
  }
}

import useStore from '../store/useStore';

/**
 * API Configuration
 * Centralized API URL management for all components
 */

// Get API base URL from Vite config
// In production, use localhost since server is embedded in the Electron app
export const API_BASE_URL = import.meta.env.VITE_API_URL ||
  'http://localhost:3001';

/**
 * API Endpoints
 * All API endpoints in one place for easy maintenance
 */
export const API_ENDPOINTS = {
  // Auth
  login: '/api/auth/login',
  logout: '/api/auth/logout',

  // Users
  users: '/api/users',
  userById: (id) => `/api/users/${id}`,

  // Files
  files: '/api/files',
  fileById: (id) => `/api/files/${id}`,
  fileByIdPath: (id) => `/api/files/${id}/path`,
  fileByIdDownload: (id) => `/api/files/${id}/download`,
  fileUpload: '/api/files/upload',
  userFiles: (userId) => `/api/files/user/${userId}`,

  // Assignments
  assignments: '/api/assignments',
  assignmentById: (id) => `/api/assignments/${id}`,
  assignmentsByUser: (userId) => `/api/assignments/user/${userId}`,
  assignmentsByTeam: (teamName) => `/api/assignments/team/${teamName}/all-tasks`,
  assignmentSubmit: '/api/assignments/submit',
  assignmentFiles: (assignmentId, fileId) => `/api/assignments/${assignmentId}/files/${fileId}`,

  // Comments
  assignmentComments: (assignmentId) => `/api/assignments/${assignmentId}/comments`,
  assignmentCommentReply: (assignmentId, commentId) => `/api/assignments/${assignmentId}/comments/${commentId}/reply`,

  // Notifications
  userNotifications: (userId) => `/api/notifications/user/${userId}`,
  notificationById: (id) => `/api/notifications/${id}`,
  notificationRead: (id) => `/api/notifications/${id}/read`,
  notificationReadAll: (userId) => `/api/notifications/user/${userId}/read-all`,
  notificationDeleteAll: (userId) => `/api/notifications/user/${userId}/delete-all`,

  // Health check
  health: '/api/health'
};

/**
 * Build full URL from endpoint
 */
export const buildUrl = (endpoint, params = {}) => {
  // If it's already a full URL, just return it (optionally with params)
  let url = (endpoint.startsWith('http://') || endpoint.startsWith('https://'))
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  // Add query parameters if provided
  if (Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(params).toString();
    url += (url.includes('?') ? '&' : '?') + queryString;
  }

  return url;
};

/**
 * DB-ready retry config.
 * When the server responds 503 with dbReady:false, the DB is still
 * initialising (MySQL background connect). We retry automatically so
 * callers never have to handle this transient state themselves.
 *
 * Schedule: 2s → 4s → 6s → 8s → 10s (5 attempts, ~30 s total window)
 */
const DB_RETRY_DELAYS_MS = [2000, 4000, 6000, 8000, 10000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns true when a response is a server-issued "DB not ready yet" 503.
 * We check dbReady:false to avoid retrying unrelated 503s (e.g. a real
 * outage or a misconfigured proxy).
 */
const isDbNotReady = async (response) => {
  if (response.status !== 503) return false;
  try {
    // Clone so the body can still be consumed by the caller path
    const clone = response.clone();
    const body = await clone.json();
    return body.dbReady === false;
  } catch {
    return false;
  }
};

/**
 * Perform a single raw fetch attempt (builds headers, attaches token).
 * Returns the Response object — does NOT throw on non-2xx.
 */
const doFetch = async (fullUrl, options) => {
  const { token } = useStore.getState();

  // When body is FormData, do NOT set Content-Type — the browser must set it
  // automatically so it includes the correct multipart boundary.
  // Passing `headers: {}` from the caller is not enough because the default
  // 'Content-Type: application/json' was always merged in first.
  const isFormData = options.body instanceof FormData;

  const headers = isFormData
    ? { ...options.headers }          // no Content-Type default for multipart
    : { 'Content-Type': 'application/json', ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (import.meta.env.DEV) {
    console.log(`🚀 API Request: ${options.method || 'GET'} ${fullUrl}`);
  }

  return fetch(fullUrl, { ...options, headers });
};

/**
 * Fetch wrapper with error handling, automatic authentication, and
 * transparent DB-ready retry.
 *
 * AbortError (intentional cancellation) is rethrown silently — callers
 * that use AbortController are expected to handle it themselves.
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url = typeof endpoint === 'function' ? endpoint() : endpoint;
  const fullUrl = buildUrl(url);

  try {
    let response = await doFetch(fullUrl, options);

    // ── Transparent DB-ready retry ────────────────────────────────────────
    // The server starts Express before MySQL finishes connecting. During
    // that window every guarded route returns 503 { dbReady: false }.
    // Retry automatically so the UI never shows a spurious error.
    for (const delay of DB_RETRY_DELAYS_MS) {
      if (!(await isDbNotReady(response))) break;

      if (import.meta.env.DEV) {
        console.log(`⏳ DB not ready — retrying ${fullUrl} in ${delay / 1000}s…`);
      }

      await sleep(delay);

      // Check if the caller's AbortSignal fired while we were waiting
      if (options.signal?.aborted) {
        const err = new DOMException('Aborted', 'AbortError');
        throw err;
      }

      response = await doFetch(fullUrl, options);
    }
    // ─────────────────────────────────────────────────────────────────────

    if (import.meta.env.DEV) {
      console.log(`📡 API Response: ${response.status} ${fullUrl}`);
    }

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('🔒 Authentication expired or invalid. User may need to log in again.');
      } else if (response.status === 403) {
        console.error('🚫 Access denied: Insufficient permissions.');
      }

      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (_e) {
        // Not a JSON response or body already read
      }

      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    return await response.text();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    console.error(`❌ API Fetch Error (${fullUrl}):`, error.message);
    throw error;
  }
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  buildUrl,
  apiFetch
};

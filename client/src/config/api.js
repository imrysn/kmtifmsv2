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
        console.warn('🔒 Authentication expired or invalid. Logging out user.');
        // Clear session state — App.jsx will automatically redirect to /login
        useStore.getState().logout();
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

/**
 * Upload FormData with real progress events via XMLHttpRequest.
 * Returns a Promise that resolves with the parsed JSON response.
 *
 * @param {string} url - Endpoint path or full URL
 * @param {FormData} formData - The multipart form data to send
 * @param {object} options
 * @param {string} [options.method='POST'] - HTTP method
 * @param {AbortSignal} [options.signal] - AbortController signal
 * @param {function} [options.onProgress] - Called with (percentComplete 0-100, loaded, total)
 */
export const uploadWithProgress = (url, formData, { method = 'POST', signal, onProgress } = {}) => {
  return new Promise((resolve, reject) => {
    const { token } = useStore.getState();
    const xhr = new XMLHttpRequest();

    xhr.open(method, buildUrl(url));

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    // Wire up the AbortSignal
    if (signal) {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }

    // Progress tracking (upload phase — bytes sent to server)
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100), e.loaded, e.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 401) {
        useStore.getState().logout();
        reject(new Error('Authentication expired'));
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.message || `HTTP error! status: ${xhr.status}`));
        }
      } catch {
        reject(new Error(`HTTP error! status: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));

    xhr.send(formData);
  });
};

/**
 * Upload a large set of files in parallel batches with accurate aggregate progress.
 *
 * Strategy:
 *   1. Split `files` into chunks of `batchSize` (default 10).
 *   2. Upload `concurrentBatches` (default 3) chunks simultaneously.
 *   3. Each XHR reports per-byte progress; totals are merged for a single
 *      combined percentage sent to `onProgress`.
 *
 * The first batch also carries all the task metadata (title, members, etc.).
 * Subsequent batches carry only `assignmentId` + `uploadNonce` + files.
 *
 * Returns the response from the first (metadata) batch.
 *
 * @param {string}   metaUrl        - Full URL for the first (create/update) request
 * @param {string}   chunksUrl      - URL for subsequent chunk-only requests
 * @param {FormData} metaFormData   - FormData with task fields + first-batch files already appended
 * @param {File[]}   remainingFiles - Files NOT yet in metaFormData (chunks 2…N)
 * @param {string[]} remainingPaths - webkitRelativePath for each remaining file
 * @param {string}   method         - HTTP method for metaUrl ('POST' | 'PUT')
 * @param {AbortSignal} [signal]    - AbortController signal
 * @param {function} [onProgress]   - (pct 0-100) callback
 * @param {number}   [batchSize=10] - Files per chunk request
 * @param {number}   [concurrentBatches=3] - Parallel chunk uploads
 */
export const uploadBatchWithProgress = async (
  metaUrl,
  chunksUrl,
  metaFormData,
  remainingFiles,
  remainingPaths,
  method = 'POST',
  signal,
  onProgress,
  batchSize = 50,
  concurrentBatches = 4
) => {
  const { token } = useStore.getState();

  // ── track per-request loaded bytes for accurate aggregate progress ──
  const totalBytes = remainingFiles.reduce((s, f) => s + f.size, 0) +
    [...(metaFormData.entries ? metaFormData.entries() : [])]
      .filter(([, v]) => v instanceof File)
      .reduce((s, [, f]) => s + f.size, 0);

  const loadedMap = {}; // requestId → loaded bytes
  let completedBytes = 0;

  const reportProgress = () => {
    if (!onProgress || totalBytes === 0) return;
    const loaded = completedBytes + Object.values(loadedMap).reduce((a, b) => a + b, 0);
    onProgress(Math.min(99, Math.round((loaded / totalBytes) * 100)));
  };

  const xhrUpload = (url, formData, reqMethod, reqId) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(reqMethod, buildUrl(url));
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (signal) {
      if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
      signal.addEventListener('abort', () => { xhr.abort(); reject(new DOMException('Aborted', 'AbortError')); });
    }

    if (xhr.upload && onProgress) {
      loadedMap[reqId] = 0;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) { loadedMap[reqId] = e.loaded; reportProgress(); }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 401) { useStore.getState().logout(); reject(new Error('Authentication expired')); return; }
      // Move this request's bytes to completedBytes
      completedBytes += (loadedMap[reqId] || 0);
      delete loadedMap[reqId];
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.message || `HTTP ${xhr.status}`));
      } catch { reject(new Error(`HTTP ${xhr.status}`)); }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    xhr.send(formData);
  });

  // ── 1. Send the first (metadata) request ────────────────────────────────
  const metaResult = await xhrUpload(metaUrl, metaFormData, method, 'meta');
  if (!metaResult.success) throw new Error(metaResult.message || 'Failed to create/update assignment');

  const assignmentId = metaResult.assignmentId;

  // ── 2. Split remaining files into batches and upload in parallel ─────────
  if (remainingFiles.length > 0 && chunksUrl) {
    const batches = [];
    for (let i = 0; i < remainingFiles.length; i += batchSize) {
      batches.push({
        files: remainingFiles.slice(i, i + batchSize),
        paths: remainingPaths.slice(i, i + batchSize),
        id: `chunk_${i}`
      });
    }

    // Process concurrentBatches at a time
    for (let i = 0; i < batches.length; i += concurrentBatches) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const group = batches.slice(i, i + concurrentBatches);
      
      // Request nonces in parallel for the whole group
      const nonces = await Promise.all(group.map(() => 
        apiFetch('/api/assignments/upload-nonce', { method: 'POST', signal })
      ));

      await Promise.all(group.map(async (batch, idx) => {
        const nonceData = nonces[idx];
        if (!nonceData.success) throw new Error('Failed to get upload nonce for chunk');

        const fd = new FormData();
        // If we have an assignmentId, pass it; otherwise don't (generic bulk upload)
        if (assignmentId) fd.append('assignmentId', assignmentId);
        fd.append('uploadNonce', nonceData.nonce);
        fd.append('hasAttachments', 'true');
        fd.append('relativePaths', JSON.stringify(batch.paths));
        // Use 'attachments' — matches server multer upload.array('attachments', 100000) on /add-attachments
        batch.files.forEach(f => fd.append('attachments', f));

        await xhrUpload(chunksUrl, fd, 'POST', batch.id);
      }));
    }
  }

  if (onProgress) onProgress(100);
  return metaResult;
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  buildUrl,
  apiFetch,
  uploadWithProgress,
  uploadBatchWithProgress
};

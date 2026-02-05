/**
 * API Configuration
 * Centralized API URL management for all components
 */

// Get API base URL from Vite config
// In production, fallback to NAS server if env var is missing
export const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'http://192.168.200.105:3001' : 'http://localhost:3001');

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
  let url = `${API_BASE_URL}${endpoint}`;

  // Add query parameters if provided
  if (Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(params).toString();
    url += `?${queryString}`;
  }

  return url;
};

/**
 * Fetch wrapper with error handling
 */
export const apiFetch = async (endpoint, options = {}) => {
  try {
    const url = typeof endpoint === 'function' ? endpoint() : endpoint;
    const response = await fetch(buildUrl(url), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Fetch Error:', error);
    throw error;
  }
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  buildUrl,
  apiFetch
};

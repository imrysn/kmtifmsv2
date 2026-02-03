import { API_BASE_URL } from '@/config/api';

const API_BASE = `${API_BASE_URL}/api`;

/**
 * Admin Service
 * Handles all API calls for the admin section
 */
export const adminService = {
  /**
     * Fetch dashboard summary
     */
  async getDashboardSummary(signal) {
    const res = await fetch(`${API_BASE}/dashboard/summary`, { signal });
    return res.json();
  },

  /**
     * Assignments
     */
  async getAssignments({ cursor, limit = 20 } = {}) {
    let url = `${API_BASE}/assignments/admin/all?limit=${limit}`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }
    const res = await fetch(url);
    return res.json();
  },

  async deleteAssignment(assignmentId) {
    const res = await fetch(`${API_BASE}/assignments/${assignmentId}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  /**
     * Comments
     */
  async getComments(assignmentId) {
    const res = await fetch(`${API_BASE}/assignments/${assignmentId}/comments`);
    return res.json();
  },

  async postComment(assignmentId, { userId, username, comment }) {
    const res = await fetch(`${API_BASE}/assignments/${assignmentId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, username, comment })
    });
    return res.json();
  },

  async postReply(assignmentId, commentId, { userId, username, reply }) {
    const res = await fetch(`${API_BASE}/assignments/${assignmentId}/comments/${commentId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, username, reply })
    });
    return res.json();
  },

  /**
     * File Management
     */
  async getAllFiles(signal) {
    const res = await fetch(`${API_BASE}/files/all`, { signal });
    return res.json();
  },

  async getFilePath(fileId) {
    const res = await fetch(`${API_BASE}/files/${fileId}/path`);
    return res.json();
  },

  async deleteFilePhysical(fileId, { adminId, adminUsername, adminRole }) {
    const res = await fetch(`${API_BASE}/files/${fileId}/delete-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, adminUsername, adminRole })
    });
    return res.json();
  },

  async deleteFileRecord(fileId, { adminId, adminUsername, adminRole, team }) {
    const res = await fetch(`${API_BASE}/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, adminUsername, adminRole, team: team || null })
    });
    return res.json();
  },

  async reviewFile(fileId, { action, comments, adminId, adminUsername, adminRole, team }) {
    const res = await fetch(`${API_BASE}/files/${fileId}/admin-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        comments: comments || '',
        adminId,
        adminUsername,
        adminRole,
        team: team || null
      })
    });
    return res.json();
  },

  async moveFileToProjects(fileId, { destinationPath, adminId, adminUsername, adminRole, team, deleteFromUploads = true }) {
    const res = await fetch(`${API_BASE}/files/${fileId}/move-to-projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinationPath,
        adminId,
        adminUsername,
        adminRole,
        team: team || null,
        deleteFromUploads
      })
    });
    return res.json();
  }
};

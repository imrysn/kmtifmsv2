import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { API_BASE_URL } from '@/config/api';

const API_BASE = `${API_BASE_URL}/api`;

/**
 * Fetch user files with pagination
 */
export const useUserFiles = (userId, page = 1, limit = 50) => {
    return useQuery({
        queryKey: ['files', 'user', userId, page],
        queryFn: async () => {
            const params = new URLSearchParams({ page, limit });
            const response = await fetch(`${API_BASE}/files/user/${userId}?${params}`);
            if (!response.ok) throw new Error('Failed to fetch user files');
            return response.json();
        },
        enabled: !!userId,
        staleTime: 60 * 1000 // 1 minute
    });
};

/**
 * Fetch pending files
 */
export const usePendingFiles = (userId, page = 1, limit = 50) => {
    return useQuery({
        queryKey: ['files', 'pending', userId, page],
        queryFn: async () => {
            const params = new URLSearchParams({ page, limit });
            const response = await fetch(`${API_BASE}/files/user/${userId}/pending?${params}`);
            if (!response.ok) throw new Error('Failed to fetch pending files');
            return response.json();
        },
        enabled: !!userId,
        staleTime: 30 * 1000 // 30 seconds
    });
};

/**
 * Upload file mutation
 */
export const useUploadFile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (fileData) => {
            const formData = new FormData();
            formData.append('file', fileData.file);
            formData.append('description', fileData.description || '');
            formData.append('userId', fileData.userId);
            formData.append('username', fileData.username);
            formData.append('userTeam', fileData.userTeam);
            if (fileData.tag) formData.append('tag', fileData.tag);

            const response = await fetch(`${API_BASE}/files/upload`, {
                method: 'POST',
                body: formData // fetch automatically sets the correct multipart/form-data boundary
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || 'Failed to upload file');
            }
            return response.json();
        },
        onSuccess: (data, variables) => {
            // Invalidate and refetch user files
            queryClient.invalidateQueries({ queryKey: ['files', 'user', variables.userId] });
            queryClient.invalidateQueries({ queryKey: ['files', 'pending', variables.userId] });
        }
    });
};

/**
 * Delete file mutation
 */
export const useDeleteFile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ fileId, userId, username }) => {
            const response = await fetch(`${API_BASE}/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, username })
            });
            if (!response.ok) throw new Error('Failed to delete file');
            return response.json();
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['files', 'user', variables.userId] });
            queryClient.invalidateQueries({ queryKey: ['files', 'pending', variables.userId] });
        }
    });
};

/**
 * Approve file mutation
 */
export const useApproveFile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ fileId, ...approvalData }) => {
            const response = await fetch(`${API_BASE}/files/${fileId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(approvalData)
            });
            if (!response.ok) throw new Error('Failed to approve file');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['files'] });
        }
    });
};

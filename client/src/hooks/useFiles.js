import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

const API_BASE = `${API_BASE_URL}/api`;

/**
 * Fetch user files with pagination
 */
export const useUserFiles = (userId, page = 1, limit = 50) => {
    return useQuery({
        queryKey: ['files', 'user', userId, page],
        queryFn: async () => {
            const { data } = await axios.get(`${API_BASE}/files/user/${userId}`, {
                params: { page, limit }
            });
            return data;
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
            const { data } = await axios.get(`${API_BASE}/files/user/${userId}/pending`, {
                params: { page, limit }
            });
            return data;
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

            const { data } = await axios.post(`${API_BASE}/files/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return data;
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
            const { data } = await axios.delete(`${API_BASE}/files/${fileId}`, {
                data: { userId, username }
            });
            return data;
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
            const { data } = await axios.post(`${API_BASE}/files/${fileId}/approve`, approvalData);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['files'] });
        }
    });
};

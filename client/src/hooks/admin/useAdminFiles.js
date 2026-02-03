import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { adminService } from '../../services/adminService';

/**
 * Hook for managing admin file approval and management
 */
export const useAdminFiles = (authUser, { setError, setSuccess, clearMessages }) => {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const fetchAbortController = useRef(null);

  const fetchFiles = useCallback(async () => {
    if (fetchAbortController.current) {
      fetchAbortController.current.abort();
    }
    fetchAbortController.current = new AbortController();
    setIsLoading(true);

    try {
      const data = await adminService.getAllFiles(fetchAbortController.current.signal);
      if (data.success) {
        setFiles(data.files);
      } else {
        setError('Failed to fetch files');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching files:', error);
        setError('Failed to connect to server');
      }
    } finally {
      setIsLoading(false);
    }
  }, [setError]);

  const deleteFile = useCallback(async (fileToDelete) => {
    if (!fileToDelete) {
      return;
    }
    setIsLoading(true);
    try {
      // Try to delete physical file
      try {
        await adminService.deleteFilePhysical(fileToDelete.id, {
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role
        });
      } catch (fileDeleteError) {
        console.warn('Physical file deletion failed:', fileDeleteError);
      }

      // Delete database record
      const data = await adminService.deleteFileRecord(fileToDelete.id, {
        adminId: authUser.id,
        adminUsername: authUser.username,
        adminRole: authUser.role,
        team: authUser.team
      });

      if (data.success) {
        setFiles(prevFiles => prevFiles.filter(file => file.id !== fileToDelete.id));
        setSuccess('File metadata deleted successfully');
        return true;
      } else {
        setError(data.message || 'Failed to delete file metadata');
        return false;
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      setError(error.message || 'Failed to delete file metadata');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [authUser, setError, setSuccess]);

  const openFile = useCallback(async (file) => {
    if (!file) {
      return;
    }
    setIsOpeningFile(true);
    try {
      const pathData = await adminService.getFilePath(file.id);
      if (!pathData.success) {
        throw new Error('Failed to get file path');
      }

      if (window.electron && typeof window.electron.openFileInApp === 'function') {
        const result = await window.electron.openFileInApp(pathData.filePath);
        if (!result.success) {
          throw new Error(result.error || 'Failed to open file');
        }
      } else {
        setError('File opening not available');
      }
    } catch (err) {
      console.error('Error opening file:', err);
      setError(err.message || 'Failed to open file');
    } finally {
      setIsOpeningFile(false);
    }
  }, [setError]);

  const approveFile = useCallback(async (selectedFile) => {
    if (!selectedFile) {
      return;
    }
    setIsLoading(true);
    try {
      if (window.electron && typeof window.electron.openDirectoryDialog === 'function') {
        const options = {};
        try {
          if (typeof window.electron.getNetworkProjectsPath === 'function') {
            const dp = await window.electron.getNetworkProjectsPath();
            if (dp) {
              options.defaultPath = dp;
            }
          }
        } catch (err) {
          console.warn('Could not get default path', err);
        }

        const result = await window.electron.openDirectoryDialog(options);
        if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) {
          setIsLoading(false);
          return;
        }
        const selectedPath = result.filePaths[0];

        await adminService.moveFileToProjects(selectedFile.id, {
          destinationPath: selectedPath,
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role,
          team: authUser.team
        });

        const approveData = await adminService.reviewFile(selectedFile.id, {
          action: 'approve',
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role,
          team: authUser.team
        });

        if (!approveData.success) {
          throw new Error(approveData.message || 'Failed to approve file');
        }

        setFiles(prevFiles =>
          prevFiles.map(f =>
            f.id === selectedFile.id ? { ...f, status: 'final_approved' } : f
          )
        );
        setSuccess('File approved and moved successfully');
        fetchFiles(); // Refresh to get public_network_url
        return true;
      } else {
        throw new Error('File system access not available');
      }
    } catch (err) {
      console.error('Approval error:', err);
      setError(err.message || 'Failed to approve file');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [authUser, setError, setSuccess, fetchFiles]);

  const rejectFile = useCallback(async (fileToReject) => {
    if (!fileToReject) {
      return;
    }
    setIsLoading(true);
    try {
      const data = await adminService.reviewFile(fileToReject.id, {
        action: 'reject',
        adminId: authUser.id,
        adminUsername: authUser.username,
        adminRole: authUser.role,
        team: authUser.team
      });

      if (data.success) {
        await adminService.deleteFilePhysical(fileToReject.id, {
          adminId: authUser.id,
          adminUsername: authUser.username,
          adminRole: authUser.role
        }).catch(() => { });

        setFiles(prevFiles =>
          prevFiles.map(f =>
            f.id === fileToReject.id ? { ...f, status: 'rejected_by_admin' } : f
          )
        );
        setSuccess('File rejected successfully');
        return true;
      } else {
        setError(data.message || 'Failed to reject file');
        return false;
      }
    } catch (error) {
      console.error('Error rejecting file:', error);
      setError('Failed to reject file');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [authUser, setError, setSuccess]);

  return {
    files,
    setFiles,
    isLoading,
    isOpeningFile,
    fetchFiles,
    deleteFile,
    openFile,
    approveFile,
    rejectFile
  };
};

import { apiFetch, API_BASE_URL } from '@/config/api';

/**
 * Handles opening a file, branching between Electron and Browser environments.
 */
export const openFile = async (file, { onError, onFileOpened }) => {
  if (!file || !file.id) return;

  try {
    const pathData = await apiFetch(`/api/files/${file.id}/path`);
    if (!pathData.success || !pathData.filePath) {
      throw new Error(pathData.message || 'Could not resolve file path');
    }

    if (window.electron?.openFileInApp) {
      const result = await window.electron.openFileInApp(pathData.filePath);
      if (!result.success) {
        onError?.(result.error || 'Failed to open file in associated application');
      } else {
        onFileOpened?.();
      }
    } else {
      // Browser fallback
      const ext = (pathData.filePath.split('.').pop() || '').toLowerCase();
      const browserViewable = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'txt', 'html', 'css', 'js', 'json', 'xml', 'mp4', 'mp3'];
      
      if (browserViewable.includes(ext)) {
        window.open(`${API_BASE_URL}/api/files/${file.id}/stream`, '_blank', 'noopener,noreferrer');
      } else {
        const a = Object.assign(document.createElement('a'), {
          href: `${API_BASE_URL}/api/files/${file.id}/stream`,
          download: file.original_name || 'file',
        });
        a.click();
      }
      onFileOpened?.();
    }
    
    // Record view in the background
    recordFileView(file.id).catch(() => {});
    
  } catch (err) {
    console.error('File open error:', err);
    onError?.(err.message || 'Failed to open file. Please try again.');
  }
};

/**
 * Handles downloading a single file
 */
export const downloadFile = async (file, { onToast }) => {
  const fileUrl = `${API_BASE_URL}/api/files/${file.id}/download`;
  const fileName = file.original_name || file.filename || 'file';

  if (window.electron?.downloadFile) {
    const result = await window.electron.downloadFile(fileUrl, fileName);
    if (result?.success) {
      onToast?.(fileName);
    } else if (result && !result.success && !result.canceled) {
      throw new Error(result.error || 'Download failed');
    }
  } else {
    const a = Object.assign(document.createElement('a'), { href: fileUrl, download: fileName });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onToast?.(fileName);
  }
};

/**
 * Handles downloading a folder as a ZIP
 */
export const downloadFolder = async (folderFiles, folderName, { onToast }) => {
  if (!folderFiles || folderFiles.length === 0) return;
  
  const fileIds = folderFiles.map(f => f.id).join(',');
  const fileUrl = `${API_BASE_URL}/api/files/folder/zip?fileIds=${fileIds}&folderName=${encodeURIComponent(folderName)}`;
  const fileName = `${folderName}.zip`;

  if (window.electron?.downloadFile) {
    const result = await window.electron.downloadFile(fileUrl, fileName);
    if (result?.success) {
      onToast?.(fileName);
    } else if (result && !result.success && !result.canceled) {
      throw new Error(result.error || 'Folder download failed');
    }
  } else {
    const a = Object.assign(document.createElement('a'), { href: fileUrl, download: fileName });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onToast?.(fileName);
  }
};

/**
 * Records a file view in the backend
 */
export const recordFileView = async (fileId) => {
  try {
    await apiFetch(`/api/files/${fileId}/view`, { method: 'POST' });
  } catch (e) {
    console.warn('View recording failed', e);
  }
};

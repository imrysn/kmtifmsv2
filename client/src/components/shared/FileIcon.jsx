import React, { useState, useEffect } from 'react';

// Global cache for icons to avoid redundant IPC calls across components
const iconCache = {};

// --- Premium Sidebar & UI Icons ---
const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

const FilesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ActivityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const ApprovalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9,11.01" />
  </svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1V15a2 2 0 0 1-2-2 2 2 0 0 1 2-2v-.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2v.09a1.65 1.65 0 0 0-1.6 1.51z" />
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const TasksIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M9 14l2 2 4-4" />
  </svg>
);

const NotificationsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

// --- Notification Icons ---
const CommentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const AssignmentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
    <path d="M10 9H8" />
  </svg>
);

const RejectionIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const PasswordResetIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="15" r="4" />
    <path d="M10.85 12.15L19 4" />
    <path d="M18 5l2 2" />
    <path d="M15 8l2 2" />
  </svg>
);

// --- Premium File Icons (Fallbacks) ---
const PremiumFolderIcon = ({ isOpen, size, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.15))', ...style }}>
    <defs>
      <linearGradient id="folderGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFD54F" />
        <stop offset="100%" stopColor="#FFA000" />
      </linearGradient>
      <linearGradient id="folderFrontGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFCA28" />
        <stop offset="100%" stopColor="#FF8F00" />
      </linearGradient>
    </defs>
    <path d="M4 4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V9C22 7.89543 21.1046 7 20 7H12L10 4H4Z" fill="url(#folderGradient)"/>
    <path d="M2 10V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V10H2Z" fill="url(#folderFrontGradient)"/>
    {isOpen && (
      <path d="M9 13L12 16L15 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    )}
  </svg>
);

const PremiumFileIcon = ({ extension, size, style, color, strokeWidth = 2.2 }) => {
  const ext = extension?.toLowerCase() || '';

  // 1. CAD 2D / Drafting (.dwg, .dxf, .icd)
  if (['.icd', '.dwg', '.dxf', '.slddrw'].includes(ext)) {
    const cadColor = color || "#0284c7";
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cadColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="12" y1="3" x2="12" y2="21" /><line x1="3" y1="12" x2="21" y2="12" />
        <circle cx="12" cy="12" r="3" /><path d="M19 19L15 15" />
      </svg>
    );
  }

  // 2. CAD 3D Assemblies (.sldasm, .iam)
  if (['.sldasm', '.iam'].includes(ext)) {
    const asmColor = color || "#7c3aed";
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={asmColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M7 10l5-5 5 5-5 5-5-5z" /><path d="M12 15l5 5 5-5-5-5-5 5z" /><path d="M2 15l5 5 5-5-5-5-5 5z" />
      </svg>
    );
  }

  // 3. CAD 3D Parts / Interoperability (.sldprt, .ipt, .step, .stp, .stl, .obj)
  if (['.sldprt', '.ipt', '.step', '.stp', '.stl', '.obj'].includes(ext)) {
    const partColor = color || "#059669";
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={partColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
        <circle cx="12" cy="12" r="3" strokeWidth={strokeWidth/2} />
      </svg>
    );
  }

  // PDF
  if (ext === '.pdf') {
    const pdfColor = color || "#dc2626";
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={pdfColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M10 13h4M10 17h4M8 9h1" />
      </svg>
    );
  }

  // Spreadsheets
  if (['.xlsx', '.xls', '.csv'].includes(ext)) {
    const excelColor = color || "#16a34a";
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={excelColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <rect x="8" y="11" width="8" height="8" rx="1" />
        <line x1="8" y1="15" x2="16" y2="15" /><line x1="12" y1="11" x2="12" y2="19" />
      </svg>
    );
  }

  // Images
  if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'].includes(ext)) {
    const imgColor = color || "#2563eb";
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={imgColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }

  // Archives
  if (['.zip', '.7z', '.rar', '.tar', '.gz'].includes(ext)) {
    const zipColor = color || "#ea580c";
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={zipColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <path d="M12 11v6M10 13h4M10 15h4" />
      </svg>
    );
  }

  // Documents
  if (['.docx', '.doc', '.txt', '.md', '.rtf', '.json', '.html', '.css', '.js', '.py', '.ts', '.jsx', '.tsx'].includes(ext)) {
    const docColor = color || "#0ea5e9";
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={docColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h8" />
      </svg>
    );
  }

  // Videos
  if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#E67E22" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
      </svg>
    );
  }

  // Generic File
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
};

// UI Mapping
const iconComponents = {
  dashboard: DashboardIcon,
  files: FilesIcon,
  users: UsersIcon,
  activityLogs: ActivityIcon,
  fileApproval: ApprovalIcon,
  settings: SettingsIcon,
  logout: LogoutIcon,
  tasks: TasksIcon,
  notifications: NotificationsIcon,
  comment: CommentIcon,
  assignment: AssignmentIcon,
  approval: ApprovalIcon,
  rejection: RejectionIcon,
  final_approval: ApprovalIcon,
  final_rejection: RejectionIcon,
  team_leader_approved: ApprovalIcon,
  password_reset_request: PasswordResetIcon,
  password_reset_complete: ApprovalIcon,
};

export const getSidebarIcon = (iconName) => {
  const IconComponent = iconComponents[iconName];
  return IconComponent ? <IconComponent /> : null;
};


const FileIcon = ({ 
  file, // The whole file object (contains original_name, file_path, etc.)
  fileType, 
  fileName,
  isFolder = false, 
  isOpen = false, 
  filePath = "", 
  altText = "File Icon", 
  className = "", 
  style = {}, 
  size = "default",
  color
}) => {
  const [nativeIcon, setNativeIcon] = useState(null);

  // Parse size
  const sizeMap = {
    small: 24,
    default: 40,
    medium: 48,
    large: 64
  };
  const numericSize = typeof size === 'number' ? size : (sizeMap[size] || sizeMap.default);

  // Derive data from 'file' object if provided
  const actualFileName = fileName || file?.original_name || file?.filename || file?.name || "";
  const actualFileType = fileType || file?.file_type || file?.type || "";
  // PRIORITIZE public_network_url for native Electron icons (this contains the absolute NAS/local path)
  const actualFilePath = filePath || file?.public_network_url || file?.file_path || file?.path || "";

  // Derive extension - prioritize filename extension over MIME type
  let extension = "";
  if (actualFileName && actualFileName.includes('.')) {
    extension = `.${actualFileName.split('.').pop().toLowerCase()}`;
  } else if (actualFileType && !actualFileType.includes('/')) {
    // If it's a simple string like "pdf"
    extension = actualFileType.startsWith('.') ? actualFileType.toLowerCase() : `.${actualFileType.toLowerCase()}`;
  }

  // Common image extensions where we prefer our premium SVG over generic OS icons
  // REMOVED .ico from here - it's better to let the OS handle it to show the real icon
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'].includes(extension);

  useEffect(() => {
    // Only attempt to fetch native icons in Electron environment with a valid file path
    // We skip images because our premium SVGs look better than generic OS image placeholders
    if (window.electron && window.electron.getFileIcon && actualFilePath && !isFolder && !isImage) {
      // Check cache first
      if (iconCache[extension]) {
        setNativeIcon(iconCache[extension]);
        return;
      }

      window.electron.getFileIcon(actualFilePath)
        .then((dataUrl) => {
          if (dataUrl) {
            setNativeIcon(dataUrl);
            iconCache[extension] = dataUrl;
          }
        })
        .catch((err) => {
          // Silent fail for icons
        });
    }
  }, [actualFilePath, extension, isFolder]);

  const containerStyle = {
    width: numericSize + 8,
    height: numericSize + 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    backgroundColor: isFolder ? 'transparent' : 'rgba(255, 255, 255, 0.5)',
    boxShadow: isFolder ? 'none' : 'inset 0 0 0 1px rgba(0,0,0,0.05)',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'inherit',
    ...style
  };

  const renderIcon = () => {
    if (isFolder) {
      return <PremiumFolderIcon isOpen={isOpen} size={numericSize} />;
    }

    if (nativeIcon) {
      return (
        <img 
          src={nativeIcon} 
          alt={altText || "file icon"} 
          className={className} 
          style={{ 
            width: numericSize, 
            height: numericSize, 
            objectFit: 'contain',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
          }}
        />
      );
    }

    return (
      <PremiumFileIcon 
        extension={extension} 
        size={numericSize} 
        color={color}
      />
    );
  };

  return (
    <div 
      className={`file-icon-container ${className}`.trim()}
      style={containerStyle}
      onMouseEnter={e => {
        if (!isFolder) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.backgroundColor = '#fff';
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
        }
      }}
      onMouseLeave={e => {
        if (!isFolder) {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
          e.currentTarget.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.05)';
        }
      }}
    >
      {renderIcon()}
    </div>
  );
};

export default React.memo(FileIcon);

import React from 'react';

// SVG icon components for better security (no external URLs)
const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" fill="#FDB022"/>
  </svg>
);

const PdfIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" fill="#E74C3C"/>
    <path d="M14 2v6h6" fill="#C0392B"/>
    <text x="12" y="17" fontSize="6" textAnchor="middle" fill="white" fontWeight="bold">PDF</text>
  </svg>
);

const DocIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" fill="#2980B9"/>
    <path d="M14 2v6h6" fill="#3498DB"/>
    <text x="12" y="17" fontSize="5" textAnchor="middle" fill="white" fontWeight="bold">DOC</text>
  </svg>
);

const ExcelIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" fill="#27AE60"/>
    <path d="M14 2v6h6" fill="#229954"/>
    <text x="12" y="17" fontSize="5" textAnchor="middle" fill="white" fontWeight="bold">XLS</text>
  </svg>
);

const ImageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="#9B59B6"/>
  </svg>
);

const ZipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" fill="#95A5A6"/>
    <path d="M14 2v6h6M10 8h2v2h-2v-2zm0 2h2v2h-2v-2z" fill="#7F8C8D"/>
    <text x="12" y="17" fontSize="5" textAnchor="middle" fill="white" fontWeight="bold">ZIP</text>
  </svg>
);

const VideoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M18 4l2 3h-3l-2-3h-2l2 3h-3l-2-3H8l2 3H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" fill="#E67E22"/>
    <path d="M10 12l5 3-5 3v-6z" fill="white"/>
  </svg>
);

const AudioIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="#1ABC9C"/>
  </svg>
);

const TextIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" fill="#34495E"/>
    <path d="M14 2v6h6" fill="#2C3E50"/>
    <rect x="8" y="12" width="8" height="1" fill="white"/>
    <rect x="8" y="14" width="8" height="1" fill="white"/>
    <rect x="8" y="16" width="6" height="1" fill="white"/>
  </svg>
);

const CadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" fill="#3498DB"/>
    <path d="M14 2v6h6" fill="#2980B9"/>
    <circle cx="12" cy="14" r="3" fill="none" stroke="white" strokeWidth="0.5"/>
    <line x1="12" y1="11" x2="12" y2="17" stroke="white" strokeWidth="0.5"/>
    <line x1="9" y1="14" x2="15" y2="14" stroke="white" strokeWidth="0.5"/>
  </svg>
);

const DefaultIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" fill="#BDC3C7"/>
    <path d="M14 2v6h6" fill="#95A5A6"/>
  </svg>
);

// Sidebar icons
const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor"/>
  </svg>
);

const FilesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/>
  </svg>
);

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor"/>
  </svg>
);

const ActivityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z" fill="currentColor"/>
  </svg>
);

const ApprovalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="currentColor"/>
  </svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor"/>
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="file-icon-svg">
    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" fill="currentColor"/>
  </svg>
);

// Icon mapping
const iconComponents = {
  folder: FolderIcon,
  pdf: PdfIcon,
  doc: DocIcon,
  docx: DocIcon,
  xls: ExcelIcon,
  xlsx: ExcelIcon,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  png: ImageIcon,
  gif: ImageIcon,
  bmp: ImageIcon,
  zip: ZipIcon,
  rar: ZipIcon,
  '7z': ZipIcon,
  mp4: VideoIcon,
  mov: VideoIcon,
  avi: VideoIcon,
  mkv: VideoIcon,
  mp3: AudioIcon,
  wav: AudioIcon,
  flac: AudioIcon,
  txt: TextIcon,
  json: TextIcon,
  html: TextIcon,
  css: TextIcon,
  js: TextIcon,
  default: DefaultIcon,
  icd: CadIcon,
  sldprt: CadIcon,
  sldasm: CadIcon,
  slddrw: CadIcon,
  dwg: CadIcon,
  dxf: CadIcon,
  
  // Sidebar icons
  dashboard: DashboardIcon,
  files: FilesIcon,
  users: UsersIcon,
  activityLogs: ActivityIcon,
  fileApproval: ApprovalIcon,
  settings: SettingsIcon,
  logout: LogoutIcon,
};

const getIconForFile = (fileType, isFolder = false) => {
  if (isFolder) return iconComponents.folder;
  const ext = fileType?.toLowerCase() || '';
  return iconComponents[ext] || iconComponents.default;
};

// Helper function to get sidebar icons
export const getSidebarIcon = (iconName) => {
  const IconComponent = iconComponents[iconName] || iconComponents.default;
  return <IconComponent />;
};

const FileIcon = ({ fileType, isFolder = false, altText = "File Icon", className = "", style = {}, size = "default" }) => {
  const IconComponent = getIconForFile(fileType, isFolder);

  // Size presets
  const sizeMap = {
    small: { width: '24px', height: '24px' },
    default: { width: '40px', height: '40px' },
    medium: { width: '48px', height: '48px' },
    large: { width: '64px', height: '64px' }
  };

  const sizeStyle = typeof size === 'string' && sizeMap[size] ? sizeMap[size] : sizeMap.default;

  return (
    <div 
      className={`file-icon-wrapper ${className}`.trim()}
      style={{
        width: sizeStyle.width,
        height: sizeStyle.height,
        minWidth: sizeStyle.width,
        minHeight: sizeStyle.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: 'transparent',
        ...style
      }}
      role="img"
      aria-label={altText}
    >
      <IconComponent />
    </div>
  );
};

export default React.memo(FileIcon);

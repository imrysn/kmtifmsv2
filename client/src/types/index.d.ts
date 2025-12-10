// Type definitions for KMTI FMS Admin Components

// User Types
export interface User {
  id: number;
  fullName: string;
  username: string;
  email: string;
  role: 'USER' | 'TEAM LEADER' | 'ADMIN';
  team: string | null;
  created_at: string;
  updated_at?: string;
}

// File Types
export interface FileData {
  id: number;
  original_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  uploaded_at: string;
  status: FileStatus;
  username: string;
  user_team: string;
  team_leader_comments?: string;
  admin_comments?: string;
  public_network_url?: string;
}

export type FileStatus = 
  | 'uploaded'
  | 'team_leader_approved'
  | 'final_approved'
  | 'rejected_by_team_leader'
  | 'rejected_by_admin';

// Team Types
export interface Team {
  id: number;
  name: string;
  leader_id?: number;
  leader_username?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// Activity Log Types
export interface ActivityLog {
  id: number;
  username: string;
  role: string;
  team: string;
  timestamp: string;
  activity: string;
}

// Notification Types
export interface Notification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  action_by_username: string;
  action_by_role: string;
  file_id?: number;
  file_name?: string;
  assignment_id?: number;
  assignment_title?: string;
  assignment_due_date?: string;
  comment_id?: number;
  is_read: boolean;
  created_at: string;
}

export type NotificationType = 
  | 'comment'
  | 'approval'
  | 'rejection'
  | 'assignment'
  | 'password_reset_request';

// Assignment Types
export interface Assignment {
  id: number;
  title: string;
  description: string;
  due_date: string | null;
  created_at: string;
  team_leader_id: number;
  team_leader_username: string;
  team_leader_fullname: string;
  assigned_to: string | 'all';
  assigned_member_details: User[];
  recent_submissions: FileSubmission[];
  comment_count: number;
}

export interface FileSubmission {
  id: number;
  original_name: string;
  file_path: string;
  file_size: number;
  submitted_at: string;
  username: string;
  fullName: string;
  tag?: string;
}

// Comment Types
export interface Comment {
  id: number;
  comment: string;
  user_id: number;
  username: string;
  user_fullname: string;
  user_role: string;
  created_at: string;
  replies: Reply[];
}

export interface Reply {
  id: number;
  reply: string;
  user_id: number;
  username: string;
  user_fullname: string;
  user_role: string;
  created_at: string;
}

// Dashboard Types
export interface DashboardSummary {
  totalFiles: number;
  approved: number;
  pending: number;
  rejected: number;
  fileTypes: FileTypeCount[];
  recentActivity: ActivityLog[];
  approvalRate: number;
  approvalTrends: ApprovalTrend[];
  previousMonth: {
    totalFiles: number;
    approved: number;
    pending: number;
    rejected: number;
  };
}

export interface FileTypeCount {
  file_type: string;
  count: number;
}

export interface ApprovalTrend {
  day?: string;
  date?: string;
  approved: number;
  rejected: number;
}

// Settings Types
export interface AppSettings {
  fileManagement: {
    rootDirectory: string;
  };
  general: {
    timezone: string;
    dateFormat: string;
    language: string;
  };
}

// Context Types
export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (userData: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  hasPermission: (requiredRole: string) => boolean;
}

export interface NetworkContextType {
  isOnline: boolean;
  isServerAvailable: boolean;
  isConnected: boolean;
  lastChecked: Date | null;
  checkNetworkStatus: () => Promise<boolean>;
  setCheckInterval: (interval: number) => void;
}

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: (silent?: boolean) => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: number) => Promise<void>;
  startPolling: (interval?: number) => void;
  stopPolling: () => void;
}

// Hook Return Types
export interface PaginationReturn<T> {
  currentPage: number;
  totalPages: number;
  paginatedItems: T[];
  startIndex: number;
  endIndex: number;
  itemsPerPage: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  resetPagination: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
}

export interface OptimisticUpdateReturn<T> {
  data: T | null;
  setData: (newData: T) => void;
  isUpdating: boolean;
  error: string | null;
  updateOptimistically: (
    optimisticUpdate: T | ((prev: T | null) => T),
    actualUpdate: () => Promise<any>,
    rollbackUpdate?: T | ((prev: T | null) => T)
  ) => Promise<{ success: boolean; data?: any; error?: any }>;
  clearError: () => void;
}

// Component Props Types
export interface AlertMessageProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
  autoCloseDelay?: number;
}

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  itemInfo?: {
    name?: string;
    details?: string;
  };
  children?: React.ReactNode;
}

export interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  title: string;
  submitText?: string;
  isLoading?: boolean;
  size?: 'small' | 'medium' | 'large';
  children: React.ReactNode;
}

export interface FileDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileData | null;
  onApprove: () => void;
  onReject: () => void;
  onOpenFile: () => void;
  isLoading: boolean;
  isOpeningFile: boolean;
  formatFileSize: (bytes: number) => string;
  mapFileStatus: (status: FileStatus) => string;
  getStatusDisplayName: (status: FileStatus) => string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedApiResponse<T = any> extends ApiResponse<T> {
  page?: number;
  limit?: number;
  totalCount?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
}

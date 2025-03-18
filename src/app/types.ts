// User preference types
export interface UserPreferences {
  notifications: {
    reportUpdates: boolean;
    reportComments: boolean;
    reportApprovals: boolean;
  };
  appearance: {
    compactMode: boolean;
  };
}

// Branch types
export interface Branch {
  id: string;
  code: string;
  name: string;
}

// User data interface
export interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string;
  username?: string;
  isActive: boolean;
  branch?: Branch;
  createdAt?: Date;
  updatedAt?: Date;
  computedFields: {
    displayName: string;
    accessLevel: string;
    status: string;
    primaryBranch?: {
      name: string;
      code: string;
    };
  };
  permissions: {
    canAccessAdmin: boolean;
    canViewAnalytics: boolean;
    canViewAuditLogs: boolean;
    canCustomizeDashboard: boolean;
    canManageSettings: boolean;
  };
  preferences: UserPreferences;
}

// Response types
export interface ApiResponse<T> {
  status?: number;
  error?: string;
  success?: boolean;
  data?: T;
}

export interface UserResponse {
  user: UserData;
}

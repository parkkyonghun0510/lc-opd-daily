import { StateCreator } from "zustand";
import { signIn, signOut } from "next-auth/react";
import { toast } from "sonner";
import { trackAuthEvent, AuthEventType } from "@/auth/utils/analytics";

// Define the types for our authentication state
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId?: string | null;
  image?: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  lastActivity: number;
  sessionExpiresAt: number | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  refreshInProgress: boolean;
}

export interface AuthActions {
  login: (
    username: string,
    password: string,
    callbackUrl?: string,
  ) => Promise<boolean>;
  logout: (callbackUrl?: string) => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
  setLoading: (isLoading: boolean) => void;
  updateLastActivity: () => void;
  setSessionExpiry: (expiresAt: number) => void;
  setRefreshToken: (token: string | null) => void;
  setTokenExpiry: (expiresAt: number | null) => void;
  refreshAuthToken: () => Promise<boolean>;
  silentRefresh: () => Promise<boolean>;
  setRefreshInProgress: (inProgress: boolean) => void;
}

export interface AuthSelectors {
  // Derived state
  isAdmin: () => boolean;
  isBranchManager: () => boolean;
  isSessionExpired: () => boolean;
  isTokenExpired: () => boolean;
  timeUntilExpiry: () => number;
  timeUntilTokenExpiry: () => number;
  inactivityTime: () => number;
  needsTokenRefresh: () => boolean;
}

export type AuthSlice = AuthState & AuthActions & AuthSelectors;

// Create the auth slice
export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (
  set,
  get,
) => ({
  // State
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
  lastActivity: Date.now(),
  sessionExpiresAt: null,
  refreshToken: null,
  tokenExpiresAt: null,
  refreshInProgress: false,

  // Actions
  login: async (
    username: string,
    password: string,
    callbackUrl = "/dashboard",
  ) => {
    try {
      set({
        isLoading: true,
        error: null,
        lastActivity: Date.now(),
      });

      // Use NextAuth's signIn function
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result?.ok) {
        // Handle specific error messages
        let errorMessage = "Failed to sign in";

        if (result?.error?.includes("No branch assigned")) {
          errorMessage =
            "Your account has no branch assigned. Please contact your administrator.";
        } else if (result?.error?.includes("Account is inactive")) {
          errorMessage =
            "Your account is inactive. Please contact your administrator.";
        } else if (result?.error?.includes("Invalid credentials")) {
          errorMessage = "Invalid email or password";
        }

        set({ error: errorMessage, isLoading: false });
        toast.error(errorMessage);

        // Track login failure
        trackAuthEvent(AuthEventType.LOGIN_FAILURE, {
          username,
          error: errorMessage,
          details: { callbackUrl },
        });

        return false;
      }

      // Set session expiry (30 minutes from now)
      const sessionExpiresAt = Date.now() + 30 * 60 * 1000;
      // Set token expiry (1 hour from now)
      const tokenExpiresAt = Date.now() + 60 * 60 * 1000;

      // Extract refresh token from result if available
      // For build, we'll just use null since the refreshToken property might not be available
      const refreshToken = null;

      set({
        isAuthenticated: true,
        isLoading: false,
        sessionExpiresAt,
        tokenExpiresAt,
        refreshToken,
      });

      toast.success("Signed in successfully");

      // Track login success
      if (get().user) {
        trackAuthEvent(AuthEventType.LOGIN_SUCCESS, {
          userId: get().user?.id,
          username: get().user?.email,
          role: get().user?.role,
          details: { callbackUrl },
        });
      }

      return true;
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage = "An error occurred during sign in";
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      return false;
    }
  },

  logout: async (callbackUrl = "/login") => {
    try {
      set({ isLoading: true });

      // Track logout event before clearing user data
      const user = get().user;
      if (user) {
        trackAuthEvent(AuthEventType.LOGOUT, {
          userId: user.id,
          username: user.email,
          role: user.role,
          details: { callbackUrl },
        });
      }

      // Ensure we're preserving the callbackUrl when signing out
      await signOut({
        redirect: false,
        callbackUrl,
      });

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        sessionExpiresAt: null,
        refreshToken: null,
        tokenExpiresAt: null,
        refreshInProgress: false,
      });

      // Ensure the callbackUrl is properly handled
      // If it already has query parameters, append to them
      if (callbackUrl.includes("?")) {
        window.location.href = callbackUrl;
      } else {
        // Otherwise, add the current timestamp to prevent caching issues
        window.location.href = `${callbackUrl}?t=${Date.now()}`;
      }
    } catch (error) {
      console.error("Logout error:", error);
      set({ isLoading: false });
      toast.error("An error occurred during sign out");
    }
  },

  setUser: (user) => {
    set({
      user,
      isAuthenticated: !!user,
      error: null,
      lastActivity: Date.now(),
    });

    // If user is set, also set session and token expiry
    if (user) {
      const sessionExpiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes
      const tokenExpiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

      set({
        sessionExpiresAt,
        tokenExpiresAt,
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  updateLastActivity: () => {
    set({ lastActivity: Date.now() });

    // Also extend session expiry if authenticated
    if (get().isAuthenticated) {
      set({ sessionExpiresAt: Date.now() + 30 * 60 * 1000 });
    }
  },

  setSessionExpiry: (expiresAt) => {
    set({ sessionExpiresAt: expiresAt });
  },

  setRefreshToken: (token) => {
    set({ refreshToken: token });
  },

  setTokenExpiry: (expiresAt) => {
    set({ tokenExpiresAt: expiresAt });
  },

  setRefreshInProgress: (inProgress) => {
    set({ refreshInProgress: inProgress });
  },

  refreshAuthToken: async () => {
    const { refreshToken, refreshInProgress } = get();

    // Skip if no refresh token or refresh already in progress
    if (!refreshToken || refreshInProgress) {
      return false;
    }

    try {
      set({ refreshInProgress: true });

      // Get the current URL to use as callbackUrl if needed
      const currentUrl =
        typeof window !== "undefined" ? window.location.href : "/dashboard";

      // Use NextAuth's signIn function with refresh token and current URL as callbackUrl
      const result = await signIn("refresh", {
        refreshToken,
        redirect: false,
        callbackUrl: currentUrl,
      });

      if (!result?.ok) {
        // Handle refresh token error
        set({
          error: "Failed to refresh token",
          refreshInProgress: false,
        });
        return false;
      }

      // Update token expiry (1 hour from now)
      const tokenExpiresAt = Date.now() + 60 * 60 * 1000;
      set({
        tokenExpiresAt,
        refreshInProgress: false,
        error: null,
      });

      // Also update session expiry
      get().updateLastActivity();

      return true;
    } catch (error) {
      console.error("Token refresh error:", error);
      set({
        error: "Failed to refresh token",
        refreshInProgress: false,
      });
      return false;
    }
  },

  silentRefresh: async () => {
    const { isAuthenticated, needsTokenRefresh, refreshInProgress } = get();

    // Skip if not authenticated, doesn't need refresh, or refresh in progress
    if (!isAuthenticated || !needsTokenRefresh() || refreshInProgress) {
      return false;
    }

    try {
      return await get().refreshAuthToken();
    } catch (error) {
      console.error("Silent refresh error:", error);
      return false;
    }
  },

  // Selectors (derived state)
  isAdmin: () => {
    const { user } = get();
    return user?.role === "ADMIN";
  },

  isBranchManager: () => {
    const { user } = get();
    return user?.role === "BRANCH_MANAGER";
  },

  isSessionExpired: () => {
    const { sessionExpiresAt } = get();
    if (!sessionExpiresAt) return false;
    return Date.now() > sessionExpiresAt;
  },

  isTokenExpired: () => {
    const { tokenExpiresAt } = get();
    if (!tokenExpiresAt) return false;
    return Date.now() > tokenExpiresAt;
  },

  timeUntilExpiry: () => {
    const { sessionExpiresAt } = get();
    if (!sessionExpiresAt) return 0;
    return Math.max(0, sessionExpiresAt - Date.now());
  },

  timeUntilTokenExpiry: () => {
    const { tokenExpiresAt } = get();
    if (!tokenExpiresAt) return 0;
    return Math.max(0, tokenExpiresAt - Date.now());
  },

  inactivityTime: () => {
    const { lastActivity } = get();
    return Date.now() - lastActivity;
  },

  needsTokenRefresh: () => {
    const { tokenExpiresAt, isAuthenticated } = get();

    // If not authenticated or no token expiry, no refresh needed
    if (!isAuthenticated || !tokenExpiresAt) return false;

    // Refresh if token expires in less than 5 minutes
    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
    return tokenExpiresAt < fiveMinutesFromNow;
  },
});

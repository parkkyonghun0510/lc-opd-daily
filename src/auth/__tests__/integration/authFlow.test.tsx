import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useStore } from '@/auth/store';
import { useAuth } from '@/auth/hooks/useAuth';
import { signIn, signOut } from 'next-auth/react';

// Mock next-auth
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Create a test component that uses the auth hooks
function TestAuthComponent() {
  const { user, isLoading, isAuthenticated, error, login, logout } = useAuth();
  
  const handleLogin = async () => {
    await login('test@example.com', 'password');
  };
  
  const handleLogout = async () => {
    await logout();
  };
  
  return (
    <div>
      <div data-testid="auth-status">
        {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
      
      {isLoading && <div data-testid="loading">Loading...</div>}
      
      {error && <div data-testid="error">{error}</div>}
      
      {user && (
        <div data-testid="user-info">
          <div data-testid="user-name">{user.name}</div>
          <div data-testid="user-email">{user.email}</div>
          <div data-testid="user-role">{user.role}</div>
        </div>
      )}
      
      <button data-testid="login-button" onClick={handleLogin}>
        Login
      </button>
      
      <button data-testid="logout-button" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset store
    useStore.setState({
      // Auth state
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
      lastActivity: Date.now(),
      sessionExpiresAt: null,
      
      // Profile state
      profile: null,
    });
  });

  it('should show initial unauthenticated state', () => {
    // Render component
    render(<TestAuthComponent />);
    
    // Check initial state
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    expect(screen.queryByTestId('user-info')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error')).not.toBeInTheDocument();
  });

  it('should handle successful login', async () => {
    // Mock signIn to return success
    (signIn as jest.Mock).mockResolvedValue({ ok: true });
    
    // Render component
    render(<TestAuthComponent />);
    
    // Click login button
    fireEvent.click(screen.getByTestId('login-button'));
    
    // Check loading state
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    
    // Wait for login to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
    
    // Check that signIn was called with the correct parameters
    expect(signIn).toHaveBeenCalledWith('credentials', {
      redirect: false,
      email: 'test@example.com',
      password: 'password',
      callbackUrl: undefined,
    });
    
    // Update store with user data to simulate session update
    useStore.setState({
      user: {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
      },
      isAuthenticated: true,
    });
    
    // Check authenticated state
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    
    // Check user info
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    expect(screen.getByTestId('user-role')).toHaveTextContent('USER');
  });

  it('should handle login failure', async () => {
    // Mock signIn to return failure
    (signIn as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'Invalid credentials',
    });
    
    // Render component
    render(<TestAuthComponent />);
    
    // Click login button
    fireEvent.click(screen.getByTestId('login-button'));
    
    // Check loading state
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    
    // Wait for login to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
    
    // Check error state
    expect(screen.getByTestId('error')).toHaveTextContent('Invalid email or password');
    
    // Check that still not authenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
  });

  it('should handle logout', async () => {
    // Set initial authenticated state
    useStore.setState({
      user: {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
      },
      isAuthenticated: true,
    });
    
    // Mock signOut to return success
    (signOut as jest.Mock).mockResolvedValue({});
    
    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
    
    // Render component
    render(<TestAuthComponent />);
    
    // Check initial authenticated state
    expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    expect(screen.getByTestId('user-info')).toBeInTheDocument();
    
    // Click logout button
    fireEvent.click(screen.getByTestId('logout-button'));
    
    // Check loading state
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    
    // Wait for logout to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
    
    // Check that signOut was called
    expect(signOut).toHaveBeenCalledWith({ redirect: false });
    
    // Check that window.location.href was set
    expect(window.location.href).toBe('/login');
  });

  it('should handle session timeout', async () => {
    // Set initial authenticated state with expired session
    useStore.setState({
      user: {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
      },
      isAuthenticated: true,
      sessionExpiresAt: Date.now() - 1000, // 1 second in the past
    });
    
    // Mock signOut to return success
    (signOut as jest.Mock).mockResolvedValue({});
    
    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
    
    // Create a component that uses the session timeout
    function SessionTimeoutComponent() {
      const { isSessionExpired } = useAuth();
      
      React.useEffect(() => {
        if (isSessionExpired()) {
          useStore.getState().logout();
        }
      }, [isSessionExpired]);
      
      return (
        <div data-testid="session-status">
          {isSessionExpired() ? 'Expired' : 'Active'}
        </div>
      );
    }
    
    // Render component
    render(<SessionTimeoutComponent />);
    
    // Check that session is expired
    expect(screen.getByTestId('session-status')).toHaveTextContent('Expired');
    
    // Wait for logout to complete
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
    });
    
    // Check that window.location.href was set
    expect(window.location.href).toBe('/login');
  });
});

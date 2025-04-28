import React from 'react';
import { render, screen } from '@testing-library/react';
import { PermissionGate } from '@/auth/components/PermissionGate';
import { useStore } from '@/auth/store';
import { hasPermission, hasBranchAccess } from '@/auth/store/actions';

// Mock the store
jest.mock('@/auth/store', () => ({
  useStore: jest.fn(),
}));

// Mock the actions
jest.mock('@/auth/store/actions', () => ({
  hasPermission: jest.fn(),
  hasBranchAccess: jest.fn(),
}));

// Mock analytics
jest.mock('@/auth/utils/analytics', () => ({
  trackAuthEvent: jest.fn(),
  AuthEventType: {
    PERMISSION_DENIED: 'auth:permission_denied',
  },
}));

describe('PermissionGate', () => {
  // Mock store state
  const mockStore = {
    user: { id: '1', name: 'Test User', email: 'test@example.com', role: 'USER' },
    isLoading: false,
    isAuthenticated: true,
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up mock store
    (useStore as jest.Mock).mockReturnValue(mockStore);
    
    // Set up mock actions
    (hasPermission as jest.Mock).mockReturnValue(true);
    (hasBranchAccess as jest.Mock).mockReturnValue(true);
  });

  it('should render children when user has permission', () => {
    // Set up mock actions
    (hasPermission as jest.Mock).mockReturnValue(true);
    
    // Render component
    render(
      <PermissionGate permissions={['VIEW_REPORTS']}>
        <div data-testid="protected-content">Protected Content</div>
      </PermissionGate>
    );
    
    // Check that children are rendered
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should render fallback when user does not have permission', () => {
    // Set up mock actions
    (hasPermission as jest.Mock).mockReturnValue(false);
    
    // Render component
    render(
      <PermissionGate 
        permissions={['MANAGE_USERS']} 
        fallback={<div data-testid="fallback-content">Access Denied</div>}
      >
        <div data-testid="protected-content">Protected Content</div>
      </PermissionGate>
    );
    
    // Check that fallback is rendered
    expect(screen.getByTestId('fallback-content')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should render fallback when user is not authenticated', () => {
    // Set up mock store
    (useStore as jest.Mock).mockReturnValue({
      ...mockStore,
      isAuthenticated: false,
    });
    
    // Render component
    render(
      <PermissionGate 
        permissions={['VIEW_REPORTS']} 
        fallback={<div data-testid="fallback-content">Access Denied</div>}
      >
        <div data-testid="protected-content">Protected Content</div>
      </PermissionGate>
    );
    
    // Check that fallback is rendered
    expect(screen.getByTestId('fallback-content')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should render loading component when loading', () => {
    // Set up mock store
    (useStore as jest.Mock).mockReturnValue({
      ...mockStore,
      isLoading: true,
    });
    
    // Render component
    render(
      <PermissionGate 
        permissions={['VIEW_REPORTS']} 
        loadingComponent={<div data-testid="loading-content">Loading...</div>}
      >
        <div data-testid="protected-content">Protected Content</div>
      </PermissionGate>
    );
    
    // Check that loading component is rendered
    expect(screen.getByTestId('loading-content')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should check all permissions when requireAll is true', () => {
    // Set up mock actions
    (hasPermission as jest.Mock)
      .mockImplementation((permission) => {
        return permission === 'VIEW_REPORTS'; // Only VIEW_REPORTS is allowed
      });
    
    // Render component with requireAll=true
    render(
      <PermissionGate 
        permissions={['VIEW_REPORTS', 'EDIT_REPORTS']} 
        requireAll={true}
        fallback={<div data-testid="fallback-content">Access Denied</div>}
      >
        <div data-testid="protected-content">Protected Content</div>
      </PermissionGate>
    );
    
    // Check that fallback is rendered (since not all permissions are granted)
    expect(screen.getByTestId('fallback-content')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should check any permission when requireAll is false', () => {
    // Set up mock actions
    (hasPermission as jest.Mock)
      .mockImplementation((permission) => {
        return permission === 'VIEW_REPORTS'; // Only VIEW_REPORTS is allowed
      });
    
    // Render component with requireAll=false
    render(
      <PermissionGate 
        permissions={['VIEW_REPORTS', 'EDIT_REPORTS']} 
        requireAll={false}
      >
        <div data-testid="protected-content">Protected Content</div>
      </PermissionGate>
    );
    
    // Check that children are rendered (since at least one permission is granted)
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should check user role', () => {
    // Set up mock store
    (useStore as jest.Mock).mockReturnValue({
      ...mockStore,
      user: { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'ADMIN' },
    });
    
    // Render component with roles
    render(
      <PermissionGate roles={['ADMIN']}>
        <div data-testid="protected-content">Protected Content</div>
      </PermissionGate>
    );
    
    // Check that children are rendered
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should deny access if user role does not match', () => {
    // Set up mock store
    (useStore as jest.Mock).mockReturnValue({
      ...mockStore,
      user: { id: '1', name: 'Regular User', email: 'user@example.com', role: 'USER' },
    });
    
    // Render component with roles
    render(
      <PermissionGate 
        roles={['ADMIN']} 
        fallback={<div data-testid="fallback-content">Access Denied</div>}
      >
        <div data-testid="protected-content">Protected Content</div>
      </PermissionGate>
    );
    
    // Check that fallback is rendered
    expect(screen.getByTestId('fallback-content')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should check branch access', () => {
    // Set up mock actions
    (hasBranchAccess as jest.Mock).mockReturnValue(true);
    
    // Render component with branchId
    render(
      <PermissionGate branchId="branch-1">
        <div data-testid="protected-content">Protected Content</div>
      </PermissionGate>
    );
    
    // Check that children are rendered
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    
    // Check that hasBranchAccess was called with the correct branchId
    expect(hasBranchAccess).toHaveBeenCalledWith('branch-1');
  });

  it('should deny access if user does not have branch access', () => {
    // Set up mock actions
    (hasBranchAccess as jest.Mock).mockReturnValue(false);
    
    // Render component with branchId
    render(
      <PermissionGate 
        branchId="branch-2" 
        fallback={<div data-testid="fallback-content">Access Denied</div>}
      >
        <div data-testid="protected-content">Protected Content</div>
      </PermissionGate>
    );
    
    // Check that fallback is rendered
    expect(screen.getByTestId('fallback-content')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should combine permission, role, and branch checks', () => {
    // Set up mock actions
    (hasPermission as jest.Mock).mockReturnValue(true);
    (hasBranchAccess as jest.Mock).mockReturnValue(true);
    
    // Set up mock store
    (useStore as jest.Mock).mockReturnValue({
      ...mockStore,
      user: { id: '1', name: 'Branch Manager', email: 'manager@example.com', role: 'BRANCH_MANAGER' },
    });
    
    // Render component with permissions, roles, and branchId
    render(
      <PermissionGate 
        permissions={['VIEW_REPORTS']} 
        roles={['BRANCH_MANAGER']} 
        branchId="branch-1"
      >
        <div data-testid="protected-content">Protected Content</div>
      </PermissionGate>
    );
    
    // Check that children are rendered
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should deny access if any check fails', () => {
    // Set up mock actions
    (hasPermission as jest.Mock).mockReturnValue(true);
    (hasBranchAccess as jest.Mock).mockReturnValue(false); // Branch access fails
    
    // Set up mock store
    (useStore as jest.Mock).mockReturnValue({
      ...mockStore,
      user: { id: '1', name: 'Branch Manager', email: 'manager@example.com', role: 'BRANCH_MANAGER' },
    });
    
    // Render component with permissions, roles, and branchId
    render(
      <PermissionGate 
        permissions={['VIEW_REPORTS']} 
        roles={['BRANCH_MANAGER']} 
        branchId="branch-2" 
        fallback={<div data-testid="fallback-content">Access Denied</div>}
      >
        <div data-testid="protected-content">Protected Content</div>
      </PermissionGate>
    );
    
    // Check that fallback is rendered
    expect(screen.getByTestId('fallback-content')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});

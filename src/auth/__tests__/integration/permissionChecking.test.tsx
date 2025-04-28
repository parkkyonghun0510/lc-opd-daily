import React from 'react';
import { render, screen } from '@testing-library/react';
import { useStore } from '@/auth/store';
import { PermissionGate } from '@/auth/components/PermissionGate';
import { ProtectedRoute } from '@/auth/components/ProtectedRoute';
import { usePermissions } from '@/auth/hooks/useAuth';
import { hasPermission, hasBranchAccess } from '@/auth/store/actions';

// Mock the actions
jest.mock('@/auth/store/actions', () => ({
  hasPermission: jest.fn(),
  hasBranchAccess: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn().mockReturnValue({
    push: jest.fn(),
  }),
}));

// Create a test component that uses the permission hooks
function TestPermissionComponent() {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasBranchAccess } = usePermissions();
  
  return (
    <div>
      <div data-testid="view-reports">
        {hasPermission('VIEW_REPORTS') ? 'Can View Reports' : 'Cannot View Reports'}
      </div>
      
      <div data-testid="edit-reports">
        {hasPermission('EDIT_REPORTS') ? 'Can Edit Reports' : 'Cannot Edit Reports'}
      </div>
      
      <div data-testid="any-permission">
        {hasAnyPermission(['VIEW_REPORTS', 'EDIT_REPORTS']) ? 'Has Any Permission' : 'Has No Permission'}
      </div>
      
      <div data-testid="all-permissions">
        {hasAllPermissions(['VIEW_REPORTS', 'EDIT_REPORTS']) ? 'Has All Permissions' : 'Missing Some Permissions'}
      </div>
      
      <div data-testid="admin-role">
        {hasRole('ADMIN') ? 'Is Admin' : 'Not Admin'}
      </div>
      
      <div data-testid="branch-access">
        {hasBranchAccess('branch-1') ? 'Has Branch Access' : 'No Branch Access'}
      </div>
      
      <PermissionGate permissions={['VIEW_REPORTS']}>
        <div data-testid="permission-gate-content">Protected Content</div>
      </PermissionGate>
      
      <PermissionGate 
        permissions={['MANAGE_USERS']} 
        fallback={<div data-testid="permission-gate-fallback">Access Denied</div>}
      >
        <div>Admin Content</div>
      </PermissionGate>
    </div>
  );
}

describe('Permission Checking Integration', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset store
    useStore.setState({
      // Auth state
      user: {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        branchId: 'branch-1',
      },
      isLoading: false,
      isAuthenticated: true,
      error: null,
      lastActivity: Date.now(),
      sessionExpiresAt: Date.now() + 30 * 60 * 1000,
      
      // Profile state
      profile: null,
    });
    
    // Set up mock actions
    (hasPermission as jest.Mock).mockImplementation((permission) => {
      if (permission === 'VIEW_REPORTS') return true;
      if (permission === 'EDIT_REPORTS') return false;
      if (permission === 'MANAGE_USERS') return false;
      return false;
    });
    
    (hasBranchAccess as jest.Mock).mockImplementation((branchId) => {
      return branchId === 'branch-1';
    });
  });

  it('should check individual permissions correctly', () => {
    // Render component
    render(<TestPermissionComponent />);
    
    // Check permission results
    expect(screen.getByTestId('view-reports')).toHaveTextContent('Can View Reports');
    expect(screen.getByTestId('edit-reports')).toHaveTextContent('Cannot Edit Reports');
  });

  it('should check any permissions correctly', () => {
    // Render component
    render(<TestPermissionComponent />);
    
    // Check any permission result
    expect(screen.getByTestId('any-permission')).toHaveTextContent('Has Any Permission');
  });

  it('should check all permissions correctly', () => {
    // Render component
    render(<TestPermissionComponent />);
    
    // Check all permissions result
    expect(screen.getByTestId('all-permissions')).toHaveTextContent('Missing Some Permissions');
  });

  it('should check role correctly', () => {
    // Render component
    render(<TestPermissionComponent />);
    
    // Check role result
    expect(screen.getByTestId('admin-role')).toHaveTextContent('Not Admin');
  });

  it('should check branch access correctly', () => {
    // Render component
    render(<TestPermissionComponent />);
    
    // Check branch access result
    expect(screen.getByTestId('branch-access')).toHaveTextContent('Has Branch Access');
  });

  it('should render PermissionGate content when user has permission', () => {
    // Render component
    render(<TestPermissionComponent />);
    
    // Check that PermissionGate content is rendered
    expect(screen.getByTestId('permission-gate-content')).toBeInTheDocument();
  });

  it('should render PermissionGate fallback when user does not have permission', () => {
    // Render component
    render(<TestPermissionComponent />);
    
    // Check that PermissionGate fallback is rendered
    expect(screen.getByTestId('permission-gate-fallback')).toBeInTheDocument();
  });

  it('should render ProtectedRoute content when user has permission', () => {
    // Render component
    render(
      <ProtectedRoute permissions={['VIEW_REPORTS']}>
        <div data-testid="protected-route-content">Protected Content</div>
      </ProtectedRoute>
    );
    
    // Check that ProtectedRoute content is rendered
    expect(screen.getByTestId('protected-route-content')).toBeInTheDocument();
  });

  it('should not render ProtectedRoute content when user does not have permission', () => {
    // Render component
    render(
      <ProtectedRoute permissions={['MANAGE_USERS']}>
        <div data-testid="protected-route-content">Protected Content</div>
      </ProtectedRoute>
    );
    
    // Check that ProtectedRoute content is not rendered
    expect(screen.queryByTestId('protected-route-content')).not.toBeInTheDocument();
  });

  it('should handle complex permission scenarios', () => {
    // Set up mock actions for complex scenario
    (hasPermission as jest.Mock).mockImplementation((permission) => {
      if (permission === 'VIEW_REPORTS') return true;
      if (permission === 'EDIT_REPORTS') return true;
      if (permission === 'APPROVE_REPORTS') return false;
      if (permission === 'MANAGE_USERS') return false;
      return false;
    });
    
    // Render component with complex permission requirements
    render(
      <div>
        <PermissionGate 
          permissions={['VIEW_REPORTS', 'EDIT_REPORTS']} 
          requireAll={true}
        >
          <div data-testid="all-required-content">All Required Content</div>
        </PermissionGate>
        
        <PermissionGate 
          permissions={['VIEW_REPORTS', 'APPROVE_REPORTS']} 
          requireAll={true}
          fallback={<div data-testid="all-required-fallback">Missing Required Permissions</div>}
        >
          <div>All Required Content 2</div>
        </PermissionGate>
        
        <PermissionGate 
          permissions={['VIEW_REPORTS', 'APPROVE_REPORTS']} 
          requireAll={false}
        >
          <div data-testid="any-required-content">Any Required Content</div>
        </PermissionGate>
        
        <PermissionGate 
          permissions={['MANAGE_USERS', 'APPROVE_REPORTS']} 
          requireAll={false}
          fallback={<div data-testid="any-required-fallback">No Required Permissions</div>}
        >
          <div>Any Required Content 2</div>
        </PermissionGate>
      </div>
    );
    
    // Check complex permission results
    expect(screen.getByTestId('all-required-content')).toBeInTheDocument();
    expect(screen.getByTestId('all-required-fallback')).toBeInTheDocument();
    expect(screen.getByTestId('any-required-content')).toBeInTheDocument();
    expect(screen.getByTestId('any-required-fallback')).toBeInTheDocument();
  });

  it('should handle role and branch access together', () => {
    // Set up user with different role
    useStore.setState({
      user: {
        id: '1',
        name: 'Branch Manager',
        email: 'manager@example.com',
        role: 'BRANCH_MANAGER',
        branchId: 'branch-1',
      },
      isAuthenticated: true,
    });
    
    // Render component with role and branch requirements
    render(
      <div>
        <PermissionGate 
          roles={['BRANCH_MANAGER']} 
          branchId="branch-1"
        >
          <div data-testid="branch-manager-content">Branch Manager Content</div>
        </PermissionGate>
        
        <PermissionGate 
          roles={['BRANCH_MANAGER']} 
          branchId="branch-2"
          fallback={<div data-testid="wrong-branch-fallback">Wrong Branch</div>}
        >
          <div>Branch Manager Content 2</div>
        </PermissionGate>
        
        <PermissionGate 
          roles={['ADMIN']} 
          branchId="branch-1"
          fallback={<div data-testid="wrong-role-fallback">Wrong Role</div>}
        >
          <div>Admin Content</div>
        </PermissionGate>
      </div>
    );
    
    // Check role and branch access results
    expect(screen.getByTestId('branch-manager-content')).toBeInTheDocument();
    expect(screen.getByTestId('wrong-branch-fallback')).toBeInTheDocument();
    expect(screen.getByTestId('wrong-role-fallback')).toBeInTheDocument();
  });
});

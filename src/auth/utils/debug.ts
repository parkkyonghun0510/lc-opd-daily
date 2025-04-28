'use client';

import { debugPermissions } from '@/auth/store/actions';
import { useStore } from '@/auth/store';
import { Permission, UserRole } from '@/lib/auth/roles';

/**
 * Utility function to check permissions in the browser console
 * 
 * Usage:
 * 1. Import in a client component: import { exposeDebugUtils } from '@/auth/utils/debug';
 * 2. Call in useEffect: useEffect(() => { exposeDebugUtils(); }, []);
 * 3. Access in browser console: window.auth.checkPermission('ACCESS_ADMIN');
 */
export function exposeDebugUtils() {
  if (typeof window !== 'undefined') {
    // Create auth namespace if it doesn't exist
    (window as any).auth = (window as any).auth || {};
    
    // Add debug utilities
    (window as any).auth.debug = debugPermissions;
    (window as any).auth.checkPermission = (permission: string) => {
      const debug = debugPermissions();
      const hasPermission = debug.hasPermission(permission);
      console.log(`Permission check for "${permission}": ${hasPermission ? 'GRANTED ✅' : 'DENIED ❌'}`);
      return hasPermission;
    };
    
    // Add utility to check all permissions for current user
    (window as any).auth.checkAllPermissions = () => {
      const debug = debugPermissions();
      const allPermissions = Object.values(Permission);
      
      console.log(`=== Permission Check for ${debug.user?.name} (${debug.role}) ===`);
      
      const results = allPermissions.map(permission => {
        const permissionStr = permission.toString();
        const hasPermission = debug.hasPermission(permissionStr);
        return { permission: permissionStr, granted: hasPermission };
      });
      
      // Group by granted/denied
      const granted = results.filter(r => r.granted).map(r => r.permission);
      const denied = results.filter(r => !r.granted).map(r => r.permission);
      
      console.log(`✅ GRANTED (${granted.length}):`);
      granted.forEach(p => console.log(`- ${p}`));
      
      console.log(`❌ DENIED (${denied.length}):`);
      denied.forEach(p => console.log(`- ${p}`));
      
      return { granted, denied };
    };
    
    // Add utility to get current user info
    (window as any).auth.getCurrentUser = () => {
      const store = useStore.getState();
      return store.user;
    };
    
    console.log('Auth debug utilities exposed. Available commands:');
    console.log('- auth.debug() - Show all permission debug info');
    console.log('- auth.checkPermission("PERMISSION_NAME") - Check specific permission');
    console.log('- auth.checkAllPermissions() - Check all permissions');
    console.log('- auth.getCurrentUser() - Get current user info');
  }
}

/**
 * Component that exposes debug utilities when rendered
 * Can be added to layout or page components during development
 */
export function DebugUtilitiesExposer() {
  // Expose debug utilities
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    exposeDebugUtils();
  }
  
  // Return null - this component doesn't render anything
  return null;
}

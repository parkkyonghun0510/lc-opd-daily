/**
 * Constants related to user roles and permissions
 * These constants are used throughout the application for role-based access control
 */

/**
 * Role names that have management permissions
 * Used for targeting notifications and permission checks
 */
export const MANAGER_ROLE_NAMES = [
    'manager', 'admin', 'approver', 'branch_manager',
    'BRANCH_MANAGER', 'ADMIN', 'APPROVER'
];

/**
 * Role names that have supervisor permissions
 * Used for targeting notifications and permission checks
 */
export const SUPERVISOR_ROLE_NAMES = ['SUPERVISOR', 'supervisor'];

/**
 * Role names for users who can submit reports
 * Includes regular users, supervisors, and managers
 */
export const REPORTER_ROLE_NAMES = [
    'reporter', 'user', 'manager', 'USER', 'SUPERVISOR', 'BRANCH_MANAGER'
];

/**
 * Cache TTL in milliseconds for various caches
 */
export const CACHE_TTL = {
    BRANCH_MAPS: 5 * 60 * 1000, // 5 minutes
    USER_ACCESS: 5 * 60 * 1000, // 5 minutes
    USER_CACHE: 2 * 60 * 1000,  // 2 minutes
    REPORT_CACHE: 2 * 60 * 1000 // 2 minutes
};

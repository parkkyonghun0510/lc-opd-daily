/**
 * Utility functions for handling authentication sessions
 */

/**
 * Clears all browser storage related to authentication
 */
export function clearAuthData() {
  if (typeof window === 'undefined') return;

  // Clear cookies
  document.cookie.split(";").forEach(cookie => {
    const [name] = cookie.trim().split("=");
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  });
  
  // Clear localStorage items related to auth
  const authKeys = [
    "next-auth.callback-url",
    "next-auth.csrf-token",
    "next-auth.session-token",
  ];
  
  authKeys.forEach(key => localStorage.removeItem(key));
  
  // Clear sessionStorage
  sessionStorage.clear();
}

/**
 * Performs a complete sign out including clearing storage
 * @param redirectUrl URL to redirect to after sign out
 */
export async function completeSignOut(redirectUrl = "/login") {
  if (typeof window === 'undefined') return;
  
  try {
    // First clear browser storage
    clearAuthData();
    
    // Then redirect (could be replaced with NextAuth signOut)
    window.location.href = redirectUrl;
  } catch (error) {
    console.error("Error during sign out:", error);
    // Fallback to simple redirect
    window.location.href = redirectUrl;
  }
} 
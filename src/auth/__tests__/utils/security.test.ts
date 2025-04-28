import { 
  validateToken, 
  generateFingerprint, 
  validateFingerprint, 
  trackLoginAttempt, 
  isAccountLocked, 
  getAccountUnlockTime, 
  unlockAccount, 
  configureSecurity, 
  getSecurityConfig 
} from '@/auth/utils/security';
import { jwtDecode } from 'jwt-decode';

// Mock jwt-decode
jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

// Mock navigator
const navigatorMock = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  language: 'en-US',
  platform: 'Win32',
};

// Mock window.screen
const screenMock = {
  width: 1920,
  height: 1080,
  colorDepth: 24,
};

// Mock Intl.DateTimeFormat
const dateTimeFormatMock = {
  resolvedOptions: jest.fn().mockReturnValue({ timeZone: 'America/New_York' }),
};

describe('Security Utilities', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up localStorage mock
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    
    // Set up navigator mock
    Object.defineProperty(window, 'navigator', { value: navigatorMock });
    
    // Set up screen mock
    Object.defineProperty(window, 'screen', { value: screenMock });
    
    // Set up Intl.DateTimeFormat mock
    (global.Intl as any).DateTimeFormat = jest.fn().mockImplementation(() => dateTimeFormatMock);
    
    // Reset localStorage
    localStorageMock.clear();
    
    // Configure security for testing
    configureSecurity({
      enabled: true,
      tokenValidation: true,
      fingerprintValidation: true,
      bruteForceProtection: true,
      maxLoginAttempts: 5,
      lockoutDuration: 15,
    });
  });

  describe('validateToken', () => {
    it('should return true for valid token', () => {
      // Mock jwtDecode to return valid token data
      (jwtDecode as jest.Mock).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour in the future
        sub: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
      });
      
      // Validate token
      const result = validateToken('valid-token');
      
      // Check that jwtDecode was called
      expect(jwtDecode).toHaveBeenCalledWith('valid-token');
      
      // Check that result is true
      expect(result).toBe(true);
    });

    it('should return false for expired token', () => {
      // Mock jwtDecode to return expired token data
      (jwtDecode as jest.Mock).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour in the past
        sub: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
      });
      
      // Validate token
      const result = validateToken('expired-token');
      
      // Check that jwtDecode was called
      expect(jwtDecode).toHaveBeenCalledWith('expired-token');
      
      // Check that result is false
      expect(result).toBe(false);
    });

    it('should return false for invalid token', () => {
      // Mock jwtDecode to throw error
      (jwtDecode as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      // Validate token
      const result = validateToken('invalid-token');
      
      // Check that jwtDecode was called
      expect(jwtDecode).toHaveBeenCalledWith('invalid-token');
      
      // Check that result is false
      expect(result).toBe(false);
    });

    it('should return true when token validation is disabled', () => {
      // Configure security with token validation disabled
      configureSecurity({
        tokenValidation: false,
      });
      
      // Validate token
      const result = validateToken('any-token');
      
      // Check that jwtDecode was not called
      expect(jwtDecode).not.toHaveBeenCalled();
      
      // Check that result is true
      expect(result).toBe(true);
    });

    it('should return true when security is disabled', () => {
      // Configure security with disabled
      configureSecurity({
        enabled: false,
      });
      
      // Validate token
      const result = validateToken('any-token');
      
      // Check that jwtDecode was not called
      expect(jwtDecode).not.toHaveBeenCalled();
      
      // Check that result is true
      expect(result).toBe(true);
    });
  });

  describe('generateFingerprint', () => {
    it('should generate a fingerprint string', () => {
      // Generate fingerprint
      const fingerprint = generateFingerprint();
      
      // Check that fingerprint is a non-empty string
      expect(typeof fingerprint).toBe('string');
      expect(fingerprint.length).toBeGreaterThan(0);
    });

    it('should generate the same fingerprint for the same browser', () => {
      // Generate fingerprint twice
      const fingerprint1 = generateFingerprint();
      const fingerprint2 = generateFingerprint();
      
      // Check that fingerprints are the same
      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate different fingerprints for different browsers', () => {
      // Generate fingerprint with current browser
      const fingerprint1 = generateFingerprint();
      
      // Change browser properties
      Object.defineProperty(window, 'navigator', {
        value: {
          ...navigatorMock,
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          platform: 'MacIntel',
        },
      });
      
      // Generate fingerprint with different browser
      const fingerprint2 = generateFingerprint();
      
      // Check that fingerprints are different
      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should return empty string on server', () => {
      // Save original window
      const originalWindow = global.window;
      
      // Set window to undefined to simulate server
      (global as any).window = undefined;
      
      // Generate fingerprint
      const fingerprint = generateFingerprint();
      
      // Check that fingerprint is an empty string
      expect(fingerprint).toBe('');
      
      // Restore window
      (global as any).window = originalWindow;
    });
  });

  describe('validateFingerprint', () => {
    it('should return true when fingerprints match', () => {
      // Generate fingerprint
      const fingerprint = generateFingerprint();
      
      // Validate fingerprint
      const result = validateFingerprint(fingerprint);
      
      // Check that result is true
      expect(result).toBe(true);
    });

    it('should return false when fingerprints do not match', () => {
      // Validate with different fingerprint
      const result = validateFingerprint('different-fingerprint');
      
      // Check that result is false
      expect(result).toBe(false);
    });

    it('should return true when fingerprint validation is disabled', () => {
      // Configure security with fingerprint validation disabled
      configureSecurity({
        fingerprintValidation: false,
      });
      
      // Validate with different fingerprint
      const result = validateFingerprint('different-fingerprint');
      
      // Check that result is true
      expect(result).toBe(true);
    });

    it('should return true when security is disabled', () => {
      // Configure security with disabled
      configureSecurity({
        enabled: false,
      });
      
      // Validate with different fingerprint
      const result = validateFingerprint('different-fingerprint');
      
      // Check that result is true
      expect(result).toBe(true);
    });
  });

  describe('trackLoginAttempt', () => {
    it('should track successful login attempt', () => {
      // Track successful login attempt
      const result = trackLoginAttempt('test@example.com', true);
      
      // Check that result is false (account not locked)
      expect(result).toBe(false);
      
      // Check that localStorage.setItem was called
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      // Get the key and value from the call
      const key = localStorageMock.setItem.mock.calls[0][0];
      const value = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      
      // Check that the key is correct
      expect(key).toBe('auth_login_attempts');
      
      // Check that the value contains the username with reset attempts
      expect(value['test@example.com']).toBeDefined();
      expect(value['test@example.com'].count).toBe(0);
      expect(value['test@example.com'].locked).toBe(false);
    });

    it('should track failed login attempt', () => {
      // Track failed login attempt
      const result = trackLoginAttempt('test@example.com', false);
      
      // Check that result is false (account not locked)
      expect(result).toBe(false);
      
      // Check that localStorage.setItem was called
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      // Get the key and value from the call
      const key = localStorageMock.setItem.mock.calls[0][0];
      const value = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      
      // Check that the key is correct
      expect(key).toBe('auth_login_attempts');
      
      // Check that the value contains the username with incremented attempts
      expect(value['test@example.com']).toBeDefined();
      expect(value['test@example.com'].count).toBe(1);
      expect(value['test@example.com'].locked).toBe(false);
    });

    it('should lock account after max failed attempts', () => {
      // Set up existing attempts
      const existingAttempts = {
        'test@example.com': {
          count: 4,
          lastAttempt: Date.now(),
          locked: false,
          lockedUntil: 0,
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(existingAttempts));
      
      // Track failed login attempt
      const result = trackLoginAttempt('test@example.com', false);
      
      // Check that result is true (account locked)
      expect(result).toBe(true);
      
      // Check that localStorage.setItem was called
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      // Get the value from the call
      const value = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      
      // Check that the account is locked
      expect(value['test@example.com'].locked).toBe(true);
      expect(value['test@example.com'].lockedUntil).toBeGreaterThan(Date.now());
    });

    it('should return true when account is already locked', () => {
      // Set up locked account
      const lockedAccount = {
        'test@example.com': {
          count: 5,
          lastAttempt: Date.now(),
          locked: true,
          lockedUntil: Date.now() + 15 * 60 * 1000, // 15 minutes in the future
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(lockedAccount));
      
      // Track login attempt
      const result = trackLoginAttempt('test@example.com', false);
      
      // Check that result is true (account locked)
      expect(result).toBe(true);
    });

    it('should unlock account when lockout period has expired', () => {
      // Set up expired locked account
      const expiredLock = {
        'test@example.com': {
          count: 5,
          lastAttempt: Date.now(),
          locked: true,
          lockedUntil: Date.now() - 1000, // 1 second in the past
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(expiredLock));
      
      // Track login attempt
      const result = trackLoginAttempt('test@example.com', false);
      
      // Check that result is false (account not locked)
      expect(result).toBe(false);
      
      // Get the value from the call
      const value = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      
      // Check that the account is unlocked
      expect(value['test@example.com'].locked).toBe(false);
      expect(value['test@example.com'].count).toBe(1);
    });

    it('should return false when brute force protection is disabled', () => {
      // Configure security with brute force protection disabled
      configureSecurity({
        bruteForceProtection: false,
      });
      
      // Track failed login attempt
      const result = trackLoginAttempt('test@example.com', false);
      
      // Check that result is false (account not locked)
      expect(result).toBe(false);
      
      // Check that localStorage.setItem was not called
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should return false when security is disabled', () => {
      // Configure security with disabled
      configureSecurity({
        enabled: false,
      });
      
      // Track failed login attempt
      const result = trackLoginAttempt('test@example.com', false);
      
      // Check that result is false (account not locked)
      expect(result).toBe(false);
      
      // Check that localStorage.setItem was not called
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('isAccountLocked', () => {
    it('should return true when account is locked', () => {
      // Set up locked account
      const lockedAccount = {
        'test@example.com': {
          count: 5,
          lastAttempt: Date.now(),
          locked: true,
          lockedUntil: Date.now() + 15 * 60 * 1000, // 15 minutes in the future
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(lockedAccount));
      
      // Check if account is locked
      const result = isAccountLocked('test@example.com');
      
      // Check that result is true
      expect(result).toBe(true);
    });

    it('should return false when account is not locked', () => {
      // Set up unlocked account
      const unlockedAccount = {
        'test@example.com': {
          count: 2,
          lastAttempt: Date.now(),
          locked: false,
          lockedUntil: 0,
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(unlockedAccount));
      
      // Check if account is locked
      const result = isAccountLocked('test@example.com');
      
      // Check that result is false
      expect(result).toBe(false);
    });

    it('should return false when account is not found', () => {
      // Check if account is locked
      const result = isAccountLocked('unknown@example.com');
      
      // Check that result is false
      expect(result).toBe(false);
    });

    it('should unlock account when lockout period has expired', () => {
      // Set up expired locked account
      const expiredLock = {
        'test@example.com': {
          count: 5,
          lastAttempt: Date.now(),
          locked: true,
          lockedUntil: Date.now() - 1000, // 1 second in the past
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(expiredLock));
      
      // Check if account is locked
      const result = isAccountLocked('test@example.com');
      
      // Check that result is false
      expect(result).toBe(false);
      
      // Check that localStorage.setItem was called to update the account
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      // Get the value from the call
      const value = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      
      // Check that the account is unlocked
      expect(value['test@example.com'].locked).toBe(false);
      expect(value['test@example.com'].count).toBe(0);
    });

    it('should return false when brute force protection is disabled', () => {
      // Configure security with brute force protection disabled
      configureSecurity({
        bruteForceProtection: false,
      });
      
      // Set up locked account
      const lockedAccount = {
        'test@example.com': {
          count: 5,
          lastAttempt: Date.now(),
          locked: true,
          lockedUntil: Date.now() + 15 * 60 * 1000, // 15 minutes in the future
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(lockedAccount));
      
      // Check if account is locked
      const result = isAccountLocked('test@example.com');
      
      // Check that result is false
      expect(result).toBe(false);
    });

    it('should return false when security is disabled', () => {
      // Configure security with disabled
      configureSecurity({
        enabled: false,
      });
      
      // Set up locked account
      const lockedAccount = {
        'test@example.com': {
          count: 5,
          lastAttempt: Date.now(),
          locked: true,
          lockedUntil: Date.now() + 15 * 60 * 1000, // 15 minutes in the future
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(lockedAccount));
      
      // Check if account is locked
      const result = isAccountLocked('test@example.com');
      
      // Check that result is false
      expect(result).toBe(false);
    });
  });

  describe('getAccountUnlockTime', () => {
    it('should return time until unlock for locked account', () => {
      // Set up locked account
      const unlockTime = Date.now() + 15 * 60 * 1000; // 15 minutes in the future
      const lockedAccount = {
        'test@example.com': {
          count: 5,
          lastAttempt: Date.now(),
          locked: true,
          lockedUntil: unlockTime,
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(lockedAccount));
      
      // Get unlock time
      const result = getAccountUnlockTime('test@example.com');
      
      // Check that result is close to 15 minutes (allow for small timing differences)
      expect(result).toBeGreaterThan(14 * 60 * 1000);
      expect(result).toBeLessThanOrEqual(15 * 60 * 1000);
    });

    it('should return 0 for unlocked account', () => {
      // Set up unlocked account
      const unlockedAccount = {
        'test@example.com': {
          count: 2,
          lastAttempt: Date.now(),
          locked: false,
          lockedUntil: 0,
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(unlockedAccount));
      
      // Get unlock time
      const result = getAccountUnlockTime('test@example.com');
      
      // Check that result is 0
      expect(result).toBe(0);
    });

    it('should return 0 for account with expired lock', () => {
      // Set up expired locked account
      const expiredLock = {
        'test@example.com': {
          count: 5,
          lastAttempt: Date.now(),
          locked: true,
          lockedUntil: Date.now() - 1000, // 1 second in the past
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(expiredLock));
      
      // Get unlock time
      const result = getAccountUnlockTime('test@example.com');
      
      // Check that result is 0
      expect(result).toBe(0);
    });

    it('should return 0 for account not found', () => {
      // Get unlock time
      const result = getAccountUnlockTime('unknown@example.com');
      
      // Check that result is 0
      expect(result).toBe(0);
    });

    it('should return 0 when brute force protection is disabled', () => {
      // Configure security with brute force protection disabled
      configureSecurity({
        bruteForceProtection: false,
      });
      
      // Set up locked account
      const unlockTime = Date.now() + 15 * 60 * 1000; // 15 minutes in the future
      const lockedAccount = {
        'test@example.com': {
          count: 5,
          lastAttempt: Date.now(),
          locked: true,
          lockedUntil: unlockTime,
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(lockedAccount));
      
      // Get unlock time
      const result = getAccountUnlockTime('test@example.com');
      
      // Check that result is 0
      expect(result).toBe(0);
    });

    it('should return 0 when security is disabled', () => {
      // Configure security with disabled
      configureSecurity({
        enabled: false,
      });
      
      // Set up locked account
      const unlockTime = Date.now() + 15 * 60 * 1000; // 15 minutes in the future
      const lockedAccount = {
        'test@example.com': {
          count: 5,
          lastAttempt: Date.now(),
          locked: true,
          lockedUntil: unlockTime,
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(lockedAccount));
      
      // Get unlock time
      const result = getAccountUnlockTime('test@example.com');
      
      // Check that result is 0
      expect(result).toBe(0);
    });
  });

  describe('unlockAccount', () => {
    it('should unlock a locked account', () => {
      // Set up locked account
      const lockedAccount = {
        'test@example.com': {
          count: 5,
          lastAttempt: Date.now(),
          locked: true,
          lockedUntil: Date.now() + 15 * 60 * 1000, // 15 minutes in the future
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(lockedAccount));
      
      // Unlock account
      unlockAccount('test@example.com');
      
      // Check that localStorage.setItem was called
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      // Get the value from the call
      const value = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      
      // Check that the account is unlocked
      expect(value['test@example.com'].locked).toBe(false);
      expect(value['test@example.com'].count).toBe(0);
    });

    it('should do nothing for unlocked account', () => {
      // Set up unlocked account
      const unlockedAccount = {
        'test@example.com': {
          count: 2,
          lastAttempt: Date.now(),
          locked: false,
          lockedUntil: 0,
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(unlockedAccount));
      
      // Unlock account
      unlockAccount('test@example.com');
      
      // Check that localStorage.setItem was called
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      // Get the value from the call
      const value = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      
      // Check that the account is still unlocked
      expect(value['test@example.com'].locked).toBe(false);
      expect(value['test@example.com'].count).toBe(0);
    });

    it('should create entry for account not found', () => {
      // Unlock account
      unlockAccount('unknown@example.com');
      
      // Check that localStorage.setItem was called
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      // Get the value from the call
      const value = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      
      // Check that the account was created and is unlocked
      expect(value['unknown@example.com']).toBeDefined();
      expect(value['unknown@example.com'].locked).toBe(false);
      expect(value['unknown@example.com'].count).toBe(0);
    });

    it('should do nothing when brute force protection is disabled', () => {
      // Configure security with brute force protection disabled
      configureSecurity({
        bruteForceProtection: false,
      });
      
      // Set up locked account
      const lockedAccount = {
        'test@example.com': {
          count: 5,
          lastAttempt: Date.now(),
          locked: true,
          lockedUntil: Date.now() + 15 * 60 * 1000, // 15 minutes in the future
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(lockedAccount));
      
      // Unlock account
      unlockAccount('test@example.com');
      
      // Check that localStorage.setItem was not called
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should do nothing when security is disabled', () => {
      // Configure security with disabled
      configureSecurity({
        enabled: false,
      });
      
      // Set up locked account
      const lockedAccount = {
        'test@example.com': {
          count: 5,
          lastAttempt: Date.now(),
          locked: true,
          lockedUntil: Date.now() + 15 * 60 * 1000, // 15 minutes in the future
        },
      };
      localStorageMock.setItem('auth_login_attempts', JSON.stringify(lockedAccount));
      
      // Unlock account
      unlockAccount('test@example.com');
      
      // Check that localStorage.setItem was not called
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('configureSecurity', () => {
    it('should update configuration', () => {
      // Configure security
      configureSecurity({
        enabled: true,
        tokenValidation: false,
        fingerprintValidation: true,
        bruteForceProtection: false,
        maxLoginAttempts: 3,
        lockoutDuration: 30,
      });
      
      // Get configuration
      const config = getSecurityConfig();
      
      // Check that configuration was updated
      expect(config.enabled).toBe(true);
      expect(config.tokenValidation).toBe(false);
      expect(config.fingerprintValidation).toBe(true);
      expect(config.bruteForceProtection).toBe(false);
      expect(config.maxLoginAttempts).toBe(3);
      expect(config.lockoutDuration).toBe(30);
    });

    it('should merge with existing configuration', () => {
      // Configure security with partial configuration
      configureSecurity({
        tokenValidation: false,
        maxLoginAttempts: 3,
      });
      
      // Get configuration
      const config = getSecurityConfig();
      
      // Check that configuration was merged
      expect(config.enabled).toBe(true); // Default value
      expect(config.tokenValidation).toBe(false); // Updated value
      expect(config.fingerprintValidation).toBe(true); // Default value
      expect(config.bruteForceProtection).toBe(true); // Default value
      expect(config.maxLoginAttempts).toBe(3); // Updated value
      expect(config.lockoutDuration).toBe(15); // Default value
    });
  });

  describe('getSecurityConfig', () => {
    it('should return a copy of the configuration', () => {
      // Get configuration
      const config1 = getSecurityConfig();
      
      // Modify the configuration
      config1.enabled = false;
      
      // Get configuration again
      const config2 = getSecurityConfig();
      
      // Check that the second configuration is not affected by the modification
      expect(config2.enabled).toBe(true);
    });
  });
});

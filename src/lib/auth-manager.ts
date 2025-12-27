/**
 * Authentication Manager for Bill Buddy App
 *
 * Provides secure authentication with rate limiting, session management,
 * and automatic encrypted storage initialization.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
  type AuthError
} from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

// Initialize Firebase app if not already initialized
const firebaseConfig = {
  // This will be loaded from environment variables in production
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:demo"
};

const app = initializeApp(firebaseConfig);
import { authRateLimiter } from './rate-limiter';
import { EncryptedStorage } from './encrypted-storage';
import { StorageMigration } from './storage-migration';
import { sanitizeEmail, sanitizeCustomerName } from './security';

const auth = getAuth(app);

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface RegisterResult extends AuthResult {
  message?: string;
}

/**
 * Get current authenticated user
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return auth.currentUser !== null;
};

/**
 * Authenticate user with email and password
 * Includes rate limiting and automatic encrypted storage setup
 */
export const authenticate = async (email: string, password: string): Promise<AuthResult> => {
  // Check rate limit before attempting authentication
  const rateLimit = authRateLimiter.checkLimit();

  if (!rateLimit.allowed) {
    const minutes = Math.ceil((rateLimit.resetTime - Date.now()) / (60 * 1000));
    return {
      success: false,
      error: `Too many login attempts. Please try again in ${minutes} minutes.`
    };
  }

  // Sanitize email input
  const sanitizedEmail = sanitizeEmail(email);
  if (!sanitizedEmail) {
    authRateLimiter.recordRequest(); // Count invalid attempts
    return {
      success: false,
      error: 'Please enter a valid email address.'
    };
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, sanitizedEmail, password);

    // Record successful authentication
    authRateLimiter.recordRequest();

    // Initialize encrypted storage for the user
    await EncryptedStorage.initialize(userCredential.user.uid);

    // Run migration if needed
    if (StorageMigration.isMigrationNeeded()) {
      await StorageMigration.migrateToEncryptedStorage(userCredential.user.uid);
      StorageMigration.markMigrationComplete();
    }

    return {
      success: true,
      user: userCredential.user
    };

  } catch (error: any) {
    // Record failed attempt
    authRateLimiter.recordRequest();

    // Handle specific Firebase auth errors
    const authError = error as AuthError;
    let errorMessage = 'Login failed. Please try again.';

    switch (authError.code) {
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email address.';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Incorrect password.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address.';
        break;
      case 'auth/user-disabled':
        errorMessage = 'This account has been disabled.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many failed attempts. Please try again later.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Register new user with email, password, and optional name
 * Includes rate limiting and input validation
 */
export const register = async (
  email: string,
  password: string,
  displayName?: string
): Promise<RegisterResult> => {
  // Check rate limit before attempting registration
  const rateLimit = authRateLimiter.checkLimit();

  if (!rateLimit.allowed) {
    const minutes = Math.ceil((rateLimit.resetTime - Date.now()) / (60 * 1000));
    return {
      success: false,
      error: `Too many registration attempts. Please try again in ${minutes} minutes.`
    };
  }

  // Sanitize inputs
  const sanitizedEmail = sanitizeEmail(email);
  if (!sanitizedEmail) {
    authRateLimiter.recordRequest();
    return {
      success: false,
      error: 'Please enter a valid email address.'
    };
  }

  let sanitizedName: string | undefined;
  if (displayName) {
    sanitizedName = sanitizeCustomerName(displayName);
    if (!sanitizedName) {
      authRateLimiter.recordRequest();
      return {
        success: false,
        error: 'Please enter a valid name.'
      };
    }
  }

  // Basic password validation
  if (!password || password.length < 6) {
    authRateLimiter.recordRequest();
    return {
      success: false,
      error: 'Password must be at least 6 characters long.'
    };
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, sanitizedEmail, password);

    // Update profile if name provided
    if (sanitizedName) {
      await updateProfile(userCredential.user, {
        displayName: sanitizedName
      });
    }

    // Record successful registration
    authRateLimiter.recordRequest();

    // Initialize encrypted storage for the new user
    await EncryptedStorage.initialize(userCredential.user.uid);

    return {
      success: true,
      user: userCredential.user,
      message: 'Account created successfully! You can now log in.'
    };

  } catch (error: any) {
    // Record failed attempt
    authRateLimiter.recordRequest();

    const authError = error as AuthError;
    let errorMessage = 'Registration failed. Please try again.';

    switch (authError.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'An account with this email already exists.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address.';
        break;
      case 'auth/weak-password':
        errorMessage = 'Password is too weak. Please choose a stronger password.';
        break;
      case 'auth/operation-not-allowed':
        errorMessage = 'Registration is currently disabled.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Sign out current user and clean up session data
 */
export const logout = async (): Promise<AuthResult> => {
  try {
    // Sign out from Firebase
    await fbSignOut(auth);

    // Clear encrypted storage
    EncryptedStorage.clear();

    // Reset encryption state
    EncryptedStorage.reset();

    // Reset migration status
    StorageMigration.resetMigrationStatus();

    return {
      success: true
    };

  } catch (error: any) {
    console.error('Logout error:', error);
    return {
      success: false,
      error: 'Logout failed. Please try again.'
    };
  }
};

/**
 * Initialize authentication state listener
 * Call this once when the app starts
 */
export const initializeAuth = (onAuthChange?: (user: User | null) => void) => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Initialize encrypted storage when user signs in
        await EncryptedStorage.initialize(user.uid);

        // Run migration if needed
        if (StorageMigration.isMigrationNeeded()) {
          await StorageMigration.migrateToEncryptedStorage(user.uid);
          StorageMigration.markMigrationComplete();
        }
      } catch (error) {
        console.error('Failed to initialize encrypted storage:', error);
      }
    } else {
      // User signed out - clean up
      EncryptedStorage.reset();
    }

    // Call optional callback
    if (onAuthChange) {
      onAuthChange(user);
    }
  });
};

/**
 * Send password reset email
 */
export const sendPasswordReset = async (email: string): Promise<AuthResult> => {
  // Check rate limit
  const rateLimit = authRateLimiter.checkLimit();

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: 'Too many requests. Please try again later.'
    };
  }

  const sanitizedEmail = sanitizeEmail(email);
  if (!sanitizedEmail) {
    authRateLimiter.recordRequest();
    return {
      success: false,
      error: 'Please enter a valid email address.'
    };
  }

  try {
    const { sendPasswordResetEmail } = await import('firebase/auth');
    await sendPasswordResetEmail(auth, sanitizedEmail);

    authRateLimiter.recordRequest();

    return {
      success: true,
      message: 'Password reset email sent. Please check your inbox.'
    } as any;

  } catch (error: any) {
    authRateLimiter.recordRequest();

    const authError = error as AuthError;
    let errorMessage = 'Failed to send password reset email.';

    switch (authError.code) {
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email address.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many requests. Please try again later.';
        break;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (updates: {
  displayName?: string;
  photoURL?: string;
}): Promise<AuthResult> => {
  const user = getCurrentUser();

  if (!user) {
    return {
      success: false,
      error: 'No user logged in.'
    };
  }

  try {
    // Sanitize display name if provided
    if (updates.displayName) {
      updates.displayName = sanitizeCustomerName(updates.displayName);
      if (!updates.displayName) {
        return {
          success: false,
          error: 'Invalid display name.'
        };
      }
    }

    await updateProfile(user, updates);

    return {
      success: true,
      user: { ...user, ...updates } as User
    };

  } catch (error: any) {
    console.error('Profile update error:', error);
    return {
      success: false,
      error: 'Failed to update profile. Please try again.'
    };
  }
};

/**
 * Get authentication status summary
 */
export const getAuthStatus = () => {
  const user = getCurrentUser();
  const isAuth = isAuthenticated();
  const rateLimitStatus = authRateLimiter.getStatus();

  return {
    isAuthenticated: isAuth,
    user: user ? {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified
    } : null,
    rateLimit: {
      requests: rateLimitStatus.requests,
      maxRequests: rateLimitStatus.maxRequests,
      isBlocked: rateLimitStatus.isBlocked,
      blockedUntil: rateLimitStatus.blockedUntil
    },
    encryptedStorageReady: EncryptedStorage.isInitialized()
  };
};

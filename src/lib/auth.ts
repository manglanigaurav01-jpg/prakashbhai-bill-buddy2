import { getAuth, signInWithPopup, signInWithCredential, GoogleAuthProvider, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { FIREBASE_CONFIG } from './firebase.config';
import { Capacitor } from '@capacitor/core';

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);

export const signInWithGoogle = async () => {
  try {
    // Use Firebase's built-in Google authentication for both web and mobile
    const provider = new GoogleAuthProvider();

    // Configure provider for better compatibility
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    // Add timeout to prevent infinite loading
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Sign-in timeout. Please try again.')), 60000); // 60 second timeout
    });

    const signInPromise = signInWithPopup(auth, provider);

    // Race between sign-in and timeout
    const result = await Promise.race([signInPromise, timeoutPromise]) as any;

    if (result?.user) {
      return { success: true, user: result.user };
    } else {
      throw new Error('No user data received from sign-in');
    }
  } catch (error: any) {
    console.error('Google sign-in error:', error);

    // Handle specific error cases
    if (error.code === 'auth/popup-closed-by-user' || error.message?.includes('popup')) {
      return { success: false, error: 'Sign-in cancelled. Please try again.' };
    }

    if (error.code === 'auth/popup-blocked') {
      return { success: false, error: 'Popup was blocked. Please allow popups and try again.' };
    }

    if (error.message?.includes('timeout')) {
      return { success: false, error: 'Sign-in timed out. Please try again.' };
    }

    return {
      success: false,
      error: error.message || error.code || 'Sign in failed. Please try again.'
    };
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Sign out failed' };
  }
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

export const onAuthStateChanged = (callback: (user: any) => void) => {
  return auth.onAuthStateChanged(callback);
};
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, getRedirectResult, signOut as fbSignOut, type Auth, type User } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  googleProvider: GoogleAuthProvider;
}

let services: FirebaseServices | null = null;

export const initFirebase = (): FirebaseServices | null => {
  if (services) return services;

  // Validate required environment variables
  const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];

  const missingVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required Firebase environment variables: ${missingVars.join(', ')}`);
  }

  // Use environment variables for Firebase config
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };

  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const googleProvider = new GoogleAuthProvider();
  
  // Configure Google provider for better compatibility
  googleProvider.addScope('email');
  googleProvider.addScope('profile');
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
  
  services = { app, auth, db, googleProvider };
  return services;
};

export const firebaseSignInWithGoogle = async (): Promise<User> => {
  const services = initFirebase();
  if (!services) throw new Error('FIREBASE_NOT_CONFIGURED');
  
  try {
    // Always use signInWithPopup for both web and mobile
    services.googleProvider.setCustomParameters({
      prompt: 'select_account',
      // Force to use browser signin to avoid storage partition issues
      mobile_browser: 'true',
      // Prevent redirect flow which can cause session issues
      redirect_uri: window.location.origin
    });

    // Clear any existing auth state
    await fbSignOut(services.auth);
    
    // Add timeout to prevent infinite loading
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Sign-in timeout. Please try again.')), 60000); // 60 second timeout
    });
    
    // Use popup signin for all platforms
    const signInPromise = signInWithPopup(services.auth, services.googleProvider);
    
    // Race between sign-in and timeout
    const result = await Promise.race([signInPromise, timeoutPromise]) as any;
    
    if (!result?.user) {
      throw new Error('No user data received from Google');
    }

    // Store auth state in localStorage for persistence
    localStorage.setItem('auth_user', JSON.stringify({
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      timestamp: Date.now()
    }));

    return result.user;

  } catch (error: any) {
    console.error('Google sign-in error:', error);
    
    // Clear any problematic auth state
    localStorage.removeItem('auth_user');
    await fbSignOut(services.auth);

    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled');
    }
    
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked. Please allow popups and try again.');
    }
    
    if (error.message?.includes('timeout')) {
      throw new Error('Sign-in timed out. Please try again.');
    }
    
    throw new Error(error.message || 'Sign-in failed. Please try again.');
  }
};

export const firebaseSignOut = async () => {
  const services = initFirebase();
  if (!services) return;
  await fbSignOut(services.auth);
};

export const firebaseHandleRedirectResult = async (): Promise<User | null> => {
  const svc = initFirebase();
  if (!svc) return null;
  const res = await getRedirectResult(svc.auth).catch(() => null);
  return res?.user || null;
};

export const getUserSnapshotDocRef = (uid: string) => {
  const svc = initFirebase();
  if (!svc) throw new Error('FIREBASE_NOT_CONFIGURED');
  return doc(svc.db, 'users', uid, 'sync', 'snapshot');
};

export const readUserSnapshot = async (uid: string): Promise<any | null> => {
  const ref = getUserSnapshotDocRef(uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

export const writeUserSnapshot = async (uid: string, data: any): Promise<void> => {
  const ref = getUserSnapshotDocRef(uid);
  await setDoc(ref, data, { merge: true });
};



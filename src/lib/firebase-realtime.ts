import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { getBills, getPayments, getCustomers, getItems } from '@/lib/storage';

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

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let unsubscribeSnapshot: (() => void) | null = null;

// Fetch initial data from Firestore
const fetchInitialData = async (userId: string) => {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      localStorage.setItem('prakash_bills', JSON.stringify(data.bills || []));
      localStorage.setItem('prakash_customers', JSON.stringify(data.customers || []));
      localStorage.setItem('prakash_payments', JSON.stringify(data.payments || []));
      localStorage.setItem('prakash_items', JSON.stringify(data.items || []));
      localStorage.setItem('lastSyncTime', data.lastUpdate?.toString() || Date.now().toString());
      
      // Trigger UI refresh
      window.dispatchEvent(new Event('storage'));
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error fetching initial data:', error);
    return false;
  }
};

// Manual sync to cloud
export const syncToCloud = async (userId: string) => {
  try {
    const currentTime = Date.now();
    const data = {
      bills: getBills(),
      customers: getCustomers(),
      payments: getPayments(),
      items: getItems(),
      lastUpdate: currentTime
    };
    
    await setDoc(doc(db, 'users', userId), data);
    localStorage.setItem('lastSyncTime', currentTime.toString());
    return { success: true, message: 'Data synced to cloud successfully' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Manual sync from cloud
export const syncFromCloud = async (userId: string) => {
  try {
    const success = await fetchInitialData(userId);
    return { 
      success, 
      message: success ? 'Data synced from cloud successfully' : 'No data found in cloud'
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Auto-sync function
const setupRealtimeSync = (userId: string) => {
  // Unsubscribe from previous listener if exists
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
  }

  // First fetch initial data
  fetchInitialData(userId).then((success) => {
    if (!success) {
      // If no data exists, push current local data
      syncToCloud(userId);
    }
  });

  // Listen for remote changes
  unsubscribeSnapshot = onSnapshot(doc(db, 'users', userId), (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      const lastUpdateTime = data.lastUpdate || 0;
      const localLastUpdate = localStorage.getItem('lastSyncTime') || '0';

      // Only update if remote data is newer
      if (lastUpdateTime > parseInt(localLastUpdate)) {
        localStorage.setItem('prakash_bills', JSON.stringify(data.bills || []));
        localStorage.setItem('prakash_customers', JSON.stringify(data.customers || []));
        localStorage.setItem('prakash_payments', JSON.stringify(data.payments || []));
        localStorage.setItem('prakash_items', JSON.stringify(data.items || []));
        localStorage.setItem('lastSyncTime', lastUpdateTime.toString());
        
        // Trigger UI refresh
        window.dispatchEvent(new Event('storage'));
      }
    }
  });

  // Setup local storage change listener
  const handleStorageChange = async () => {
    const currentTime = Date.now();
    const data = {
      bills: getBills(),
      customers: getCustomers(),
      payments: getPayments(),
      items: getItems(),
      lastUpdate: currentTime
    };
    
    try {
      await setDoc(doc(db, 'users', userId), data);
      localStorage.setItem('lastSyncTime', currentTime.toString());
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  // Listen for local changes
  window.addEventListener('storage', handleStorageChange);

  // Return cleanup function
  return () => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
    window.removeEventListener('storage', handleStorageChange);
  };
};

// Auth functions
export const signUp = async (email: string, password: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    setupRealtimeSync(result.user.uid);
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    setupRealtimeSync(result.user.uid);
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Initialize auth state listener
export const initializeAuth = () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      setupRealtimeSync(user.uid);
    }
  });
};
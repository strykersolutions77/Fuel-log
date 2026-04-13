import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, addDoc, query, where, onSnapshot, orderBy, getDocFromServer, deleteDoc, getDocs, limit } from 'firebase/firestore';
import { UserProfile, FoodLog, WaterLog } from './types';
import localConfig from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || localConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || localConfig.appId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localConfig.messagingSenderId,
};

const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || localConfig.firestoreDatabaseId || '(default)';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

export async function signIn() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error: any) {
    console.error("Detailed Sign-In Error:", error.code, error.message);
    if (error.code === 'auth/unauthorized-domain') {
      alert("This domain is not authorized in Firebase. Please add " + window.location.hostname + " to your Firebase Authorized Domains.");
    } else if (error.code === 'auth/operation-not-allowed') {
      alert("Google Sign-In is not enabled in your Firebase Console.");
    } else {
      alert("Sign-in failed: " + error.message);
    }
    throw error;
  }
}

export async function signOut() {
  return auth.signOut();
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function getUserProfile(uid: string, retries = 3): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  for (let i = 0; i < retries; i++) {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }
      return null;
    } catch (error) {
      if (i === retries - 1) {
        handleFirestoreError(error, OperationType.GET, path);
        return null;
      }
      console.warn(`Retry ${i + 1} for getUserProfile...`);
      await sleep(500 * (i + 1));
    }
  }
  return null;
}

export function subscribeToUserProfile(uid: string, callback: (profile: UserProfile | null) => void) {
  const path = `users/${uid}`;
  const docRef = doc(db, 'users', uid);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as UserProfile);
    } else {
      callback(null);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export async function createUserProfile(user: User, retries = 3): Promise<UserProfile> {
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || 'User',
    isSetupComplete: false,
    goals: {
      calories: 2000,
      protein: 150,
      carbs: 200,
      fats: 65,
      water: 128,
    },
    weightHistory: [],
  };
  const path = `users/${user.uid}`;
  for (let i = 0; i < retries; i++) {
    try {
      await setDoc(doc(db, 'users', user.uid), profile);
      return profile;
    } catch (error) {
      if (i === retries - 1) {
        handleFirestoreError(error, OperationType.WRITE, path);
        return profile;
      }
      console.warn(`Retry ${i + 1} for createUserProfile...`);
      await sleep(500 * (i + 1));
    }
  }
  return profile;
}

export async function updateGoals(userId: string, goals: UserProfile['goals']) {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const profile = docSnap.data() as UserProfile;
      await setDoc(docRef, { ...profile, goals });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>) {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const profile = docSnap.data() as UserProfile;
      await setDoc(docRef, { ...profile, ...updates });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function logWeight(userId: string, weight: number) {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const profile = docSnap.data() as UserProfile;
      const newHistory = [
        ...profile.weightHistory,
        { date: new Date().toISOString().split('T')[0], weight }
      ].slice(-30); // Keep last 30 entries
      await setDoc(docRef, { ...profile, weightHistory: newHistory });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function logFood(userId: string, food: Omit<FoodLog, 'id' | 'userId' | 'timestamp'>) {
  // Clean the food object of any null/undefined values to avoid rule violations
  const cleanFood = Object.fromEntries(
    Object.entries(food).filter(([_, v]) => v != null)
  );

  const log: Omit<FoodLog, 'id'> = {
    ...cleanFood,
    userId,
    timestamp: Date.now(),
  } as any;
  
  const path = 'foodLogs';
  try {
    const docRef = await addDoc(collection(db, 'foodLogs'), log);
    return docRef;
  } catch (error) {
    console.error('Error logging food:', error);
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteFoodLog(logId: string) {
  const path = `foodLogs/${logId}`;
  try {
    await deleteDoc(doc(db, 'foodLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToDailyLogs(userId: string, callback: (logs: FoodLog[]) => void, onError?: (error: any) => void) {
  const now = new Date();
  const startOfPeriod = new Date();
  startOfPeriod.setHours(1, 0, 0, 0); // 1 AM today
  
  if (now < startOfPeriod) {
    // It's before 1 AM, so the "day" started at 1 AM yesterday
    startOfPeriod.setDate(startOfPeriod.getDate() - 1);
  }
  
  const path = 'foodLogs';
  const q = query(
    collection(db, 'foodLogs'),
    where('userId', '==', userId),
    where('timestamp', '>=', startOfPeriod.getTime()),
    orderBy('timestamp', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodLog));
    callback(logs);
  }, (error) => {
    if (onError) {
      onError(error);
    } else {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  });
}

export async function logWater(userId: string, amount: number) {
  const log: Omit<WaterLog, 'id'> = {
    userId,
    amount,
    timestamp: Date.now(),
  };
  const path = 'waterLogs';
  try {
    return await addDoc(collection(db, 'waterLogs'), log);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToDailyWater(userId: string, callback: (logs: WaterLog[]) => void, onError?: (error: any) => void) {
  const now = new Date();
  const startOfPeriod = new Date();
  startOfPeriod.setHours(1, 0, 0, 0); // 1 AM today
  
  if (now < startOfPeriod) {
    // It's before 1 AM, so the "day" started at 1 AM yesterday
    startOfPeriod.setDate(startOfPeriod.getDate() - 1);
  }
  
  const path = 'waterLogs';
  const q = query(
    collection(db, 'waterLogs'),
    where('userId', '==', userId),
    where('timestamp', '>=', startOfPeriod.getTime()),
    orderBy('timestamp', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WaterLog));
    callback(logs);
  }, (error) => {
    if (onError) {
      onError(error);
    } else {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  });
}

export async function getRecentFoodLogs(userId: string, limitCount: number = 20) {
  const q = query(
    collection(db, 'foodLogs'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );

  try {
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodLog));
    
    // Filter for unique items by name to avoid duplicates in the "Recent" list
    const uniqueLogs: FoodLog[] = [];
    const seenNames = new Set<string>();
    
    for (const log of logs) {
      if (!seenNames.has(log.name.toLowerCase())) {
        uniqueLogs.push(log);
        seenNames.add(log.name.toLowerCase());
      }
    }
    
    return uniqueLogs;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'foodLogs');
    return [];
  }
}

export async function getHistoricalLogs(userId: string, days: number = 7) {
  const now = new Date();
  const startOfPeriod = new Date();
  startOfPeriod.setHours(1, 0, 0, 0);
  if (now < startOfPeriod) {
    startOfPeriod.setDate(startOfPeriod.getDate() - 1);
  }
  const historyStart = new Date(startOfPeriod);
  historyStart.setDate(historyStart.getDate() - (days - 1));

  const foodQuery = query(
    collection(db, 'foodLogs'),
    where('userId', '==', userId),
    where('timestamp', '>=', historyStart.getTime()),
    orderBy('timestamp', 'asc')
  );

  const waterQuery = query(
    collection(db, 'waterLogs'),
    where('userId', '==', userId),
    where('timestamp', '>=', historyStart.getTime()),
    orderBy('timestamp', 'asc')
  );

  try {
    const [foodSnap, waterSnap] = await Promise.all([
      getDocs(foodQuery),
      getDocs(waterQuery)
    ]);

    const foodLogs = foodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodLog));
    const waterLogs = waterSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WaterLog));

    return { foodLogs, waterLogs };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'historicalLogs');
    return { foodLogs: [], waterLogs: [] };
  }
}

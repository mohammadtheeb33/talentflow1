import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

function getAdminConfig() {
  let serviceAccount;
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    }
  } catch (error) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", error);
  }

  const config: any = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  };

  if (serviceAccount) {
    config.credential = cert(serviceAccount);
  }

  return config;
}

export function getAdminApp() {
  if (getApps().length === 0) {
    const config = getAdminConfig();
    return initializeApp(config);
  }
  return getApps()[0];
}

export function getAdminDb() {
  const app = getAdminApp();
  return getFirestore(app);
}

export function getAdminStorage() {
  const app = getAdminApp();
  return getStorage(app);
}

export function getAdminAuth() {
  const app = getAdminApp();
  return getAuth(app);
}

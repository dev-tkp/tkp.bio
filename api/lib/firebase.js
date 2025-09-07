import admin from 'firebase-admin';

// This check prevents re-initializing the app in a serverless environment
if (!admin.apps.length) {
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.');
    }
    if (!process.env.FIREBASE_STORAGE_BUCKET) {
      throw new Error('FIREBASE_STORAGE_BUCKET environment variable is not set.');
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    console.log('Firebase Admin SDK initialized.');
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error.stack);
    // Initialization failed, prevent further execution
    throw new Error('Could not initialize Firebase Admin SDK.');
  }
}

export const db = admin.firestore();
export const storage = admin.storage().bucket();
export const FieldValue = admin.firestore.FieldValue;
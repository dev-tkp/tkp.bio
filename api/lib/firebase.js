import admin from 'firebase-admin';

// This check prevents re-initializing the app in a serverless environment
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialized.');
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error.stack);
  }
}

export const db = admin.firestore();
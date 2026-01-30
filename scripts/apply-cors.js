const admin = require("firebase-admin");
const { getStorage } = require("firebase-admin/storage");
require('dotenv').config({ path: '.env.local' });

// Initialize Admin SDK
// 1. Try Service Account from Env
// 2. Try Application Default Credentials (ADC)
try {
  let config = {
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  };

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    config.credential = admin.credential.cert(serviceAccount);
  }

  admin.initializeApp(config);
  console.log("Admin SDK initialized.");
} catch (e) {
  console.error("Failed to initialize admin:", e);
  process.exit(1);
}

async function setCors() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
      console.error("Error: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set in .env.local");
      return;
  }

  console.log(`Configuring CORS for bucket: ${bucketName}...`);
  const bucket = getStorage().bucket(bucketName);
  
  const cors = [
    {
      "origin": ["http://localhost:3000", "http://127.0.0.1:3000"],
      "method": ["GET", "PUT", "POST", "DELETE", "HEAD", "OPTIONS"],
      "responseHeader": ["Content-Type", "Authorization", "Content-Length", "User-Agent", "x-goog-resumable"],
      "maxAgeSeconds": 3600
    }
  ];

  try {
    await bucket.setCorsConfiguration(cors);
    console.log("✅ CORS configuration applied successfully!");
    console.log("You should now be able to upload files from localhost.");
  } catch (error) {
    console.error("❌ Error setting CORS:", error.message);
    console.log("\nIf this failed, you likely need to authenticate or use gsutil:");
    console.log(`gsutil cors set cors.json gs://${bucketName}`);
  }
}

setCors();

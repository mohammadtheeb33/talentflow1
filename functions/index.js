const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const next = require('next');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local if present
const envPath = path.resolve(__dirname, '.env.local');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn("Failed to load .env.local from " + envPath, result.error);
} else {
  console.log("Loaded .env.local from " + envPath);
}

const dev = process.env.NODE_ENV !== 'production';
const app = next({ 
  dev, 
  conf: { 
    distDir: '.next' 
  } 
});

const handle = app.getRequestHandler();

admin.initializeApp();

// Use Gen 1 function explicitly with specific Service Account
// We use the same service account as the deployer to ensure we have ActAs permission
exports.nextServer = functions.runWith({
  minInstances: 0,
  serviceAccount: 'firebase-adminsdk-fbsvc@cvchek-6b250.iam.gserviceaccount.com'
}).https.onRequest((req, res) => {
  return app.prepare().then(() => handle(req, res));
});

exports.sendInviteEmail = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await admin.auth().verifyIdToken(token);

    const body = req.body || {};
    const to = body.to;
    const subject = body.subject;
    const html = body.html;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const config = functions.config().smtp || {};
    const host = process.env.SMTP_HOST || config.host;
    const port = Number(process.env.SMTP_PORT || config.port || 587);
    const user = process.env.SMTP_USER || config.user;
    const pass = process.env.SMTP_PASS || config.pass;
    const from = process.env.SMTP_FROM || config.from || user;
    const secure = String(process.env.SMTP_SECURE || config.secure || '').toLowerCase() === 'true' || port === 465;

    if (!host || !user || !pass || !from) {
      return res.status(500).json({ error: 'SMTP not configured' });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });

    await transporter.sendMail({
      from,
      to,
      subject,
      html
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to send email' });
  }
});

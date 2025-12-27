const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// Get credentials from config or environment
const CLIENT_ID = functions.config().outlook?.client_id || process.env.OUTLOOK_CLIENT_ID || "YOUR_CLIENT_ID";
const CLIENT_SECRET = functions.config().outlook?.client_secret || process.env.OUTLOOK_CLIENT_SECRET || "YOUR_CLIENT_SECRET";
const REDIRECT_URI = functions.config().outlook?.redirect_uri || process.env.OUTLOOK_REDIRECT_URI || "https://us-central1-cvchk-1a7e0.cloudfunctions.net/outlookOAuth";

exports.outlookOAuth = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { action, code, state, error } = req.query;

      // 1. Start OAuth Flow
      if (action === "start") {
        const { uid, scopes, tenant } = req.query;
        if (!uid) {
          return res.status(400).json({ error: "Missing uid" });
        }

        const effectiveTenant = tenant || "common";
        const effectiveScopes = scopes || "openid profile email offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send";
        
        // Encode uid in state to retrieve it on callback
        const stateParam = Buffer.from(JSON.stringify({ uid })).toString("base64");

        const authUrl = `https://login.microsoftonline.com/${effectiveTenant}/oauth2/v2.0/authorize?` +
          new URLSearchParams({
            client_id: CLIENT_ID,
            response_type: "code",
            redirect_uri: REDIRECT_URI,
            response_mode: "query",
            scope: effectiveScopes,
            state: stateParam,
            prompt: "select_account",
          }).toString();

        return res.json({ authUrl });
      }

      // 2. Check Connection Status
      if (action === "status") {
        const { uid } = req.query;
        if (!uid) {
          return res.status(400).json({ error: "Missing uid" });
        }

        const tokenDoc = await db.collection("users").doc(uid).collection("tokens").doc("outlook").get();
        
        if (!tokenDoc.exists) {
          return res.json({ connected: false });
        }

        const data = tokenDoc.data();
        // Optionally verify token validity here or just return connected
        return res.json({
          connected: true,
          email: data.email,
          displayName: data.displayName
        });
      }

      // 3. Handle OAuth Callback
      if (code) {
        if (!state) {
          return res.status(400).send("Missing state parameter");
        }

        let decodedState;
        try {
          decodedState = JSON.parse(Buffer.from(state, "base64").toString());
        } catch (e) {
          return res.status(400).send("Invalid state parameter");
        }

        const { uid } = decodedState;
        if (!uid) {
          return res.status(400).send("No uid in state");
        }

        // Exchange code for tokens
        const params = new URLSearchParams();
        params.append("client_id", CLIENT_ID);
        params.append("client_secret", CLIENT_SECRET);
        params.append("code", code);
        params.append("redirect_uri", REDIRECT_URI);
        params.append("grant_type", "authorization_code");

        try {
          const tokenResp = await axios.post(
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            params
          );

          const { access_token, refresh_token, expires_in, scope } = tokenResp.data;

          // Fetch user profile to get email
          const profileResp = await axios.get("https://graph.microsoft.com/v1.0/me", {
            headers: { Authorization: `Bearer ${access_token}` },
          });

          const { mail, userPrincipalName, displayName } = profileResp.data;
          const email = mail || userPrincipalName;

          // Store in Firestore
          await db.collection("users").doc(uid).collection("tokens").doc("outlook").set({
            access_token,
            refresh_token,
            scope,
            email,
            displayName,
            expires_at: Date.now() + expires_in * 1000,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Close popup or redirect
          return res.send(`
            <html>
              <script>
                window.opener.postMessage({ type: 'outlook-connected' }, '*');
                window.close();
              </script>
              <body>
                <h1>Connected! You can close this window.</h1>
              </body>
            </html>
          `);
        } catch (err) {
          console.error("Token exchange error:", err.response?.data || err.message);
          return res.status(500).send("Failed to exchange token: " + (err.response?.data?.error_description || err.message));
        }
      }

      // Handle Errors
      if (error) {
        return res.status(400).send(`OAuth Error: ${error} - ${req.query.error_description}`);
      }

      return res.status(400).send("Invalid request");

    } catch (e) {
      console.error(e);
      return res.status(500).send("Internal Server Error");
    }
  });
});

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!apiKey) {
  console.error("No API Key found");
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode !== 200) {
        console.error(`Status Code: ${res.statusCode}`);
        console.error(`Response: ${data}`);
        return;
    }
    
    try {
      const json = JSON.parse(data);
      console.log("Available Models:");
      if (json.models) {
        json.models.forEach(m => {
           console.log(`- ${m.name} (Supported methods: ${m.supportedGenerationMethods})`);
        });
      } else {
        console.log("No models found in response:", json);
      }
    } catch (e) {
      console.error("Error parsing JSON:", e);
      console.log("Raw Data:", data);
    }
  });

}).on('error', (err) => {
  console.error("Error fetching models:", err.message);
});

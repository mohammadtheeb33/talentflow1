const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function listModels() {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API Key found in .env.local");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    // There isn't a direct listModels on genAI instance in the node SDK generally exposed easily in the helper, 
    // but we can try to use the model to generate content or check docs. 
    // Actually, the SDK has a ModelService. 
    // Let's try a simple generation with "gemini-1.5-flash" to confirm it works at least.
    // And try to list if possible. 
    // The Google Generative AI Node SDK doesn't always export a simple listModels function directly on the main class in older versions,
    // but let's try to see if we can just test the models we want.
    
    const modelsToTest = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-flash-latest",
    "gemini-1.5-flash", // Expect failure
    "gemini-1.5-pro"    // Expect failure
  ];

    console.log("Testing models...");

    for (const modelName of modelsToTest) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hi");
        const response = await result.response;
        console.log(`✅ ${modelName} is AVAILABLE. Response: ${response.text().slice(0, 20)}...`);
      } catch (error) {
        console.log(`❌ ${modelName} failed: ${error.message.split('\n')[0]}`);
      }
    }

  } catch (error) {
    console.error("Error:", error);
  }
}

listModels();

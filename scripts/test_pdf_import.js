
const fs = require('fs');
const path = require('path');

async function testPdfParse() {
    console.log("Testing pdf-parse import and parsing...");
    try {
        const pdfParse = (await import('pdf-parse')).default;
        
        const pdfPath = path.join(__dirname, '../node_modules/pdf-parse/test/data/05-versions-space.pdf');
        console.log("Reading PDF from:", pdfPath);
        
        if (!fs.existsSync(pdfPath)) {
            console.error("Test PDF file not found!");
            return;
        }
        
        const dataBuffer = fs.readFileSync(pdfPath);
        console.log("Buffer size:", dataBuffer.length);
        
        const data = await pdfParse(dataBuffer);
        console.log("Parsing successful!");
        console.log("Text length:", data.text.length);
        console.log("First 50 chars:", data.text.substring(0, 50));
        
    } catch (e) {
        console.error("❌ Test failed:", e);
    }
}

testPdfParse();

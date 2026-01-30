
const fs = require('fs');
const path = require('path');

async function test() {
    console.log("Testing pdfjs-dist...");
    try {
        // Dynamic import for ESM module
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        console.log("pdfjs imported");
        
        const pdfPath = path.join(__dirname, '../node_modules/pdf-parse/test/data/05-versions-space.pdf');
        const buffer = fs.readFileSync(pdfPath);
        const uint8Array = new Uint8Array(buffer);
        
        // In Node.js environment with legacy build, we might need to suppress worker warning or set it up
        // But let's try basic usage first
        
        const loadingTask = pdfjs.getDocument({
            data: uint8Array,
            verbosity: 0 // Suppress warnings
        });
        
        const doc = await loadingTask.promise;
        console.log("Doc loaded, pages:", doc.numPages);
        
        let fullText = '';
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            // content.items has objects with .str property
            const strings = content.items.map(item => item.str);
            fullText += strings.join(' ') + '\n';
        }
        
        console.log("Text extracted length:", fullText.length);
        console.log("Text preview:", fullText.substring(0, 50).trim());
        
    } catch (e) {
        console.error("Error:", e);
    }
}

test();

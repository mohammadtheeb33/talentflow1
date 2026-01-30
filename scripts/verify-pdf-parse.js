
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse/lib/pdf-parse.js');

async function test() {
    try {
        const filePath = path.join(__dirname, '../test/data/05-versions-space.pdf');
        console.log('Reading file:', filePath);
        const dataBuffer = fs.readFileSync(filePath);
        console.log('Buffer size:', dataBuffer.length);

        const data = await pdf(dataBuffer);
        console.log('Parsed text length:', data.text.length);
        console.log('First 100 chars:', data.text.substring(0, 100));
    } catch (e) {
        console.error('Error:', e);
    }
}

test();

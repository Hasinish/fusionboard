
import fs from 'fs';
const content = fs.readFileSync('c:/Users/Hasin/Desktop/fusionboard/frontend/src/components/canvas/BoardElement.jsx', 'utf8');
const lines = content.split('\n');
console.log('Line 15:', JSON.stringify(lines[14]));
console.log('Line 790:', JSON.stringify(lines[789]));

const fs = require('fs');
const file = 'c:/Users/Hasin/Desktop/fusionboard/frontend/src/components/ElementsLayer.jsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split(/\r?\n/);

const startIndex = lines.findIndex(l => l.includes('function uid() {'));
const endIndex = lines.findIndex(l => l.includes('const MemoizedBoardElement = React.memo(BoardElement);'));

if (startIndex !== -1 && endIndex !== -1) {
    if (startIndex < endIndex) {
        lines.splice(startIndex, endIndex - startIndex + 1, 'import BoardElement, { MemoizedBoardElement } from "./canvas/BoardElement";');
        fs.writeFileSync(file, lines.join('\n'));
        console.log(`Replaced lines ${startIndex + 1} to ${endIndex + 1}`);
    } else {
        console.log('Error: startIndex is after endIndex');
    }
} else {
    console.log('Could not find start or end index:', startIndex, endIndex);
}

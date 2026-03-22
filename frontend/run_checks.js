const fs = require('fs');
const path = require('path');

function checkFile(filePath, label) {
    console.log(`\n=== CHECKING ${label} ===`);
    const content = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
    const lines = content.split('\n');

    let socketEmits = 0;
    let yElementsWrites = 0;
    let hasAudit = false;

    lines.forEach((l, i) => {
        if (l.includes('socket') && l.includes('emit') && 
            (l.includes('addElement') || l.includes('updateElement') || 
             l.includes('updateElements') || l.includes('deleteElement'))) {
            socketEmits++;
            console.log(`Socket emit at line ${i+1}: ${l.trim()}`);
        }
        if (l.includes('yElements?.set') || l.includes('yElements?.delete') || l.includes('yElements.doc.transact')) {
            yElementsWrites++;
            console.log(`yElements write at line ${i+1}: ${l.trim()}`);
        }
        if (l.includes('DUAL-WRITE AUDIT')) {
            hasAudit = true;
        }
    });

    console.log(`\nSocket emits: ${socketEmits}`);
    console.log(`yElements writes: ${yElementsWrites}`);
    console.log(`Audit comment present: ${hasAudit ? 'YES' : 'NO'}`);
}

function checkElementsLayer() {
    console.log(`\n=== CHECKING ElementsLayer.jsx ===`);
    const content = fs.readFileSync(path.join(__dirname, 'src/components/ElementsLayer.jsx'), 'utf8');
    const lines = content.split('\n');
    let yElementsCount = 0;
    lines.forEach((l, i) => {
        if (l.includes('yElements')) {
            yElementsCount++;
            console.log(`yElements at line ${i+1}: ${l.trim()}`);
        }
    });
    console.log(`Total yElements occurrences: ${yElementsCount}`);
}

function checkGroupTransform() {
    console.log(`\n=== CHECKING useGroupTransform.js ===`);
    const content = fs.readFileSync(path.join(__dirname, 'src/components/canvas/useGroupTransform.js'), 'utf8');
    const lines = content.split('\n');
    let yElementsCount = 0;
    let transactCount = 0;
    lines.forEach((l, i) => {
        if (l.includes('yElements')) {
             yElementsCount++;
             console.log(`yElements at line ${i+1}: ${l.trim()}`);
        }
        if (l.includes('transact')) {
             transactCount++;
        }
    });
    console.log(`Total yElements occurrences: ${yElementsCount}`);
    console.log(`Total transact occurrences: ${transactCount}`);
}

checkFile('src/hooks/useCanvasInteraction.js', 'useCanvasInteraction.js (Checks 13-16)');
checkFile('src/hooks/useCanvasHistory.js', 'useCanvasHistory.js (Checks 17-20)');
checkElementsLayer(); // Checks 21
checkGroupTransform(); // Checks 22

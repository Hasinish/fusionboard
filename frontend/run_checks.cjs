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

function checkExclusions() {
    console.log(`\n=== CHECKING NEGATIVE ASSERTIONS ===`);
    const ix = fs.readFileSync(path.join(__dirname, 'src/hooks/useCanvasInteraction.js'), 'utf8');
    const el = fs.readFileSync(path.join(__dirname, 'src/components/ElementsLayer.jsx'), 'utf8');
    
    // Simplistic check: find index of 'stroke-progress', check next 200 chars
    const spIdx = ix.indexOf('stroke-progress');
    const spContext = ix.substring(spIdx, spIdx + 200);
    console.log('stroke-progress has yElements:', spContext.includes('yElements') ? 'FAIL' : 'PASS');

    const cmIdx = ix.indexOf('cursorMove');
    const cmContext = ix.substring(cmIdx, cmIdx + 200);
    console.log('cursorMove has yElements:', cmContext.includes('yElements') ? 'FAIL' : 'PASS');

    const cbIdx = ix.indexOf('clearBoard');
    const cbContext = ix.substring(cbIdx, cbIdx + 200);
    console.log('clearBoard has yElements:', cbContext.includes('yElements') ? 'FAIL' : 'PASS');

    const usIdx = el.indexOf('function updateStyle');
    if (usIdx === -1) {
       const usIdx2 = el.indexOf('const updateStyle');
       const usContext = el.substring(usIdx2, usIdx2 + 1000);
       console.log('updateStyle has yElements:', usContext.includes('yElements') ? 'PASS' : 'FAIL');
    }
}

checkFile('src/hooks/useCanvasInteraction.js', 'useCanvasInteraction.js (Checks 13-16)');
checkFile('src/hooks/useCanvasHistory.js', 'useCanvasHistory.js (Checks 17-20)');
checkElementsLayer(); // Checks 21
checkGroupTransform(); // Checks 22
checkExclusions(); // Checks 23, 24, 24b, 24c

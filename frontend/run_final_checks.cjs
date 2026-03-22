const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function runChecks() {
    console.log(`\n=== RUNNING FINAL CHECKS ===`);
    
    // Check 26: Changed files
    try {
        const status = execSync('git status --short src/', { encoding: 'utf8' });
        const lines = status.split('\n').filter(l => l.trim().length > 0);
        let unexpected = [];
        const expected = [
            'useYjsBoard.js', 'TestInfiniteCanvas.jsx', 'useCanvasRealtime.js',
            'useCanvasInteraction.js', 'useCanvasHistory.js', 'ElementsLayer.jsx',
            'useGroupTransform.js'
        ];
        lines.forEach(l => {
            if (!expected.some(e => l.includes(e))) {
                unexpected.push(l);
            }
        });
        console.log('CHECK 26 - Unexpected files changed:', unexpected.length === 0 ? 'NONE' : unexpected.join(', '));
    } catch (e) {
        console.log('CHECK 26 - Error running git status:', e.message);
    }

    // Check 27 & 28: Untouched files
    try {
        const vcStatus = execSync('git status --short src/components/VoiceChat.jsx', { encoding: 'utf8' });
        console.log('CHECK 27 - VoiceChat.jsx untouched:', vcStatus.trim() === '' ? 'YES' : 'NO');
        
        const recStatus = execSync('git status --short src/hooks/useBoardRecording.js', { encoding: 'utf8' });
        console.log('CHECK 28 - useBoardRecording.js untouched:', recStatus.trim() === '' ? 'YES' : 'NO');
    } catch (e) {
        console.log('CHECK 27/28 - Error');
    }

    // Check 29: No require()
    const files = [
        'src/hooks/useYjsBoard.js', 'src/components/TestInfiniteCanvas.jsx',
        'src/hooks/useCanvasRealtime.js', 'src/hooks/useCanvasInteraction.js',
        'src/hooks/useCanvasHistory.js', 'src/components/ElementsLayer.jsx',
        'src/components/canvas/useGroupTransform.js'
    ];
    let hasRequire = false;
    files.forEach(f => {
        const content = fs.readFileSync(path.join(__dirname, f), 'utf8');
        if (content.includes('require(')) {
            hasRequire = true;
            console.log('CHECK 29 - FAIL: Require found in', f);
        }
    });
    console.log('CHECK 29 - No require():', !hasRequire ? 'YES' : 'NO');

    // Check 31: useCallback dependencies
    const historyCode = fs.readFileSync(path.join(__dirname, 'src/hooks/useCanvasHistory.js'), 'utf8');
    const undoMatch = historyCode.match(/const undo = useCallback\([\s\S]*?\], \[([^\]]*)\]\);/);
    const redoMatch = historyCode.match(/const redo = useCallback\([\s\S]*?\], \[([^\]]*)\]\);/);
    
    const undoDepsHasElements = undoMatch && undoMatch[1].includes('yElements');
    const redoDepsHasElements = redoMatch && redoMatch[1].includes('yElements');
    console.log('CHECK 31 - useCallback deps include yElements:', (undoDepsHasElements && redoDepsHasElements) ? 'YES' : 'NO');

    // Check 32: URL replace safe regex & no bin/
    const yjsBoardCode = fs.readFileSync(path.join(__dirname, 'src/hooks/useYjsBoard.js'), 'utf8');
    const hasSafeRegex = yjsBoardCode.includes('/\\/api$/');
    console.log('CHECK 32 - URL replace safe regex:', hasSafeRegex ? 'YES' : 'NO');

    let hasBin = false;
    files.forEach(f => {
        const content = fs.readFileSync(path.join(__dirname, f), 'utf8');
        if (content.includes('y-websocket/bin')) hasBin = true;
    });
    console.log('CHECK 32 - No y-websocket/bin/ imports:', !hasBin ? 'YES' : 'NO');
}

runChecks();

/**
 * Post-build script: copies non-TS data assets into dist/
 * so that __dirname-based path resolution works identically
 * in both dev (src/) and prod (dist/) environments.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DATA = path.join(ROOT, 'src', 'data');
const DIST_DATA = path.join(ROOT, 'dist', 'data');

function copyDirRecursive(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log(`Copying ${SRC_DATA} -> ${DIST_DATA}`);
copyDirRecursive(SRC_DATA, DIST_DATA);
console.log('Done copying data files.');

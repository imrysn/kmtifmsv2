/**
 * Auto-increments the patch version in package.json on every clean build.
 * e.g. 2.3.0 -> 2.3.1 -> 2.3.2
 */

const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

const parts = pkg.version.split('.').map(Number);
parts[2] += 1; // bump patch
pkg.version = parts.join('.');

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

console.log('Version bumped to ' + pkg.version);

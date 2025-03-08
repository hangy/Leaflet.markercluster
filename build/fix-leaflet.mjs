import { writeFileSync, readFileSync } from 'fs';

const packagePath = './node_modules/leaflet/package.json';
const pkgJson = JSON.parse(readFileSync(packagePath));

writeFileSync(
    './node_modules/leaflet/package.json',
    JSON.stringify({
        ...pkgJson,
        module: 'dist/leaflet-src.esm.js',
    }, null, 2));
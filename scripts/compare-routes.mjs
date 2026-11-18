import fs from 'fs';

const serverCode = fs.readFileSync('server.ts', 'utf8');
const routeRegex = /app\.(get|post|put|patch|delete)\((?:'|")([^'"]+)(?:'|")/g;
let match;
const serverRoutes = [];
while ((match = routeRegex.exec(serverCode)) !== null) {
  serverRoutes.push({ method: match[1].toUpperCase(), path: match[2] });
}

const phpCode = fs.readFileSync('api/index.php', 'utf8');

const missing = [];
for (const r of serverRoutes) {
  if (r.path.startsWith('/assets/')) continue;
  if (r.path === '*') continue;
  const stripped = r.path.replace(/^\/api/, '');
  const baseKey = stripped.replace(/:[a-zA-Z0-9_]+/g, '').replace(/\/$/, '');
  if (!phpCode.includes(stripped) && !phpCode.includes(baseKey)) {
    missing.push(r);
  }
}
console.log('Truly missing routes count:', missing.length);
missing.forEach(m => console.log(m.method + ' ' + m.path));

/** Servidor local só para ver o site: node test/servidor.mjs [pasta] [porta]  →  http://localhost:8790 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2] || join(fileURLToPath(new URL('.', import.meta.url)), '..', 'docs');
const port = Number(process.argv[3] || 8790);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain' };

http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = join(root, normalize(p));
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
  try {
    const body = await readFile(file);
    res.setHeader('content-type', types[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch { res.statusCode = 404; res.end('não encontrado'); }
}).listen(port, () => console.log(`Site em http://localhost:${port}`));

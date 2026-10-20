import { readFileSync } from 'node:fs';
export const CATEGORIES = JSON.parse(readFileSync(new URL('../../config/categorias.json', import.meta.url), 'utf8'));

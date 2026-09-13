import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LibraryData } from '../shared/types';
export function getLibrary(): LibraryData {
  return JSON.parse(readFileSync(resolve('public/library.json'), 'utf8')) as LibraryData;
}

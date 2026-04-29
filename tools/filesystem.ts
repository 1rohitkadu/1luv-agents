import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

export async function readFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  logger.debug('Read file', { path: filePath, bytes: content.length });
  return content;
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
  logger.debug('Wrote file', { path: filePath, bytes: content.length });
}

export async function appendFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, content, 'utf-8');
}

export async function listFiles(dirPath: string, pattern?: RegExp): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFiles(fullPath, pattern);
      files.push(...nested);
    } else if (!pattern || pattern.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  await fs.unlink(filePath);
  logger.debug('Deleted file', { path: filePath });
}

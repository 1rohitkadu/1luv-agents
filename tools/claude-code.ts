import { spawn } from 'child_process';
import { logger } from './logger';

export interface ClaudeCodeResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runClaudeCode(
  prompt: string,
  workingDir: string,
  options: { timeoutMs?: number; model?: string } = {}
): Promise<ClaudeCodeResult> {
  const { timeoutMs = 300_000, model = 'claude-sonnet-4-6' } = options;

  return new Promise((resolve, reject) => {
    const args = ['--print', '--model', model, prompt];
    const proc = spawn('claude', args, {
      cwd: workingDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`claude-code timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const exitCode = code ?? 1;
      logger.info('claude-code finished', { exitCode, promptSnippet: prompt.slice(0, 80) });
      resolve({ stdout, stderr, exitCode });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function runClaudeCodeTask(
  task: string,
  workingDir: string,
  context?: string
): Promise<string> {
  const fullPrompt = context ? `${context}\n\n${task}` : task;
  const result = await runClaudeCode(fullPrompt, workingDir);
  if (result.exitCode !== 0) {
    logger.warn('claude-code non-zero exit', { exitCode: result.exitCode, stderr: result.stderr });
  }
  return result.stdout;
}

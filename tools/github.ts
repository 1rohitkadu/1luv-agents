import { Octokit } from '@octokit/rest';
import { logger } from './logger';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = process.env.GITHUB_OWNER!;
const REPO = process.env.GITHUB_REPO!;

export async function createBranch(branchName: string, fromBranch = 'main'): Promise<void> {
  const { data: ref } = await octokit.git.getRef({ owner: OWNER, repo: REPO, ref: `heads/${fromBranch}` });
  await octokit.git.createRef({
    owner: OWNER,
    repo: REPO,
    ref: `refs/heads/${branchName}`,
    sha: ref.object.sha,
  });
  logger.info('Created branch', { branch: branchName, from: fromBranch });
}

export async function createOrUpdateFile(
  filePath: string,
  content: string,
  message: string,
  branch: string
): Promise<void> {
  const encoded = Buffer.from(content).toString('base64');
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: filePath, ref: branch });
    if (!Array.isArray(data) && 'sha' in data) sha = data.sha;
  } catch { /* file doesn't exist yet */ }

  await octokit.repos.createOrUpdateFileContents({
    owner: OWNER,
    repo: REPO,
    path: filePath,
    message,
    content: encoded,
    branch,
    sha,
  });
  logger.info('Pushed file to GitHub', { path: filePath, branch });
}

export async function createPullRequest(
  title: string,
  body: string,
  head: string,
  base = 'main'
): Promise<string> {
  const { data } = await octokit.pulls.create({ owner: OWNER, repo: REPO, title, body, head, base });
  logger.info('Created PR', { number: data.number, url: data.html_url });
  return data.html_url;
}

export async function mergePullRequest(pullNumber: number): Promise<void> {
  await octokit.pulls.merge({ owner: OWNER, repo: REPO, pull_number: pullNumber });
  logger.info('Merged PR', { number: pullNumber });
}

export async function getOpenPullRequests() {
  const { data } = await octokit.pulls.list({ owner: OWNER, repo: REPO, state: 'open' });
  return data;
}

export async function createIssue(title: string, body: string, labels?: string[]) {
  const { data } = await octokit.issues.create({ owner: OWNER, repo: REPO, title, body, labels });
  logger.info('Created issue', { number: data.number });
  return data;
}

export async function getFileContent(filePath: string, branch = 'main'): Promise<string> {
  const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: filePath, ref: branch });
  if (Array.isArray(data) || !('content' in data)) throw new Error(`${filePath} is not a file`);
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

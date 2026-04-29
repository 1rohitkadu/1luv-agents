import { BaseAgent } from './base-agent';
import { getFileContent, mergePullRequest, getOpenPullRequests } from '../tools/github';
import { updateTaskStatus } from '../memory/project-state';
import { sendWhatsAppMessage } from '../orchestrator/whatsapp';

const SYSTEM_PROMPT = `You are the QA Engineer at 1luv, a dating app startup.
You review all code before it merges to main. Check for:
- Correctness: does it implement the spec?
- Security: no injection, XSS, auth bypass, data leaks
- Performance: no N+1 queries, unnecessary re-renders
- TypeScript: proper types, no any abuse
- Testing: critical paths are tested
- Code quality: readable, maintainable

Respond with: APPROVED or CHANGES_REQUESTED, followed by specific feedback.`;

export class QaAgent extends BaseAgent {
  constructor() {
    super({ id: 'qa', name: 'QA', role: 'QA Engineer', systemPrompt: SYSTEM_PROMPT });
  }

  async run(input: string): Promise<string> {
    return this.think(input);
  }

  async reviewCode(code: string, spec: string, taskId: string): Promise<{ approved: boolean; feedback: string }> {
    this.log.info('Reviewing code', { taskId, codeLength: code.length });

    const prompt = `Review this code for task: ${taskId}\n\nSpec:\n${spec}\n\nCode:\n\`\`\`\n${code}\n\`\`\``;
    const review = await this.think(prompt, true);

    const approved = review.toUpperCase().includes('APPROVED') && !review.toUpperCase().includes('CHANGES_REQUESTED');
    await this.remember(`review:${taskId}`, approved ? 'approved' : 'rejected');

    if (approved) {
      await updateTaskStatus(taskId, 'done');
    }

    this.log.info('Review complete', { taskId, approved });
    return { approved, feedback: review };
  }

  async reviewPullRequest(pullNumber: number, taskId: string): Promise<{ approved: boolean; feedback: string }> {
    const prs = await getOpenPullRequests();
    const pr = prs.find((p) => p.number === pullNumber);
    if (!pr) throw new Error(`PR #${pullNumber} not found`);

    const result = await this.reviewCode(
      `PR: ${pr.title}\nBody: ${pr.body ?? 'No description'}`,
      pr.title,
      taskId
    );

    if (result.approved) {
      await mergePullRequest(pullNumber);
      await sendWhatsAppMessage(`*1luv QA* PR #${pullNumber} approved and merged. ${pr.title}`);
    } else {
      await sendWhatsAppMessage(`*1luv QA* PR #${pullNumber} needs changes.\n${result.feedback.slice(0, 500)}`);
    }

    return result;
  }
}

// tools/linear.ts
// Linear integration — optional, only activates if API key is provided

let linearClient: any = null;

async function getClient() {
  if (!process.env.LINEAR_API_KEY) {
    console.log('[Linear] No API key found — task tracking disabled');
    return null;
  }

  if (!linearClient) {
    const { LinearClient } = await import('@linear/sdk');
    linearClient = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });
  }

  return linearClient;
}

export async function createLinearTask(task: {
  title: string;
  description: string;
  priority: string;
  githubIssueUrl?: string;
}): Promise<void> {
  const client = await getClient();
  if (!client) return; // silently skip if no key

  try {
    console.log(`[Linear] Creating task: ${task.title}`);
    // Linear task creation would go here when key is provided
  } catch (error) {
    console.log('[Linear] Task creation failed — continuing without it');
  }
}

export async function updateLinearTask(
  taskId: string,
  update: Record<string, any>
): Promise<void> {
  const client = await getClient();
  if (!client) return;

  try {
    console.log(`[Linear] Updating task: ${taskId}`);
  } catch (error) {
    console.log('[Linear] Task update failed — continuing without it');
  }
}
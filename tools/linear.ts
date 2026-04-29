import { LinearClient } from '@linear/sdk';
import { logger } from './logger';

const linear = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

export interface LinearTicket {
  id: string;
  title: string;
  description?: string;
  priority?: number;
  teamId: string;
}

export async function createTicket(ticket: Omit<LinearTicket, 'id'>): Promise<string> {
  const issue = await linear.createIssue({
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority ?? 2,
    teamId: ticket.teamId,
  });
  const created = await issue.issue;
  const id = created?.id ?? 'unknown';
  logger.info('Created Linear ticket', { id, title: ticket.title });
  return id;
}

export async function updateTicketStatus(issueId: string, stateName: string): Promise<void> {
  const states = await linear.workflowStates();
  const state = states.nodes.find((s) => s.name.toLowerCase() === stateName.toLowerCase());
  if (!state) throw new Error(`Linear state "${stateName}" not found`);
  await linear.updateIssue(issueId, { stateId: state.id });
  logger.info('Updated ticket status', { issueId, state: stateName });
}

export async function getTeamId(teamName: string): Promise<string> {
  const teams = await linear.teams();
  const team = teams.nodes.find((t) => t.name.toLowerCase() === teamName.toLowerCase());
  if (!team) throw new Error(`Linear team "${teamName}" not found`);
  return team.id;
}

export async function listOpenTickets(teamId: string) {
  const issues = await linear.issues({ filter: { team: { id: { eq: teamId } }, state: { type: { neq: 'completed' } } } });
  return issues.nodes;
}

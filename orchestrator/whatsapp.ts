import twilio from 'twilio';
import { logger } from '../tools/logger';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
const FOUNDER = `whatsapp:${process.env.FOUNDER_WHATSAPP}`;

export async function sendWhatsAppMessage(message: string, to = FOUNDER): Promise<string> {
  const msg = await client.messages.create({ from: FROM, to, body: message });
  logger.info('WhatsApp sent', { sid: msg.sid, to, snippet: message.slice(0, 60) });
  return msg.sid;
}

export interface IncomingWhatsApp {
  from: string;
  body: string;
  sid: string;
  timestamp: Date;
}

export function parseIncomingWebhook(body: Record<string, string>): IncomingWhatsApp {
  return {
    from: body.From?.replace('whatsapp:', '') ?? '',
    body: body.Body ?? '',
    sid: body.MessageSid ?? '',
    timestamp: new Date(),
  };
}

export function isFromFounder(from: string): boolean {
  const normalized = from.replace('whatsapp:', '').replace(/\s/g, '');
  const founder = (process.env.FOUNDER_WHATSAPP ?? '').replace(/\s/g, '');
  return normalized === founder;
}

export async function sendAlert(subject: string, detail: string): Promise<void> {
  await sendWhatsAppMessage(`*ALERT: ${subject}*\n\n${detail}`);
}

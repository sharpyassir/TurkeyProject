import { Injectable, Logger } from '@nestjs/common';
import { loadConfig } from '../../config/config';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Outbound email. Providers:
 *   log      - prints the message (local dev, CI); the last message is kept for tests
 *   postmark - Postmark HTTP API (MAIL_API_KEY = server token)
 *   resend   - Resend HTTP API (MAIL_API_KEY)
 * Templates are plain text first; HTML is a light wrapper so they render everywhere.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  /** Last message sent through the `log` provider (used by tests and the dev console). */
  last?: Mail;

  async send(mail: Mail): Promise<void> {
    const { MAIL_PROVIDER, MAIL_FROM, MAIL_API_KEY } = loadConfig();
    const html = mail.html ?? wrap(mail.text);
    switch (MAIL_PROVIDER) {
      case 'postmark': {
        const res = await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json', 'X-Postmark-Server-Token': MAIL_API_KEY ?? '' },
          body: JSON.stringify({ From: MAIL_FROM, To: mail.to, Subject: mail.subject, TextBody: mail.text, HtmlBody: html, MessageStream: 'outbound' }),
        });
        if (!res.ok) throw new Error(`postmark ${res.status}: ${await res.text()}`);
        return;
      }
      case 'resend': {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${MAIL_API_KEY ?? ''}` },
          body: JSON.stringify({ from: MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html }),
        });
        if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
        return;
      }
      default:
        this.last = mail;
        this.log.log(`[mail:log] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    }
  }
}

function wrap(text: string) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>');
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:560px"><pre style="white-space:pre-wrap;font:inherit">${esc}</pre></div>`;
}

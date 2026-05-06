import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTicketEmail({ to, buyerName, eventTitle, pdfBuffer }) {
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'TicketFlow <onboarding@resend.dev>',
    to,
    subject: `Your ticket for ${eventTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111827;">You're in, ${buyerName}!</h2>
        <p style="color: #6b7280;">Your ticket for <strong style="color: #111827;">${eventTitle}</strong> is attached as a PDF.</p>
        <p style="color: #6b7280;">Present the QR code at the door for entry.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">TicketFlow · If you didn't purchase this ticket, please ignore this email.</p>
      </div>
    `,
    attachments: [
      {
        filename: 'ticket.pdf',
        content: pdfBuffer,
      },
    ],
  });
}

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEventStatusEmail({ to, eventTitle, status, reason }) {
  const isApproved = status === 'approved';
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'FOMO <onboarding@resend.dev>',
    to,
    subject: isApproved
      ? `Your event "${eventTitle}" is now live!`
      : `Update on your event "${eventTitle}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111827;">${isApproved ? '🎉 Your event is live!' : 'Event not approved'}</h2>
        <p style="color: #6b7280;">
          Your event <strong style="color: #111827;">${eventTitle}</strong> has been
          <strong style="color: ${isApproved ? '#16a34a' : '#dc2626'};">${isApproved ? 'approved' : 'rejected'}</strong>.
        </p>
        ${isApproved
          ? `<p style="color: #6b7280;">It is now visible to the public and tickets can be purchased.</p>`
          : reason
            ? `<p style="color: #6b7280;"><strong>Reason:</strong> ${reason}</p>`
            : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">FOMO · Questions? Reply to this email.</p>
      </div>
    `,
  });
}

export async function sendTicketEmail({ to, buyerName, eventTitle, pdfBuffer }) {
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'FOMO <onboarding@resend.dev>',
    to,
    subject: `Your ticket for ${eventTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111827;">You're in, ${buyerName}!</h2>
        <p style="color: #6b7280;">Your ticket for <strong style="color: #111827;">${eventTitle}</strong> is attached as a PDF.</p>
        <p style="color: #6b7280;">Present the QR code at the door for entry.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">FOMO · If you didn't purchase this ticket, please ignore this email.</p>
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

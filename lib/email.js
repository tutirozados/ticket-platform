import { Resend } from 'resend';

const fmtCRC = (n) => Math.round(n).toLocaleString('es-CR');

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

export async function sendSinpeAdminEmail({ order, event, crcAmount, confirmUrl, rejectUrl }) {
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'FOMO <onboarding@resend.dev>',
    to: process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    subject: `SINPE pendiente: ${order.sinpe_reference} — ${event.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <h2 style="color:#111827;margin-bottom:16px;">Nuevo pago SINPE recibido</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;width:120px;">Comprador</td>
            <td style="padding:10px 0;font-weight:600;color:#111827;">${order.buyer_name}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;">Email</td>
            <td style="padding:10px 0;color:#111827;">${order.buyer_email}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;">Evento</td>
            <td style="padding:10px 0;font-weight:600;color:#111827;">${event.title}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;">Entradas</td>
            <td style="padding:10px 0;color:#111827;">${order.quantity}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 0;color:#6b7280;">Monto</td>
            <td style="padding:10px 0;font-weight:700;color:#111827;">₡${fmtCRC(crcAmount)} <span style="font-weight:400;color:#6b7280;">($${parseFloat(order.total_price).toFixed(2)} USD)</span></td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#6b7280;">Referencia</td>
            <td style="padding:10px 0;font-family:monospace;font-weight:700;font-size:16px;color:#1d4ed8;">${order.sinpe_reference}</td>
          </tr>
        </table>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <a href="${confirmUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Confirmar pago</a>
          <a href="${rejectUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Rechazar</a>
        </div>
        <p style="margin-top:20px;font-size:12px;color:#9ca3af;">También puedes gestionar esto en el panel admin → pestaña SINPE.</p>
      </div>
    `,
  });
}

export async function sendSinpeRejectionEmail({ order, event }) {
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'FOMO <onboarding@resend.dev>',
    to: order.buyer_email,
    subject: `Pago no confirmado — ${event.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#111827;">Tu pago no pudo ser confirmado</h2>
        <p style="color:#6b7280;">Hola ${order.first_name ?? order.buyer_name},</p>
        <p style="color:#6b7280;">
          No pudimos verificar tu transferencia SINPE para
          <strong style="color:#111827;">${event.title}</strong>
          con referencia <strong style="font-family:monospace;">${order.sinpe_reference}</strong>.
        </p>
        <p style="color:#6b7280;">
          Si crees que esto es un error, contáctanos a
          <a href="mailto:${process.env.NEXT_PUBLIC_ADMIN_EMAIL}" style="color:#1d4ed8;">${process.env.NEXT_PUBLIC_ADMIN_EMAIL}</a>.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">FOMO</p>
      </div>
    `,
  });
}

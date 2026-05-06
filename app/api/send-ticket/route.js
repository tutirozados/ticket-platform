import { NextResponse } from 'next/server';
import { renderToBuffer, Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { supabase } from '@/lib/supabase';
import { generateQRCode } from '@/lib/qr';
import { sendTicketEmail } from '@/lib/email';

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  brand: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  eventTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 6,
  },
  eventMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginVertical: 24,
  },
  ticket: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ticketLeft: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  value: {
    fontSize: 13,
    color: '#111827',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
  },
  ticketNumber: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 3,
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrImage: {
    width: 90,
    height: 90,
  },
  ticketCode: {
    fontSize: 8,
    color: '#9ca3af',
    marginTop: 6,
    textAlign: 'center',
  },
  footer: {
    marginTop: 32,
    fontSize: 10,
    color: '#d1d5db',
    textAlign: 'center',
  },
});

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function TicketPDF({ event, order, tickets }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>TicketFlow</Text>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventMeta}>{formatDate(event.date)} · {formatTime(event.date)}</Text>
        <Text style={styles.eventMeta}>{event.location}</Text>

        <View style={styles.divider} />

        {tickets.map((ticket, i) => (
          <View key={ticket.id} style={styles.ticket}>
            <View style={styles.ticketLeft}>
              <Text style={styles.label}>Attendee</Text>
              <Text style={styles.value}>{order.buyer_name}</Text>

              <Text style={styles.label}>Ticket</Text>
              <Text style={styles.ticketNumber}>{i + 1} of {order.quantity}</Text>
            </View>

            <View style={styles.qrContainer}>
              <Image src={ticket.qrDataUrl} style={styles.qrImage} />
              <Text style={styles.ticketCode}>{ticket.ticket_code}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.footer}>
          Present this ticket at the entrance · TicketFlow
        </Text>
      </Page>
    </Document>
  );
}

export async function POST(request) {
  let orderId;

  try {
    const body = await request.json();
    orderId = body.orderId;
  } catch (err) {
    console.error('[send-ticket] Failed to parse request body:', err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  console.log('[send-ticket] Processing order:', orderId);

  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.error('[send-ticket] Order not found:', orderId, orderError);
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Fetch event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', order.event_id)
    .single();

  if (eventError || !event) {
    console.error('[send-ticket] Event not found for order:', orderId, eventError);
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Fetch or create tickets for this order
  let { data: existingTickets, error: fetchTicketsError } = await supabase
    .from('tickets')
    .select('*')
    .eq('order_id', orderId);

  if (fetchTicketsError) {
    console.error('[send-ticket] Failed to fetch tickets:', fetchTicketsError);
  }

  let ticketRecords = existingTickets ?? [];

  if (ticketRecords.length === 0) {
    const newTickets = Array.from({ length: order.quantity }, () => ({
      order_id: orderId,
      event_id: order.event_id,
      ticket_code: crypto.randomUUID(),
      is_used: false,
    }));

    const { data: created, error: ticketError } = await supabase
      .from('tickets')
      .insert(newTickets)
      .select();

    if (ticketError) {
      console.error('[send-ticket] Failed to create tickets:', ticketError);
      return NextResponse.json({ error: 'Failed to create tickets' }, { status: 500 });
    }

    console.log('[send-ticket] Created', created.length, 'ticket(s) for order:', orderId);
    ticketRecords = created;
  } else {
    console.log('[send-ticket] Using', ticketRecords.length, 'existing ticket(s) for order:', orderId);
  }

  // Generate QR codes
  const ticketsWithQR = await Promise.all(
    ticketRecords.map(async (ticket) => ({
      ...ticket,
      qrDataUrl: await generateQRCode(ticket.ticket_code),
    }))
  );

  // Render PDF
  let pdfBuffer;
  try {
    pdfBuffer = await renderToBuffer(
      <TicketPDF event={event} order={order} tickets={ticketsWithQR} />
    );
    console.log('[send-ticket] PDF rendered successfully for order:', orderId);
  } catch (err) {
    console.error('[send-ticket] PDF rendering failed:', err);
    return NextResponse.json({ error: 'Failed to render PDF' }, { status: 500 });
  }

  // Send email
  const { error: emailError } = await sendTicketEmail({
    to: order.buyer_email,
    buyerName: order.buyer_name,
    eventTitle: event.title,
    pdfBuffer,
  });

  if (emailError) {
    console.error('[send-ticket] Email sending failed for order:', orderId, emailError);
    return NextResponse.json({ error: 'Failed to send email', detail: emailError }, { status: 500 });
  }

  console.log('[send-ticket] Email sent successfully to:', order.buyer_email);
  return NextResponse.json({ success: true, ticketCount: ticketRecords.length });
}

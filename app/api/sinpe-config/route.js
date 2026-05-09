export async function GET() {
  return Response.json({
    sinpeNumber: process.env.SINPE_NUMBER ?? '',
    exchangeRate: parseFloat(process.env.USD_TO_CRC_RATE ?? process.env.NEXT_PUBLIC_USD_TO_CRC_RATE ?? '515'),
  });
}

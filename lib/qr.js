import QRCode from 'qrcode';

export async function generateQRCode(text) {
  return QRCode.toDataURL(text, { width: 200, margin: 1 });
}

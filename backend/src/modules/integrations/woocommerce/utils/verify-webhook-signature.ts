import * as crypto from 'crypto';

export function verifyWooCommerceWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret || !rawBody?.length) {
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const computed = hmac.digest('base64');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

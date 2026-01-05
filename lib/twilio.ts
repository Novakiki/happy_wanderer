/**
 * Twilio SMS Client
 * =================
 * Server-side SMS sending for claim notifications.
 * Uses Twilio REST API directly (no SDK) for smaller bundle size.
 *
 * Required environment variables:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_FROM_NUMBER
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

export type SmsResult = {
  success: boolean;
  sid?: string;
  error?: string;
};

/**
 * Check if Twilio is configured with required environment variables.
 */
export function isTwilioConfigured(): boolean {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);
}

/**
 * Send an SMS via Twilio REST API.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  if (!isTwilioConfigured()) {
    console.warn('twilio: Not configured, skipping SMS');
    return { success: false, error: 'Twilio not configured' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: TWILIO_FROM_NUMBER!,
        Body: body,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('twilio: SMS send failed:', data);
      return { success: false, error: data.message || 'SMS send failed' };
    }

    return { success: true, sid: data.sid };
  } catch (error) {
    console.error('twilio: SMS error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Build the claim SMS message.
 */
export function buildClaimSmsMessage(
  recipientName: string,
  claimToken: string,
  baseUrl: string
): string {
  const claimUrl = `${baseUrl}/claim/${claimToken}`;
  return `Hey ${recipientName}! You were mentioned in a memory of Val. See the note and choose how your name appears: ${claimUrl}`;
}

/**
 * Generate a secure random token for claim URLs.
 * Uses crypto.randomUUID() for simplicity and sufficient entropy.
 */
export function generateClaimToken(): string {
  return crypto.randomUUID();
}

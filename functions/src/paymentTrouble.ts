/** Trouble paying, not a complaint that a price is high. Same rule as src/lib/payment-trouble.ts. */

const TROUBLE_PAYING =
  /\b(?:cannot|can not|can't|cant|could not|couldn't|couldnt|unable to)\s+afford\b|\b(?:cannot|can not|can't|cant|could not|couldn't|couldnt|unable to)\s+pay\b|\b(?:late|behind)\s+on\s+(?:the\s+|my\s+|our\s+|a\s+)?payments?\b/i;

export const PAYMENT_TROUBLE_NEXT_STEP = "Offer a payment plan or a more affordable option and arrange a callback.";

export const PAYMENT_TROUBLE_REASON = "The caller cannot afford to pay.";

export function showsTroublePaying(text: string): boolean {
  return TROUBLE_PAYING.test(text.replace(/[’‘]/g, "'"));
}

/** A short reason when the caller cannot afford or cannot pay. Ordinary price dislike returns null. */
export function troublePayingReason(reason: string | null, support: string | null): string | null {
  const reasonText = reason?.trim() ?? "";
  const supportText = support?.trim() ?? "";
  const reasonHit = reasonText.length > 0 && showsTroublePaying(reasonText);
  const supportHit = supportText.length > 0 && showsTroublePaying(supportText);
  if (!reasonHit && !supportHit) return null;
  if (reasonHit && reasonText.length <= 240) return reasonText;
  return PAYMENT_TROUBLE_REASON;
}

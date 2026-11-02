export interface InvoiceAmounts {
  amount: number | string;
  amount_paid?: number | string | null;
  amount_waived?: number | string | null;
  amount_refunded?: number | string | null;
}

export function toCents(value: number | string | null | undefined): number {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function getOutstandingBalance(invoice: InvoiceAmounts): number {
  const outstandingCents = Math.max(
    0,
    toCents(invoice.amount) - toCents(invoice.amount_paid) - toCents(invoice.amount_waived),
  );
  return outstandingCents / 100;
}

export function getNetAmountRetained(invoice: InvoiceAmounts): number {
  return Math.max(0, toCents(invoice.amount_paid) - toCents(invoice.amount_refunded)) / 100;
}

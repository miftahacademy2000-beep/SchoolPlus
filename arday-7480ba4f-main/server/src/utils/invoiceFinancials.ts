export function amountToCents(amount: number | string): number {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('Amount must be a non-negative finite number');
  }
  return Math.round(value * 100);
}

export function outstandingBalanceCents(
  originalAmount: number | string,
  amountPaid: number | string,
  amountWaived: number | string,
): number {
  return Math.max(0, amountToCents(originalAmount) - amountToCents(amountPaid) - amountToCents(amountWaived));
}

export function availableRefundCents(
  paymentAmount: number | string,
  previousRefunds: number | string,
): number {
  return Math.max(0, amountToCents(paymentAmount) - amountToCents(previousRefunds));
}

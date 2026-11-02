import { describe, expect, it } from 'vitest';
import {
  availableRefundCents,
  outstandingBalanceCents,
} from '../../server/src/utils/invoiceFinancials';
import {
  getNetAmountRetained,
  getOutstandingBalance,
} from '@/lib/invoiceFinancials';

describe('invoice cancellation financials', () => {
  it('waives an unpaid fee without recording it as paid or refunded', () => {
    const invoice = { amount: 3.5, amount_paid: 0, amount_waived: 3.5, amount_refunded: 0 };

    expect(getOutstandingBalance(invoice)).toBe(0);
    expect(getNetAmountRetained(invoice)).toBe(0);
  });

  it('keeps the original paid amount while showing the net retained after a full refund', () => {
    const invoice = { amount: 3.5, amount_paid: 3.5, amount_waived: 0, amount_refunded: 3.5 };

    expect(getOutstandingBalance(invoice)).toBe(0);
    expect(getNetAmountRetained(invoice)).toBe(0);
  });

  it('keeps an unpaid cancellation outstanding when there is no waiver', () => {
    expect(getOutstandingBalance({ amount: 3.5, amount_paid: 0, amount_waived: 0 })).toBe(3.5);
  });

  it('calculates partial waivers and paid amounts in cents', () => {
    expect(getOutstandingBalance({ amount: 10, amount_paid: 2.25, amount_waived: 3.5 })).toBe(4.25);
    expect(outstandingBalanceCents(10, 2.25, 3.5)).toBe(425);
  });

  it('allows sequential partial refunds only up to the original payment', () => {
    expect(availableRefundCents(3.5, 1.25)).toBe(225);
    expect(availableRefundCents(3.5, 3.5)).toBe(0);
    expect(getNetAmountRetained({ amount: 3.5, amount_paid: 3.5, amount_refunded: 1.25 })).toBe(2.25);
  });
});

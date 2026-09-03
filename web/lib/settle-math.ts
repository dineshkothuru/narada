// A tip is not known when the bill is raised — the guest decides when they pay.
// So the counter raises a plain bill, and whatever comes in above it is the
// tip. Paying by UPI or card, the guest deliberately sends the round-up; paying
// cash, the cashier enters what was actually kept after handing back change.

export type PaymentSplit = {
  /** recorded against the bill */
  towardsBill: number;
  /** anything above the bill, credited as a tip */
  tip: number;
};

export function splitPayment(due: number, amount: number): PaymentSplit {
  const paid = Math.max(0, Math.round(amount));
  const owed = Math.max(0, Math.round(due));
  if (paid <= owed) return { towardsBill: paid, tip: 0 };
  return { towardsBill: owed, tip: paid - owed };
}

import { prisma } from '../config/database.js';

export async function generateInvoiceNumber(schoolId: string): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const monthStr = String(month).padStart(2, '0');

  const counter = await prisma.invoiceCounter.findUnique({
    where: { schoolId },
  });

  if (!counter || counter.currentYear !== year || counter.currentMonth !== month) {
    await prisma.invoiceCounter.upsert({
      where: { schoolId },
      create: {
        schoolId,
        nextNumber: 2,
        currentYear: year,
        currentMonth: month,
      },
      update: {
        nextNumber: 2,
        currentYear: year,
        currentMonth: month,
      },
    });

    const sequence = String(1).padStart(3, '0');
    return `INV-${year}-${monthStr}-${sequence}`;
  }

  const currentNumber = counter.nextNumber;

  await prisma.invoiceCounter.update({
    where: { schoolId },
    data: {
      nextNumber: currentNumber + 1,
    },
  });

  const sequence = String(currentNumber).padStart(3, '0');
  return `INV-${year}-${monthStr}-${sequence}`;
}

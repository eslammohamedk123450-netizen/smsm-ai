export function parseHimsExpiryDate(value: string, now = Date.now()): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("اكتب تاريخ الانتهاء بصيغة YYYY-MM-DD أو اتركه فارغًا.");
  }
  const calendarDate = new Date(`${normalized}T00:00:00.000Z`);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== normalized) {
    throw new Error("تاريخ انتهاء الكود غير صحيح.");
  }
  const endOfDay = new Date(`${normalized}T23:59:59`);
  if (!Number.isFinite(endOfDay.getTime()) || endOfDay.getTime() <= now) {
    throw new Error("تاريخ انتهاء الكود يجب أن يكون في المستقبل.");
  }
  return endOfDay.toISOString();
}

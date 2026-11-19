export function getPlaygroundIssue(language: string, code: string, incomplete = false): string | null {
  if (incomplete) return "الكود غير مكتمل: لم يصل إغلاق كتلة الكود. انتظر اكتمال الرد أو أعد طلب الكود كاملًا.";
  const lang = language.trim().toLowerCase();
  if (!/^(html|htm|html5)$/.test(lang)) return null;
  const source = code.trim();
  const isDocument = /^<!doctype\s+html/i.test(source) || /<html[\s>]/i.test(source);
  if (!isDocument) return null;
  if (!/<\/html\s*>/i.test(source)) return "مستند HTML غير مكتمل: وسم </html> غير موجود.";
  if (/<body\b[^>]*>/i.test(source) && !/<\/body\s*>/i.test(source)) return "مستند HTML غير مكتمل: وسم </body> غير موجود.";
  const count = (pattern: RegExp) => (source.match(pattern) ?? []).length;
  if (count(/<style\b[^>]*>/gi) > count(/<\/style\s*>/gi)) return "ملف HTML غير مكتمل: وسم </style> غير موجود، لذلك لن تظهر الصفحة بشكل صحيح.";
  if (count(/<script\b[^>]*>/gi) > count(/<\/script\s*>/gi)) return "ملف HTML غير مكتمل: وسم </script> غير موجود.";
  return null;
}

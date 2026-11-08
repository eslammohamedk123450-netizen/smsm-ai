export type SuggestionCard = {
  text: string;
  icon: "calendar-outline" | "book-outline" | "create-outline" | "bulb-outline";
};

// Keep the catalog in data instead of the screen so it can grow without making
// the chat component harder to maintain. The time bucket makes navigation and
// remounts stable while still rotating the visible cards periodically.
export const SUGGESTION_CATALOG: SuggestionCard[] = [
  { text: "خططلي يومي بطريقة بسيطة", icon: "calendar-outline" },
  { text: "اشرحلي درس صعب بطريقة سهلة", icon: "book-outline" },
  { text: "اعملي ملخص لدرس", icon: "create-outline" },
  { text: "اكتبلي إيميل رسمي", icon: "bulb-outline" },
  { text: "ساعدني أرتب أفكاري", icon: "calendar-outline" },
  { text: "اكتبلي كود لعبة بسيطة", icon: "book-outline" },
  { text: "اقترحلي وجبة سهلة", icon: "create-outline" },
  { text: "لخصلي موضوع مهم", icon: "bulb-outline" },
  { text: "راجع معايا اللي اتعلمته النهارده", icon: "calendar-outline" },
  { text: "اكتبلي قصة قصيرة", icon: "book-outline" },
  { text: "ساعدني أجهز لبكرة", icon: "create-outline" },
  { text: "اشرحلي فكرة بطريقة بسيطة", icon: "bulb-outline" },
  { text: "اعمل لي خطة مذاكرة", icon: "calendar-outline" },
  { text: "صححلي الفقرة دي لغويًا", icon: "book-outline" },
  { text: "حوّل أفكاري إلى قائمة مهام", icon: "create-outline" },
  { text: "اقترح أسماء لمشروعي", icon: "bulb-outline" },
  { text: "اكتبلي سيرة ذاتية", icon: "calendar-outline" },
  { text: "جهزلي أسئلة مقابلة عمل", icon: "book-outline" },
  { text: "ترجم النص ده للعربية", icon: "create-outline" },
  { text: "اختصرلي رسالة طويلة", icon: "bulb-outline" },
  { text: "اعمل مقارنة بين خيارين", icon: "calendar-outline" },
  { text: "احسبلي الميزانية الشهرية", icon: "book-outline" },
  { text: "اقترحلي أفكار محتوى", icon: "create-outline" },
  { text: "اكتبلي منشورًا جذابًا", icon: "bulb-outline" },
  { text: "علمني مهارة جديدة", icon: "calendar-outline" },
  { text: "بسّطلي مقالًا علميًا", icon: "book-outline" },
  { text: "حلللي البيانات دي", icon: "create-outline" },
  { text: "اعمللي جدول أسبوعي", icon: "bulb-outline" },
  { text: "اكتبلي رسالة اعتذار", icon: "calendar-outline" },
  { text: "اقترحلي هدية مناسبة", icon: "book-outline" },
  { text: "ساعدني أبدأ مشروع", icon: "create-outline" },
  { text: "جهزلي عرض تقديمي", icon: "bulb-outline" },
  { text: "اكتبلي وصف منتج", icon: "calendar-outline" },
  { text: "لخصلي فيديو أو محاضرة", icon: "book-outline" },
  { text: "راجعلي عقدًا أو مستندًا", icon: "create-outline" },
  { text: "اكتبلي ردًا مهذبًا", icon: "bulb-outline" },
  { text: "اقترحلي روتين صباحي", icon: "calendar-outline" },
  { text: "ساعدني أتعلم إنجليزي", icon: "book-outline" },
  { text: "حوّل النص إلى نقاط", icon: "create-outline" },
  { text: "اكتبلي فكرة إعلان", icon: "bulb-outline" },
  { text: "رتبلي أولوياتي", icon: "calendar-outline" },
  { text: "اشرحلي مصطلحًا تقنيًا", icon: "book-outline" },
  { text: "اعمللي خطة سفر", icon: "create-outline" },
  { text: "اقترحلي تمارين في البيت", icon: "bulb-outline" },
  { text: "اكتبلي قصة للأطفال", icon: "calendar-outline" },
  { text: "قارن بين هاتفين", icon: "book-outline" },
  { text: "ساعدني أختار اسمًا", icon: "create-outline" },
  { text: "اكتبلي وصفًا لصورتي", icon: "bulb-outline" },
  { text: "نظملي مصاريفي", icon: "calendar-outline" },
  { text: "اشرحلي الرياضيات خطوة خطوة", icon: "book-outline" },
  { text: "راجعلي كود البرمجة", icon: "create-outline" },
  { text: "اقترح أسئلة للبحث", icon: "bulb-outline" },
  { text: "اكتبلي خطة تسويقية", icon: "calendar-outline" },
  { text: "لخصلي كتابًا", icon: "book-outline" },
  { text: "استخرج المعلومات المهمة", icon: "create-outline" },
  { text: "اقترح حلولًا لمشكلة", icon: "bulb-outline" },
  { text: "جهزلي قائمة مشتريات", icon: "calendar-outline" },
  { text: "علمني النطق الصحيح", icon: "book-outline" },
  { text: "اكتبلي رسالة متابعة", icon: "create-outline" },
  { text: "ابتكرلي اسم علامة تجارية", icon: "bulb-outline" },
  { text: "خططلي لتمرين اليوم", icon: "calendar-outline" },
  { text: "اشرحلي خبرًا حديثًا", icon: "book-outline" },
  { text: "حوّل الملاحظات إلى تقرير", icon: "create-outline" },
  { text: "اقترحلي أسئلة للمقابلة", icon: "bulb-outline" },
  { text: "اكتبلي جدول مذاكرة", icon: "calendar-outline" },
  { text: "بسّطلي درس التاريخ", icon: "book-outline" },
  { text: "أنشئلي قالبًا جاهزًا", icon: "create-outline" },
  { text: "فكر معي بطريقة إبداعية", icon: "bulb-outline" },
  { text: "ساعدني أقرر بين وظيفتين", icon: "calendar-outline" },
  { text: "ترجملي بريدًا إلكترونيًا", icon: "book-outline" },
  { text: "اكتبلي تعليمات واضحة", icon: "create-outline" },
  { text: "اقترحلي أسماء ملفات", icon: "bulb-outline" },
  { text: "اعمللي خطة ادخار", icon: "calendar-outline" },
  { text: "اشرحلي الذكاء الاصطناعي", icon: "book-outline" },
  { text: "نظفلي النص من الأخطاء", icon: "create-outline" },
  { text: "اقترحلي أفكار هدايا", icon: "bulb-outline" },
  { text: "رتبلي رحلة نهاية الأسبوع", icon: "calendar-outline" },
  { text: "راجعلي واجب المدرسة", icon: "book-outline" },
  { text: "اكتبلي نموذج طلب", icon: "create-outline" },
  { text: "ساعدني أجد حلًا سريعًا", icon: "bulb-outline" },
  { text: "خططلي وجبات الأسبوع", icon: "calendar-outline" },
  { text: "فسرلي نتيجة تحليل", icon: "book-outline" },
  { text: "حوّل الفكرة إلى خطوات", icon: "create-outline" },
  { text: "اكتبلي مقدمة قوية", icon: "bulb-outline" },
  { text: "نظملي وقتي في الامتحانات", icon: "calendar-outline" },
  { text: "اشرحلي درس الفيزياء", icon: "book-outline" },
  { text: "اكتبلي كودًا نظيفًا", icon: "create-outline" },
  { text: "اقترحلي طرقًا للتوفير", icon: "bulb-outline" },
  { text: "جهزلي قائمة أهداف", icon: "calendar-outline" },
  { text: "لخصلي اجتماعًا", icon: "book-outline" },
  { text: "اكتبلي خطة تنفيذ", icon: "create-outline" },
  { text: "ساعدني أستكشف فكرة", icon: "bulb-outline" },
  { text: "اعمللي جدول تنظيف", icon: "calendar-outline" },
  { text: "اشرحلي مفهومًا اقتصاديًا", icon: "book-outline" },
  { text: "راجعلي صياغة الرسالة", icon: "create-outline" },
  { text: "اقترحلي عنوانًا جذابًا", icon: "bulb-outline" },
  { text: "خططلي لتعلم لغة", icon: "calendar-outline" },
  { text: "حول النص إلى إنفوجرافيك", icon: "book-outline" },
  { text: "اكتبلي أسئلة وأجوبة", icon: "create-outline" },
  { text: "ساعدني أفهم القرار", icon: "bulb-outline" },
  { text: "جهزلي خطة أسبوعية", icon: "calendar-outline" },
  { text: "اشرحلي الفرق بين مفهومين", icon: "book-outline" },
  { text: "اكتبلي ملخصًا تنفيذيًا", icon: "create-outline" },
  { text: "اقترحلي طريقة أفضل", icon: "bulb-outline" },
];

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

export function getRotatingSuggestions(now = Date.now(), visibleCount = 4): SuggestionCard[] {
  const bucket = Math.floor(now / (15 * 60 * 1000));
  return [...SUGGESTION_CATALOG]
    .map((suggestion, index) => ({ suggestion, score: hash(`${bucket}:${index}:${suggestion.text}`) }))
    .sort((left, right) => left.score - right.score)
    .slice(0, Math.max(1, visibleCount))
    .map(({ suggestion }) => suggestion);
}

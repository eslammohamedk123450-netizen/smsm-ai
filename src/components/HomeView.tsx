import React from 'react';

interface HomeViewProps {
  onSelectPrompt: (promptText: string) => void;
  onOpenTaskSheet: () => void;
}

const ROW_1_PILLS = [
  { emoji: '🎵', text: 'ابحث عن حفلات موسيقية', prompt: 'ابحث لي عن حفلات موسيقية وفعاليات ثقافية قادمة لهذا الشهر، مع المواعيد والأماكن.' },
  { emoji: '📍', text: 'خطط لي لعطلة نهاية الأسبوع', prompt: 'خطط لي برنامجاً متوازناً لعطلة نهاية الأسبوع يجمع بين الاسترخاء والأنشطة الممتعة.' },
  { emoji: '📰', text: 'تحديثات الأخبار', prompt: 'أعطني ملخصاً لأبرز التحديثات والأخبار الاقتصادية والتجارية المؤثرة.' },
  { emoji: '📊', text: 'إعداد ملخص مالي تنفيذي', prompt: 'أعد ملخصاً مالياً تنفيذياً يعرض الإيرادات والتكاليف وهوامش الربح.' },
  { emoji: '✍️', text: 'صياغة بريد إلكتروني رسمي', prompt: 'اكتب مسودة بريد إلكتروني رسمي للتنسيق مع شريك تجاري جديد.' },
];

const ROW_2_PILLS = [
  { emoji: '🔍', text: 'تدقيق العقود والاتفاقيات', prompt: 'راجع أهم البنود التي يجب التركيز عليها عند صياغة عقد أو اتفاقية.' },
  { emoji: '💡', text: 'استراتيجية تسويق ربع سنوية', prompt: 'اقترح إطار عمل لاستراتيجية تسويق رقمي للربع القادم مع مؤشرات أداء.' },
  { emoji: '📈', text: 'تحليل مؤشرات الأداء', prompt: 'اقترح لوحة مؤشرات أداء رئيسية لفريق المبيعات والعمليات.' },
  { emoji: '📋', text: 'جدولة مهام الأسبوع', prompt: 'رتب خطة أسبوعية لإدارة المشاريع وتوزيع أولويات العمل.' },
  { emoji: '🌐', text: 'تقرير أبحاث السوق', prompt: 'لخص أهم اتجاهات السوق في قطاع التحول الرقمي للشركات.' },
];

export const HomeView: React.FC<HomeViewProps> = ({ onSelectPrompt }) => {
  return (
    <div className="flex-1 w-full flex flex-col justify-between py-6 px-4 max-w-4xl mx-auto">
      {/* Top spacer to balance layout */}
      <div className="flex-1 min-h-[40px]" />

      <div className="text-center my-auto">
        <h1 className="text-[22px] font-bold text-[#FFFFFF] select-none tracking-tight">
          دع Suly يعمل من أجلك
        </h1>

        {/* Large empty space under the text as requested */}
        <div className="h-16 md:h-24" />

        {/* Two rows of horizontal scrollable quick-prompt pills */}
        <div className="space-y-3 w-full">
          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 px-1">
            {ROW_1_PILLS.map((pill, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(pill.prompt)}
                className="bg-[#1F1F1F] hover:bg-[#262626] active:scale-95 border border-[#262626] rounded-full p-[12px] px-4 flex items-center gap-2 transition-all shrink-0 cursor-pointer text-right group shadow-xs"
              >
                <span className="text-base select-none">{pill.emoji}</span>
                <span className="text-[#D1D5DB] group-hover:text-white text-[13px] font-normal whitespace-nowrap">
                  {pill.text}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 px-1">
            {ROW_2_PILLS.map((pill, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(pill.prompt)}
                className="bg-[#1F1F1F] hover:bg-[#262626] active:scale-95 border border-[#262626] rounded-full p-[12px] px-4 flex items-center gap-2 transition-all shrink-0 cursor-pointer text-right group shadow-xs"
              >
                <span className="text-base select-none">{pill.emoji}</span>
                <span className="text-[#D1D5DB] group-hover:text-white text-[13px] font-normal whitespace-nowrap">
                  {pill.text}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Descriptive text only; the quick-prompt pills above are the interactive choices. */}
        <div className="mt-8 flex justify-center text-sm text-[#A1A1AA] select-none">
          اختر مهمة من الاختصارات أعلاه
        </div>
      </div>

      {/* Bottom spacer above input */}
      <div className="flex-1 min-h-[40px]" />
    </div>
  );
};

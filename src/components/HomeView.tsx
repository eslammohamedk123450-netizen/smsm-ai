import React from 'react';

interface HomeViewProps {
  onSelectPrompt: (promptText: string) => void;
  onOpenTaskSheet: () => void;
}

const ROW_1_PILLS = [
  { emoji: '🎵', text: 'ابحث عن حفلات موسيقية', prompt: 'ابحث لي عن حفلات موسيقية وفعاليات ثقافية قادمة لهذا الشهر مع جدول مواعيدها وأماكنها.' },
  { emoji: '📍', text: 'خطط لي لعطلة نهاية الأسبوع', prompt: 'خطط لي برنامجاً متوازناً لعطلة نهاية الأسبوع يجمع بين الاسترخاء والترتيب للأسبوع القادم.' },
  { emoji: '📰', text: 'تحديثات الأخبار', prompt: 'أريد ملخصاً لأبرز التحديثات والأخبار الاقتصادية والتجارية المؤثرة على قطاع الأعمال اليوم.' },
  { emoji: '📊', text: 'إعداد ملخص مالي تنفيذي', prompt: 'قم بإعداد نموذج ملخص مالي تنفيذي يعرض الإيرادات، التكاليف، وهوامش الربح المتوقعة في جدول منظم.' },
  { emoji: '✍️', text: 'صياغة بريد إلكتروني رسمي', prompt: 'اكتب لي مسودة بريد إلكتروني رسمي للتنسيق مع شريك تجاري جديد بشأن توقيع مذكرة تفاهم.' },
];

const ROW_2_PILLS = [
  { emoji: '🔍', text: 'تدقيق العقود والاتفاقيات', prompt: 'ما هي أهم البنود التعاقدية التي يجب التركيز عليها عند صياغة عقد تقديم خدمات استشارية للشركات؟' },
  { emoji: '💡', text: 'استراتيجية تسويق ربع سنوية', prompt: 'قدم لي إطار عمل لاستراتيجية تسويق رقمي للربع القادم مع مؤشرات قياس الأداء وجدول تنفيذي.' },
  { emoji: '📈', text: 'تحليل مؤشرات الأداء', prompt: 'كيف يمكن تصميم لوحة مؤشرات أداء رئيسية (KPIs) لفريق المبيعات والعمليات في المؤسسة؟' },
  { emoji: '📋', text: 'جدولة مهام الأسبوع', prompt: 'رتب لي خطة أسبوعية لإدارة المشاريع وتوزيع أولويات العمل بين أعضاء الفريق.' },
  { emoji: '🌐', text: 'تقرير أبحاث السوق', prompt: 'أريد ملخصاً لأهم اتجاهات السوق في قطاع التحول الرقمي للشركات لهذا العام.' },
];

export const HomeView: React.FC<HomeViewProps> = ({ onSelectPrompt, onOpenTaskSheet }) => {
  return (
    <div className="flex-1 w-full flex flex-col justify-between py-6 px-4 max-w-4xl mx-auto">
      {/* Top spacer to balance layout */}
      <div className="flex-1 min-h-[40px]" />

      {/* Center Section:
          نص واحد فقط: "دع Suly يعمل من أجلك" بخط أبيض #FFFFFF حجم 22 Bold، وتحته مسافة فاضية كبيرة */}
      <div className="text-center my-auto">
        <h1 className="text-[22px] font-bold text-[#FFFFFF] select-none tracking-tight">
          دع Suly يعمل من أجلك
        </h1>

        {/* Large empty space under the text as requested */}
        <div className="h-16 md:h-24" />

        {/* Two rows of horizontal scrollable pills:
            كل كبسولة: خلفية #1F1F1F و borderRadius 999 و padding 12، فيها إيموجي + نص #D1D5DB حجم 13 */}
        <div className="space-y-3 w-full">
          {/* Row 1 */}
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

          {/* Row 2 */}
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

        {/* Single button under the pills in center:
            زر واحد فقط في المنتصف: "اختر مهمة" خلفية بيضاء #FFFFFF ونص أسود #000000 و borderRadius 999 */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={onOpenTaskSheet}
            className="bg-[#FFFFFF] text-[#000000] hover:bg-zinc-200 active:scale-95 rounded-full px-7 py-3 font-bold text-sm transition-all shadow-md cursor-pointer select-none"
          >
            اختر مهمة
          </button>
        </div>
      </div>

      {/* Bottom spacer above input */}
      <div className="flex-1 min-h-[40px]" />
    </div>
  );
};

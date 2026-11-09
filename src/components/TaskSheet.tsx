import React from 'react';
import { X, Briefcase, FileText, BarChart3, Search, Calendar, Mail, FileCheck } from 'lucide-react';

interface TaskSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTask: (prompt: string) => void;
}

interface CorporateTaskOption {
  id: string;
  emoji: string;
  title: string;
  category: string;
  prompt: string;
}

const CORPORATE_TASKS: CorporateTaskOption[] = [
  {
    id: '1',
    emoji: '📊',
    title: 'تحليل المؤشرات المالية والتقارير',
    category: 'المالية والاستثمار',
    prompt: 'قم بإعداد تحليل تنفيذي موجز لمؤشرات الأداء المالي للربع السنوي مع جدول مقارنة التكاليف والإيرادات والتوصيات الرئيسية.',
  },
  {
    id: '2',
    emoji: '⚖️',
    title: 'مراجعة وتدقيق بنود العقود التجارية',
    category: 'الشؤون القانونية',
    prompt: 'أحتاج إلى مراجعة نموذج عقد توريد وتحديد الالتزامات والضمانات وشروط إنهاء التعاقد وجدول زمني للتسليم.',
  },
  {
    id: '3',
    emoji: '✍️',
    title: 'صياغة بريد إلكتروني ومراسلات رسمية',
    category: 'التواصل والاتصال',
    prompt: 'اكتب خطاب شراكة رسمي موجهاً إلى إدارة شركة استثمارية لطلب عقد اجتماع لبحث أوجه التعاون المشترك.',
  },
  {
    id: '4',
    emoji: '🔍',
    title: 'بحث وتحليل المنافسين والأسواق',
    category: 'استراتيجيات الأعمال',
    prompt: 'قدم دراسة مقارنة حول استراتيجيات التسعير وحصة السوق لأبرز ثلاث شركات في قطاع التجارة الرقمية مع جدول تحليلي.',
  },
  {
    id: '5',
    emoji: '📍',
    title: 'خطة جدول أعمال وفعاليات المؤسسة',
    category: 'إدارة العمليات',
    prompt: 'خطط لي جدولاً تنظيمياً لملتقى سنوي للشركاء مدته يومان متضمناً الجلسات ومواعيد الاستراحات والمتحدثين.',
  },
  {
    id: '6',
    emoji: '📋',
    title: 'إعداد خطة عمل تنفيذية للمشاريع',
    category: 'إدارة المشاريع',
    prompt: 'صمم خطة عمل تنفيذية لمشروع إطلاق خدمة جديدة تشمل المراحل، المسؤوليات، والجدول الزمني للإنجاز.',
  },
];

export const TaskSheet: React.FC<TaskSheetProps> = ({ isOpen, onClose, onSelectTask }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet Container */}
      <div className="relative z-50 w-full max-w-xl bg-[#1F1F1F] border-t border-[#262626] rounded-t-3xl p-5 shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* Centered drag handle */}
        <div className="w-10 h-1 bg-[#333333] rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <span className="text-xl">💼</span>
            <div>
              <h3 className="text-[17px] font-bold text-[#F5F5F5]">اختر مهمة لـ Suly</h3>
              <p className="text-[11px] text-[#A1A1AA]">نماذج مهام ذكية جاهزة للتشغيل المؤسسي الفوري</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-[#262626] transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tasks List */}
        <div className="overflow-y-auto custom-scrollbar my-4 space-y-2.5 pr-1">
          {CORPORATE_TASKS.map((task) => (
            <button
              key={task.id}
              onClick={() => {
                onSelectTask(task.prompt);
                onClose();
              }}
              className="w-full text-right p-3.5 bg-[#111111] hover:bg-[#141414] active:bg-[#1A1A1A] border border-[#262626] rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0 p-2 bg-[#1F1F1F] rounded-lg border border-[#262626]">
                  {task.emoji}
                </span>
                <div className="flex flex-col">
                  <span className="text-[14px] font-bold text-[#F5F5F5] group-hover:text-white transition-colors">
                    {task.title}
                  </span>
                  <span className="text-[11px] text-[#A1A1AA] mt-0.5">
                    {task.category}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-[#0EA5E9] font-bold px-2 py-1 rounded bg-[#0EA5E9]/10 shrink-0">
                تشغيل
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { X, Check, ShieldCheck } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgradePlan: (planName: string) => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  onUpgradePlan,
}) => {
  if (!isOpen) return null;

  const plans = [
    {
      name: 'Free',
      badge: 'الخطة الحالية',
      price: '0 $',
      period: 'شهرياً',
      features: [
        '10,000 نقطة شهرية متجددة',
        'مساعد Suly الذكي للمهام الأساسية',
        'صياغة المراسلات ومراجعة التقارير',
      ],
      current: true,
    },
    {
      name: 'Business Pro',
      badge: 'الأعلى طلباً',
      price: '49 $',
      period: 'شهرياً',
      features: [
        '100,000 نقطة عمل شهرية',
        'أولوية معالجة فورية للمهام المؤسسية',
        'تحليل العقود والجداول المالية المتقدمة',
        'دعم فني مخصص للشركات',
      ],
      popular: true,
    },
    {
      name: 'Enterprise',
      badge: 'للمؤسسات',
      price: '199 $',
      period: 'شهرياً',
      features: [
        'نقاط غير محدودة للمهام المشتركة',
        'ربط برمجيات وأنظمة الإدارة الداخلية',
        'اتفاقية سرية بيانات مشددة SLA',
        'مدير حساب استراتيجي مباشر',
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-50 w-full max-w-2xl bg-[#1F1F1F] border border-[#262626] rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#262626] flex items-center justify-center text-[#0EA5E9]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-white">ترقية باقة Suly للشركات</h3>
              <p className="text-[12px] text-[#A1A1AA]">اختر الباقة المناسبة لاحتياجات فريقك ومؤسستك</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-[#262626] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                p.popular
                  ? 'bg-[#111111] border-[#0EA5E9]'
                  : 'bg-[#111111] border-[#262626]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[16px] font-bold text-white">{p.name}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.popular
                        ? 'bg-[#0EA5E9]/15 text-[#0EA5E9]'
                        : 'bg-[#262626] text-[#A1A1AA]'
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>

                <div className="my-3">
                  <span className="text-[26px] font-bold text-white">{p.price}</span>
                  <span className="text-[11px] text-[#A1A1AA] mr-1">{p.period}</span>
                </div>

                <div className="space-y-2 mt-4 pt-3 border-t border-[#262626]">
                  {p.features.map((f, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[12px] text-[#D1D5DB]">
                      <Check className="w-3.5 h-3.5 text-[#0EA5E9] shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                {p.current ? (
                  <button
                    disabled
                    className="w-full h-10 bg-[#262626] text-[#A1A1AA] rounded-full text-xs font-bold cursor-default"
                  >
                    الخطة الحالية
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onUpgradePlan(p.name);
                      onClose();
                    }}
                    className={`w-full h-10 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      p.popular
                        ? 'bg-white text-black hover:bg-zinc-200'
                        : 'bg-[#262626] text-white hover:bg-[#333333]'
                    }`}
                  >
                    ترقية الآن
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

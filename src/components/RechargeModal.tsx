import React, { useState } from 'react';
import { X, Check, Zap } from 'lucide-react';

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmRecharge: (points: number, title: string) => void;
}

export const RechargeModal: React.FC<RechargeModalProps> = ({
  isOpen,
  onClose,
  onConfirmRecharge,
}) => {
  const [selectedPackage, setSelectedPackage] = useState<number>(5000);

  if (!isOpen) return null;

  const packages = [
    { points: 1000, label: 'باقة البدء السريع', cost: '15 $' },
    { points: 5000, label: 'باقة الأعمال الموصى بها', cost: '60 $', popular: true },
    { points: 10000, label: 'باقة المؤسسات الكبرى', cost: '100 $' },
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
      <div className="relative z-50 w-full max-w-md bg-[#1F1F1F] border border-[#262626] rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#111111] border border-[#262626] flex items-center justify-center text-[#4ADE80]">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-white">شحن رصيد النقاط</h3>
              <p className="text-[11px] text-[#A1A1AA]">إضافة رصيد فوري للعمليات والمهام</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-[#262626] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Package Selector */}
        <div className="my-4 space-y-2.5">
          {packages.map((pkg) => {
            const isSelected = selectedPackage === pkg.points;
            return (
              <div
                key={pkg.points}
                onClick={() => setSelectedPackage(pkg.points)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-[#111111] border-[#0EA5E9] shadow-sm'
                    : 'bg-[#111111] border-[#262626] hover:border-[#333333]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      isSelected
                        ? 'border-[#0EA5E9] bg-[#0EA5E9] text-white'
                        : 'border-[#262626] bg-[#1F1F1F]'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-white tabular-nums">
                        +{pkg.points.toLocaleString('en-US')} نقطة
                      </span>
                      {pkg.popular && (
                        <span className="text-[10px] bg-[#0EA5E9]/15 text-[#0EA5E9] font-bold px-2 py-0.5 rounded-full">
                          موصى به
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#A1A1AA]">{pkg.label}</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-white tabular-nums">{pkg.cost}</span>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center gap-3">
          <button
            onClick={() => {
              onConfirmRecharge(selectedPackage, 'شحن رصيد نقاط');
              onClose();
            }}
            className="flex-1 h-11 bg-white text-black hover:bg-zinc-200 active:scale-[0.98] rounded-full font-bold text-sm transition-all cursor-pointer"
          >
            تأكيد الشحن الفوري
          </button>
          <button
            onClick={onClose}
            className="px-5 h-11 bg-[#262626] text-white hover:bg-[#333333] active:scale-[0.98] rounded-full font-semibold text-sm transition-all cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

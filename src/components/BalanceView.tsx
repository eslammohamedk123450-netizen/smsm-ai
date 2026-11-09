import React, { useRef } from 'react';
import { TransactionRecord } from '../types';
import { MessageSquare, Image as ImageIcon, FileText, Zap, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface BalanceViewProps {
  balance: number;
  transactions: TransactionRecord[];
  onOpenRecharge: () => void;
  onOpenUpgrade: () => void;
  planName?: string;
}

export const BalanceView: React.FC<BalanceViewProps> = ({
  balance,
  transactions,
  onOpenRecharge,
  onOpenUpgrade,
  planName = 'Free',
}) => {
  const historyRef = useRef<HTMLDivElement>(null);

  // Group transactions by date
  const groupedTransactions = transactions.reduce<Record<string, TransactionRecord[]>>(
    (acc, transaction) => {
      if (!acc[transaction.date]) {
        acc[transaction.date] = [];
      }
      acc[transaction.date].push(transaction);
      return acc;
    },
    {}
  );

  const scrollToHistory = () => {
    historyRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Calculate monthly consumption
  const monthlyConsumed = 2340;
  const monthlyTotal = 10100;
  const percentage = Math.min(100, Math.round((monthlyConsumed / monthlyTotal) * 100));

  return (
    <div className="flex-1 w-full overflow-y-auto custom-scrollbar px-4 py-6 max-w-2xl mx-auto space-y-6">
      {/* 1. الكارت العلوي: خلفية #111111 و borderRadius 16 و padding 16 */}
      <div className="bg-[#111111] rounded-[16px] p-[16px] border border-[#262626] shadow-sm">
        {/* Top of Card:
            على اليمين "Free" بالأبيض Bold، وعلى اليسار زر "ترقية" خلفية بيضاء ونص أسود و borderRadius 999 */}
        <div className="flex items-center justify-between">
          <span className="text-white font-bold text-[18px]">{planName}</span>
          <button
            onClick={onOpenUpgrade}
            className="bg-[#FFFFFF] text-[#000000] hover:bg-zinc-200 active:scale-95 rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer select-none"
          >
            ترقية
          </button>
        </div>

        {/* Dotted/Dashed line #262626 */}
        <div className="border-b border-dashed border-[#262626] my-4" />

        {/* Current Balance Label & Big Number:
            "الرصيد الحالي" بلون #A1A1AA حجم 13، وتحته الرقم كبير أبيض #F5F5F5 حجم 32 Bold */}
        <div>
          <div className="text-[13px] text-[#A1A1AA] font-normal">الرصيد الحالي</div>
          <div className="text-[32px] font-bold text-[#F5F5F5] tracking-tight tabular-nums mt-0.5">
            {balance.toLocaleString('en-US')}
          </div>
        </div>

        {/* Sub-line:
            سطر صغير: "يتم تحديث الرصيد يوميا في 23:00 إلى 3:00" بلون #A1A1AA */}
        <div className="text-[11px] text-[#A1A1AA] font-normal mt-1 mb-5">
          يتم تحديث الرصيد يوميا في 23:00 إلى 3:00
        </div>

        {/* Two buttons:
            تحته زرارين: "اشحن رصيد" خلفية بيضاء ونص أسود، و "السجل" خلفية #262626 ونص أبيض */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenRecharge}
            className="flex-1 h-11 bg-[#FFFFFF] text-[#000000] hover:bg-zinc-200 active:scale-95 rounded-full font-bold text-sm transition-all cursor-pointer flex items-center justify-center select-none"
          >
            اشحن رصيد
          </button>
          <button
            onClick={scrollToHistory}
            className="flex-1 h-11 bg-[#262626] text-[#FFFFFF] hover:bg-[#333333] active:scale-95 rounded-full font-bold text-sm transition-all cursor-pointer flex items-center justify-center select-none"
          >
            السجل
          </button>
        </div>
      </div>

      {/* 2. كارت الاستهلاك:
          عنوان "استهلاك هذا الشهر" + Progress Bar، الخلفية #262626 والجزء الممتلئ #0EA5E9،
          وتحته نص "استخدمت 2,340 من 10,100 نقطة" */}
      <div className="bg-[#111111] rounded-[16px] p-[16px] border border-[#262626]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-bold text-[#F5F5F5]">استهلاك هذا الشهر</h3>
          <span className="text-[12px] font-bold text-[#0EA5E9] tabular-nums">
            {percentage}%
          </span>
        </div>

        {/* Progress Bar: background #262626, filled part #0EA5E9 */}
        <div className="w-full h-2.5 bg-[#262626] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0EA5E9] rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Subtitle text */}
        <div className="text-[13px] text-[#A1A1AA] font-normal mt-2.5">
          استخدمت {monthlyConsumed.toLocaleString('en-US')} من {monthlyTotal.toLocaleString('en-US')} نقطة
        </div>
      </div>

      {/* 3. قسم "سجل الاستهلاك" داخل نفس الصفحة:
          تجميع العمليات حسب التاريخ، عنوان التاريخ بالرمادي مثل "9 نوفمبر 2026" */}
      <div ref={historyRef} className="space-y-4 pt-2">
        <h3 className="text-[16px] font-bold text-[#F5F5F5]">سجل الاستهلاك</h3>

        {Object.keys(groupedTransactions).length === 0 ? (
          <div className="bg-[#111111] rounded-[12px] p-6 text-center border border-[#262626]">
            <p className="text-[13px] text-[#A1A1AA]">لا توجد عمليات استهلاك مسجلة حتى الآن.</p>
          </div>
        ) : (
          Object.entries(groupedTransactions).map(([date, items]) => (
            <div key={date} className="space-y-2">
              {/* عنوان التاريخ بالرمادي مثل "9 نوفمبر 2026" */}
              <div className="text-[11px] font-normal text-[#A1A1AA] px-1 select-none">
                {date}
              </div>

              {/* كل عملية في كارت: خلفية #111111 و borderRadius 12 و padding 12 */}
              {items.map((record) => {
                const getIcon = () => {
                  switch (record.type) {
                    case 'recharge':
                      return <Zap className="w-4 h-4 text-[#4ADE80]" />;
                    case 'image':
                      return <ImageIcon className="w-4 h-4 text-[#0EA5E9]" />;
                    case 'document':
                      return <FileText className="w-4 h-4 text-[#0EA5E9]" />;
                    case 'chat':
                    default:
                      return <MessageSquare className="w-4 h-4 text-[#0EA5E9]" />;
                  }
                };

                return (
                  <div
                    key={record.id}
                    className="bg-[#111111] rounded-[12px] p-[12px] border border-[#262626] flex items-center justify-between gap-3 hover:border-[#333333] transition-colors"
                  >
                    {/* Right side (RTL start):
                        على اليمين أيقونة دائرية حسب النوع + في النص: عنوان مختصر من 3 كلمات فقط + سطر صغير: نوع العملية + عدد النقاط */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#1F1F1F] border border-[#262626] flex items-center justify-center shrink-0">
                        {getIcon()}
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-[#F5F5F5] leading-tight">
                          {record.title}
                        </span>
                        <span className="text-[11px] text-[#A1A1AA] mt-0.5">
                          {record.typeLabel} • {record.points.toLocaleString('en-US')} نقطة
                        </span>
                      </div>
                    </div>

                    {/* Left side (RTL end):
                        على اليسار: المبلغ بصيغة "-131" باللون #F87171 وليس "131-"، وتحته الوقت
                        الشحن يظهر باللون #4ADE80 مع علامة + */}
                    <div className="flex flex-col items-end shrink-0">
                      {record.isCredit ? (
                        <span
                          dir="ltr"
                          className="text-[#4ADE80] font-bold text-[14px] tabular-nums"
                        >
                          +{record.points.toLocaleString('en-US')}
                        </span>
                      ) : (
                        <span
                          dir="ltr"
                          className="text-[#F87171] font-bold text-[14px] tabular-nums"
                        >
                          -{record.points.toLocaleString('en-US')}
                        </span>
                      )}
                      <span className="text-[11px] text-[#A1A1AA] mt-0.5 tabular-nums">
                        {record.time}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

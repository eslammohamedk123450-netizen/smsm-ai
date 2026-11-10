# تنفيذ نظام العقول المتدرجة ولوحة النماذج

## النطاق

أُضيف نظام جديد بجانب `ai-router` الحالي دون تعديل ملفاته أو تغيير مسار المحادثات الحالي. نقطة الدخول الجديدة هي `brain-router`، ويمكن استدعاؤها من `runBrainTask`، بينما يستمر التطبيق الحالي في استخدام `ai-router` للحفاظ على التوافق.

## المكونات

- `models`: كتالوج مستقل مع `legacy_ai_model_id` اختياري لربط النموذج بمشغل `ai_models` الحالي.
- `capabilities`: القدرات الثابتة: `text`, `coding`, `image`, `video`, `vision`, `audio`, `reasoning`, `web_search`.
- `model_capabilities`: علاقة many-to-many.
- `brain_tiers`: Router/Worker/Planner/Merger مع أولوية 1–3 وحد أقصى للتوكنات.
- `plans`: free/pro/max مع tier البداية وحد المهام والتوكنات اليومية.
- `brain_usage_daily` و`brain_usage_events`: حجز ذري للتوكنات والمهام لمنع تجاوز الحدود عند الطلبات المتزامنة.
- `brain_task_contexts`, `brain_task_steps`, `brain_attempt_logs`: مساحة العمل المشتركة والنتائج وسجل fallback.
- `BrainSystemAdminScreen`: إدارة القدرات، النماذج، ربط القدرات، ترتيب tiers، وحدود الخطط.

## سلوك التشغيل

1. يتحقق `brain-router` من هوية المستخدم وحظر الحساب.
2. يحجز ميزانية يومية محسوبة من الحدود المكوّنة في tiers، وليس عدد خطوات ثابتًا.
3. يستدعي Router الأرخص المرتبط بـ`ai_models` لتحديد التعقيد والقدرات وعدد الخطوات المتوقع.
4. للمهمة المعقدة، يستدعي Planner لإنشاء خطوات تحتوي capability والوصف والمدخلات المتوقعة.
5. ينفذ Worker كل خطوة، ويجرب النماذج بالترتيب حسب priority داخل نفس tier عند timeout/error/empty response.
6. يستدعي Merger لتجميع النتائج، مع fallback إلى نتائج Workers إذا لم يتوفر Merger.
7. يسجل كل محاولة فاشلة وسببها، ويحدّث task_context والـsteps، ثم يصحح الاستخدام الفعلي داخل الحجز الذري.

## السلامة والتوافق

- لا حذف لأي كود قديم.
- لا تغيير لـ`ai-router` أو جداول الرصيد الحالية.
- جميع جداول الإدارة محمية بـRLS و`public.suly_is_admin()`.
- جداول الاستخدام وسجل المحاولات متاحة لـservice role فقط.
- النموذج الجديد غير المرتبط بـ`ai_models` لا يمكن تشغيله داخل brain-router حتى يتم ربطه، لتجنب استدعاء مزود دون مسار آمن للمفتاح.
- migration لم تُطبق على الإنتاج.

## التحقق

- Mobile TypeScript: نجح.
- Mobile tests: 17 suites / 102 tests نجحت.
- Web build: نجح.
- `git diff --check`: نجح.
- Edge Function typecheck: لم يُشغّل لعدم توفر Deno محليًا.
- SQL migration lint/apply: لم يُشغّل لعدم توفر Supabase CLI و`psql`، ويجب تطبيقه أولًا على staging.

## خطة التفعيل

1. تطبيق `045_brain_system.sql` في staging.
2. التأكد من إنشاء capabilities/plans وربط النماذج الحالية وتكوين tiers.
3. نشر `brain-router` في staging.
4. اختبار free/pro/max، والتزامن، وتجاوز daily task/token limits، وفشل Router/Worker/Merger.
5. اختبار anon/authenticated/admin والمستخدم المحظور.
6. بعد الموافقة، نشر migration/function ثم تفعيل استدعاء brain-router من واجهة مقصودة. المسار الحالي لا يتغير تلقائيًا لتجنب تغيير تجربة المحادثة الموجودة.

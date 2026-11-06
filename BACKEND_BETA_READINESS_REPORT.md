# Backend Beta Readiness Report

## A. Migrations التي تم تنفيذها

| Migration | السبب | النطاق | قابلة للتراجع؟ | دون حذف بيانات؟ | الحالة |
|---|---|---|---|---|---|
| `closed_text_beta_hardening` | منع كشف بيانات مزودي الخدمة وإضافة حارس استخدام ذري لكل مستخدم | `ai_providers_catalog`, `suly_ai_rate_limits`, `suly_check_ai_rate_limit(uuid)` | نعم عمليًا عبر Migration عكسية؛ لا يُنفذ rollback تلقائيًا | نعم | APPLIED |
| `restrict_provider_catalog_privileges` | تصحيح صلاحيات View لتكون القراءة فقط للمستخدم المصادق | `ai_providers_catalog` grants | نعم | نعم | APPLIED |

تم حفظ النسختين في `supabase/migrations/011_closed_text_beta_hardening.sql` و`supabase/migrations/012_restrict_provider_catalog_privileges.sql`، وتم تطبيقهما على مشروع Supabase `SULY AI AGNIT` (`razvryvazmqvvqkzetuo`). لم تُحذف جداول أو أعمدة أو بيانات.

## B. تغييرات RLS

| الجدول | العملية | السياسة/التحكم | من يستطيع الوصول | نتيجة الاختبار |
|---|---|---|---|---|
| `ai_providers` | SELECT/INSERT/UPDATE/DELETE | تم سحب صلاحيات `public`, `anon`, `authenticated`؛ الوصول الخادمي محفوظ لـ `service_role` | Edge Functions الخادمية فقط | PASS عبر فحص الصلاحيات؛ اختبار مستخدمين فعليين NOT_TESTED |
| `ai_providers_catalog` | SELECT | View آمن يعرض بيانات الكتالوج غير السرية فقط | `authenticated` قراءة فقط | PASS عبر فحص grants؛ لا يعرض `api_key`, `encrypted_api_key`, أو Vault IDs |
| `suly_ai_rate_limits` | ALL | RLS مفعّل وسياسة رفض للعميل | `service_role` فقط | PASS عبر فحص RLS/grants |
| `suly_profiles`, `suly_conversations`, `suly_messages`, `agent_memories` | القراءة/الكتابة | السياسات الحالية المعتمدة على `auth.uid()` بقيت ولم تُحذف | مالك السجل، مع قيود الإدارة الحالية | NOT_TESTED بحسابين حقيقيين |

## C. تغييرات Auth وFunctions وCORS

- `ai-router` المنشور كان مضبوطًا على `verify_jwt=true`، واختبار طلب POST بلا JWT أعاد `401 UNAUTHORIZED_NO_AUTH_HEADER`.
- أضيف في نسخة المستودع من `ai-router` تحقق ذري من `suly_check_ai_rate_limit`، وحدود: 20 رسالة، 16,000 حرف لكل رسالة، 50,000 حرف للسياق، و4,096 حدًا أقصى لرموز الإخراج.
- أزيل fallback الخاص بـ `Access-Control-Allow-Origin: *` من نسخة المستودع؛ Web يحتاج ضبط `WEB_CORS_ORIGIN` صراحة. تطبيق Android/iOS لا يعتمد على CORS.
- لم أغيّر إعداد Auth الخاص بحماية كلمات المرور المسربة لأن أداة Supabase المتاحة في هذه الجلسة لا تعرض تعديل إعداد Auth. حالة Supabase الحالية: `auth_leaked_password_protection` = BLOCKER/NOT_FIXED.
- كود `ai-router` المعدل محفوظ في GitHub، لكن نشر نسخة Edge Function المعدلة يحتاج خطوة نشر منفصلة؛ النسخة الحية التي اختبرتها ما زالت تعرض CORS wildcard. لذلك لا أدّعي أن تغييرات CORS وRate Limit في Edge Function أصبحت حية بعد.

## D. حالة Secrets

| Secret/المكوّن | الحالة | الملاحظة |
|---|---|---|
| Provider API key في أعمدة `ai_providers` | MISSING | فحص الوجود فقط؛ لا توجد قيمة مطبوعة |
| Provider Vault credential | MISSING | `api_key_vault_id` غير موجود للمزود الحالي |
| `SUPABASE_SERVICE_ROLE_KEY` في Edge runtime | NOT_CHECKED | لم تُطبع أي قيمة |
| `WEB_CORS_ORIGIN` | MISSING | مطلوب فقط عند تفعيل Web؛ Android/iOS لا يحتاجه |
| Embeddings provider credential | REQUIRED_FOR_DEFERRED_FEATURE | الذاكرة طويلة المدى ليست جاهزة |
| Tavily/Web Search | REQUIRED_FOR_DEFERRED_FEATURE | لم تُختبر الميزة |
| GitHub/Gmail tokens | REQUIRED_FOR_DEFERRED_FEATURE | لم تُفعّل أدواتها في البيتا |

## E. حدود الاستخدام

- الحد اليومي: 60 طلبًا لكل مستخدم.
- الحد الزمني: طلب واحد كل 3 ثوانٍ لكل مستخدم.
- الحد الأقصى لعدد الرسائل في الطلب: 20.
- الحد الأقصى للرسالة الواحدة: 16,000 حرف.
- الحد الأقصى للسياق: 50,000 حرف.
- الحد الأقصى للإخراج: 4,096 token.
- timeout وإعادة المحاولة والـ provider health كانت موجودة في التصميم الحالي؛ لم يتم تغييرها تدميريًا.

ملاحظة مهمة: حارس قاعدة البيانات مطبق، لكن استدعاءه من نسخة `ai-router` الحية ينتظر نشر نسخة الكود المعدلة.

## F. الميزات المؤجلة

- Vision: DEFERRED / NOT_TESTED.
- PDF/Word: DEFERRED / NOT_TESTED.
- Web Search: DEFERRED / NOT_TESTED.
- GitHub/Gmail: DEFERRED / NOT_TESTED.
- Long-term Memory: DEFERRED؛ لا يوجد Embeddings provider صالح مؤكد، ولا تُعرض كميزة جاهزة.
- Billing/Credits: DEFERRED؛ التسعير والخصم غير مفعّلين بالكامل، ولا تُعرض العملات كنظام جاهز.

## G. الاختبارات

| الاختبار | النتيجة | التفاصيل |
|---|---|---|
| ai-router بلا JWT | PASS | HTTP 401 من endpoint الحي |
| JWT صحيح | NOT_TESTED | لا يوجد حساب اختبار/توكن يُستخدم بأمان في الجلسة |
| User A لا يرى User B | NOT_TESTED | يحتاج حسابي اختبار منفصلين |
| User عادي لا يستدعي admin functions | NOT_TESTED | لم تُستخدم حسابات اختبار فعلية |
| مفاتيح المزود لا تظهر | PASS جزئي | جدول `ai_providers` سُحبت صلاحيات العميل منه، وView الكتالوج لا يحتوي حقول المفاتيح؛ اختبار REST بحساب عميل NOT_TESTED |
| رسالة فارغة ترفض | PASS في مصدر المستودع / NOT_TESTED حيًا بعد التعديل | المصدر يرفضها؛ Edge live يحتاج نشر النسخة المعدلة |
| رسالة أكبر من الحد ترفض | PASS في مصدر المستودع / NOT_TESTED حيًا بعد التعديل | 16,000 حرف لكل رسالة و50,000 للسياق |
| تجاوز الحد يرفض | PASS في Migration / NOT_TESTED حيًا بعد التعديل | RPC ذري مطبق؛ استدعاء Edge live ينتظر النشر |
| Provider failure يعطي خطأ مفهومًا | NOT_TESTED | لا يوجد Provider credential صالح للاختبار |
| Memory failure لا يكسر الدردشة | NOT_TESTED | الميزة مؤجلة ولا يوجد Embedding credential مؤكد |
| Secrets مطبوعة في التقرير أو GitHub | PASS | لم تتم طباعة أو إضافة أي قيمة سرية |

## H. الحكم النهائي

# BACKEND_READY_WITH_BLOCKERS

السبب: عزل بيانات مزودي الخدمة وMigration حدود الاستخدام مطبقان دون حذف بيانات، و`ai-router` الحي يرفض الطلبات بلا JWT. لكن النسخة المعدلة من Edge Function لم تُنشر بعد، وحماية كلمات المرور المسربة ما زالت معطلة، واختبارات العزل بحسابين واختبار Provider حقيقي لم تُنفذ، ولا يوجد Provider/Vault credential صالح مؤكد. لذلك لا يصح إعلان `BACKEND_READY_FOR_CLOSED_TEXT_BETA` قبل نشر Edge Function المعدلة وإتمام اختبارات الحسابين وإعداد Auth/Secrets اللازمة.

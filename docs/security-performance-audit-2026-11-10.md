# SULY AI — تقرير مراجعة الأمن والأداء

**التاريخ:** 2026-11-10  
**المستودع:** `eslammohamedk123450-netizen/smsm-ai`  
**الفرع الأساسي:** `release/v1`  
**Commit الأساس:** `466eeee96ef97e87c381d33d5e884b5614a7685d`  
**فرع العمل المؤقت:** `audit/security-performance-20261110`  
**Supabase:** `razvryvazmqvvqkzetuo` — PostgreSQL 17.11 — ACTIVE_HEALTHY

## ملخص تنفيذي

تم إجراء فحص قراءة فقط للمستودع وقاعدة البيانات وSupabase Advisor قبل التعديل. لم تُعد migration `admin_audit_and_admin_read_access`، ولم يُفعّل وضع الصيانة، ولم تُغيّر أرصدة أو اشتراكات أو بيانات مستخدمين حقيقية.

نُفذ إصلاحان محدودان على فرع العمل فقط:

1. إضافة `supabase/migrations/044_audit_sensitive_value_redaction.sql` لتوسيع تنقية `old_value/new_value` في سجل التدقيق، مع حذف قيمة `system_settings` عندما يكون `is_sensitive=true`.
2. تحويل شاشة `AdminAuditScreen` من جلب 500 سجل وتصفية محلية إلى `count + range` مع filters خادمية وحجم صفحة 100 وأزرار تنقل.

**لم يُنشر أي تغيير إلى Supabase، ولم يُنشأ PR أو merge بعد.** السبب: لا توجد بيئة staging مؤكدة في المهمة، وتعليمات المهمة تمنع تغيير الإنتاج غير المختبر.

## الخط الأساس والأدلة

- `release/v1` محمي: enforce admins مفعّل، force-push والحذف غير مسموحين، والمستودع العام لا يسمح بتجاوز الفرع.
- HEAD المحلي و`origin/release/v1` يطابقان commit الأساس المذكور.
- migration المسجلة `20261110122533 / admin_audit_and_admin_read_access` موجودة بالفعل في Supabase ولم تُعد تطبيقها.
- الجداول الأساسية كما ظهرت من الإحصاءات: `suly_messages` نحو 406 صفًا، `suly_conversations` نحو 103، `suly_ai_request_events` نحو 201، `ai_model_attempt_logs` نحو 10,562، و`admin_audit_logs` نحو 17.
- `ai-router` منشور بالإصدار 23، و`verify_jwt=true`. الدالة `model-health-check` هي الاستثناء المنشور مع `verify_jwt=false`.
- `suly_rewarded_ad_claims` لديها RLS مفعّل بلا policies، وحقوق الجدول محجوبة عن `anon` و`authenticated`، كما أن `claim_rewarded_ad(uuid)` لا يملك `authenticated` حق EXECUTE حاليًا. لذلك لم تُضف policy عامة أو grant يتجاوز أقل الصلاحيات.

## جدول findings

| Finding | الدليل | الخطورة/الاحتمال | التصنيف | الإجراء | اختبار التحقق | الخطر الجانبي |
|---|---|---:|---|---|---|---|
| claims بلا RLS policies | Advisor: `rls_enabled_no_policy` على `public.suly_rewarded_ad_claims` | منخفض/متوسط | مقصود حاليًا ويحتاج اختبار مسار الخادم | لا policy عامة؛ الإبقاء على revoke من العميل، والتحقق من claim ذريًا في RPC/خدمة موثوقة | anon/authenticated لا يستطيعان SELECT/INSERT/UPDATE؛ service path فقط | تظل المكافأة متوقفة للعميل حتى تفعيل تحقق AdMob server-side |
| أدمن RPCs قابلة لـauthenticated | Advisor رصد 32 دالة SECURITY DEFINER | متوسط/متوسط | مقصود عند RPCs التي تفحص `suly_is_admin()` | تمت مطابقة الدوال الحالية: دوال الإدارة المنشورة تفحص الأدمن أو تقيد التنفيذ؛ لا سحب عشوائي لـEXECUTE | استدعاء مباشر بهوية عادية يجب أن يرفض؛ يتطلب staging ومستخدمين اختبار | سحب grants بلا اختبار قد يكسر لوحة الأدمن |
| public share RPC | `suly_get_public_conversation(uuid)` متاحة لـanon/authenticated | متوسط/منخفض | مقصود لروابط المشاركة | الرمز UUID، المشاركة opt-in عبر `share_token`، والرد يعرض العنوان والرسائل فقط مع حد 300 | token فارغ/عشوائي/لمحادثة خاصة لا يعيد محتوى؛ token منشور يعيد المحتوى المقصود | نشر رابط المشاركة يظل إفصاحًا مقصودًا لحامل الرابط |
| audit قد يسجل قيمة سرية | trigger القديم يستبعد أسماء محددة فقط؛ `system_settings.value` قد تكون حساسة | عالٍ/متوسط | عولج على فرع العمل | migration 044 توسع الاستبعاد وتزيل قيمة الإعداد الحساس | تحديث setting حساس ثم فحص `old_value/new_value` دون قراءة القيمة؛ يلزم staging | قد يقل تفصيل سجل التغيير لإعداد حساس، وهو مطلوب أمنيًا |
| audit filters محلية | الشاشة كانت تجلب 500 وتفلتر type/date/search على الجهاز | متوسط/متوسط | عولج على فرع العمل | `count + range(100)` وفلاتر الخادم وترقيم صفحات | بيانات كثيرة مع filters يجب ألا تتجاوز الصفحة 100 | بحث اسم الأدمن لم يعد ضمن filter SQL؛ يظهر عبر profile للصفحة المحملة فقط ويحتاج endpoint/relationship لاحقًا |
| extension in public | Advisor رصد `vector` و`pg_net` في public | متوسط/منخفض | يحتاج قرار/staging | لم تُنقل الامتدادات؛ الاعتماد الفعلي على vector وpg_net يحتاج اختبار ترحيل وإصدار وrollback | staging: فحص الأنواع والدوال وEdge Functions ثم migration reversible | النقل غير المختبر قد يكسر RPCs وEdge Functions |
| unindexed foreign keys | Advisor رصد 38 علاقة | منخفض حاليًا/غير معروف عند النمو | يحتاج قياسات | لم تُضف فهارس عشوائية؛ يلزم EXPLAIN/pg_stat_statements وقياس write overhead | قياس الاستعلامات الفعلية قبل/بعد في staging | فهارس إضافية تزيد حجم التخزين وكلفة الكتابة |
| auth RLS initplan | Advisor رصد 29 policy | منخفض/متوسط | تحسين أداء مؤجل | لم تُغيّر 29 policy دفعة واحدة؛ يلزم migration صغيرة واختبار معنى RLS | EXPLAIN ومقارنة النتائج لكل role | صياغة policy غير دقيقة قد تغيّر الوصول الأمني |
| unused indexes | Advisor رصد 38 index | منخفض/غير مؤكد | يحتاج قرار | لم تُحذف؛ نافذة الاستخدام الحالية قصيرة | مراقبة `idx_scan` وعبء الاستعلامات عبر فترة تشغيل ممثلة | حذف مبكر قد يسبب regression بعد feature جديد |
| leaked password protection | Advisor: disabled | عالٍ/متوسط | يحتاج قرار تشغيل/خطة Auth | لم يُفعّل؛ يلزم تأكيد الخطة وأثر التسجيل وتغيير كلمة المرور | اختبار signup/password reset في staging ثم تفعيل من إعدادات Auth | قد يرفض كلمات مرور مستخدمين جدد دون خطة تواصل |

## التغييرات على فرع العمل

### Migration 044

- لا تحتوي `DROP` أو `TRUNCATE` أو إعادة كتابة جدول كبير.
- تعيد تعريف trigger موجودًا فقط.
- تستبعد: مفاتيح API، مفاتيح Vault، كلمات المرور، tokens، credentials وحقولًا سرية شائعة.
- إذا كان السجل من `system_settings` و`is_sensitive=true` فلا تُحفظ `value` في audit JSON.
- لا تُطبق تلقائيًا على الإنتاج.

### AdminAuditScreen

- حد الصفحة 100 بدل 500.
- `action`, `created_at`, `target_table/target_id` تُفلتر من الخادم.
- pagination بخادم Supabase عبر `range` و`count: exact`.
- لا يزال تحميل profile IDs للصفحة الحالية فقط.

## الاختبارات الفعلية

- `git diff --check`: نجح.
- mobile `npm run typecheck`: نجح.
- mobile `npm test -- --runInBand`: نجح — **17 suites، 102 tests، 0 failures**. ظهر تحذير Jest عن asynchronous operations مفتوحة بعد انتهاء الاختبارات.
- web `npm run build`: نجح — Vite production build اكتمل.
- web `npm run lint`: **فشل بسبب finding سابق غير متعلق بالتغيير**: `src/components/Sidebar.tsx:80`، تحويل `Object.fromEntries` إلى `Record<ConversationGroup, ConversationRecord[]>`.
- فحص diff بحثًا عن أسرار: لم يجد أسرارًا صريحة في التغييرات.
- لم تُنفذ اختبارات RLS متعددة الهويات على قاعدة الإنتاج، ولم تُشغّل migration 044 على staging؛ لا توجد نتيجة نجاح مدعاة لهذين الاختبارين.

## خطة النشر والاسترجاع

1. توفير أو إنشاء staging مؤكد بعد موافقة التكلفة إن كان Supabase سيحجز branch مدفوعًا.
2. تطبيق migration 044 على staging فقط.
3. اختبار trigger للـinsert/update/delete على `system_settings` حساس وغير حساس، و`ai_providers`، مع فحص عدم ظهور القيم السرية.
4. اختبار anon، authenticated عادي، admin، ومستخدم محظور لكل RPC حساس، دون تغيير بيانات حقيقية.
5. تشغيل typecheck/tests/build وإصلاح lint القديم أو توثيق PR مستقل له.
6. بعد موافقة صريحة على النشر، تطبيق migration على الإنتاج في نافذة منخفضة المخاطر ثم تشغيل Advisor مجددًا.
7. الاسترجاع: migration 044 قابلة للاسترجاع بإعادة تعريف trigger إلى النسخة السابقة، لكن ذلك لا يعيد أي قيم سرية حُذفت من سجلات جديدة؛ لذلك لا يُنصح بالتراجع الأمني إلا لسبب قاهر.

## ما تم نشره وما يحتاج موافقة

- **تم نشره إلى Supabase:** لا شيء.
- **تم نشره إلى GitHub:** لا شيء.
- **تم تغيير الإنتاج:** لا شيء.
- **يحتاج موافقة/قرار:** إنشاء staging إن كان مدفوعًا، تطبيق migration 044 على staging ثم الإنتاج، نقل extensions، تفعيل leaked password protection، وإصلاح lint القديم.

## تحسينات اختيارية مستقبلية

- endpoint/relationship لبحث audit باسم الأدمن من الخادم بدل البحث في IDs المحملة.
- مراقبة latency/error rate وEdge Function invocations مع تنبيهات حدود الاستهلاك.
- سياسة احتفاظ منفصلة لسجلات المحاولات التقنية مع حماية السجلات المالية والتدقيقية.
- فهارس محددة بعد EXPLAIN على استعلامات أحدث المحادثات وaudit، لا قبل ذلك.
- فحص صحي دوري للـRLS والـRPC grants ونسخة Advisor محفوظة للمقارنة.

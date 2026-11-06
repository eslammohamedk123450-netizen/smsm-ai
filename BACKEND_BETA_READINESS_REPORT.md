# SMSM AI Closed Beta Release Report

## 1. نطاق النسخة

`CLOSED TEXT-CHAT BETA`

المعلن فقط: التسجيل/الدخول، تسجيل الخروج، الدردشة النصية، اختيار نموذج متاح، استقبال رد نصي، أخطاء الاتصال، حدود الاستخدام، وعزل بيانات المستخدمين.

تم إخفاء Agent وVision من شاشة الدردشة. PDF/Word وWeb Search وGitHub/Gmail وLong-term Memory وBilling/Credits والإعلانات والأدوات الوهمية ليست ميزات معلنة في هذه النسخة.

## 2. الملفات البرمجية المعدلة

| المسار | المشكلة | الإصلاح | نتيجة التحقق |
|---|---|---|---|
| `lib/main.dart` | عدم وجود `BlocProvider` لـ `AuthCubit` و`ChatCubit`، وحماية `/chat` غير مكتملة | إضافة `MultiBlocProvider`، اشتراك auth state، حماية `/chat` و`/admin`، وفحص صلاحية admin | STATIC_CHECK_PASS؛ Flutter runtime NOT_TESTED |
| `lib/app_config.dart` | قيمة `your-anon-key-here` الافتراضية وقبول إعدادات تجريبية | القراءة من `SUPABASE_URL` و`SUPABASE_ANON_KEY` أو `SUPABASE_PUBLISHABLE_KEY` ورفض القيم المفقودة/التجريبية | STATIC_CHECK_PASS؛ Flutter build NOT_TESTED |
| `lib/features/chat/presentation/pages/chat_page.dart` | استدعاء `AgentCubit` غير المسجل، وعرض Vision والرصيد | إزالة Agent/Vision والرصيد من مسار البيتا، والتحقق من `mounted` بعد الإرسال | STATIC_CHECK_PASS؛ Flutter runtime NOT_TESTED |
| `lib/features/admin/presentation/pages/admin_dashboard_page.dart` | عرض Credits غير المختبرة | إزالة تبويب Credits من لوحة البيتا | STATIC_CHECK_PASS |
| `lib/features/chat/presentation/cubit/chat_cubit.dart` | احتمال تكرار الإرسال و`emit` بعد الإغلاق ورسائل خطأ تكشف تفاصيل داخلية | منع الإرسال أثناء streaming، حواجز `isClosed`، ورسائل خطأ آمنة | STATIC_CHECK_PASS؛ Flutter tests NOT_TESTED |
| `lib/features/chat/data/datasources/chat_remote_datasource.dart` | قراءة جدول مزودي الخدمة مباشرة | استخدام `ai_providers_catalog` الآمن | STATIC_CHECK_PASS |
| `lib/features/admin/presentation/widgets/api_keys_tab.dart` | قراءة جدول مزودي الخدمة مباشرة | استخدام `ai_providers_catalog` الآمن | STATIC_CHECK_PASS |
| `supabase/functions/ai-router/index.ts` | حدود قديمة وCORS wildcard في مصدر المستودع | إضافة حدود الرسائل والسياق والإخراج وRate Limit وCORS صريح عبر `WEB_CORS_ORIGIN` | SOURCE_CHECK_PASS؛ LIVE_DEPLOY_NOT_DONE |

## 3. Migrations المنفذة

| الاسم | السبب | الجداول المتأثرة | البيانات محفوظة؟ | قابلة للمراجعة؟ |
|---|---|---|---|---|
| `closed_text_beta_hardening` | عزل `ai_providers` وإضافة Rate Limit ذري | `ai_providers`, `ai_providers_catalog`, `suly_ai_rate_limits` | نعم، لم يحدث حذف | نعم، محفوظة في GitHub ومطبقة في Supabase |
| `restrict_provider_catalog_privileges` | جعل View القراءة فقط للمستخدم المصادق | `ai_providers_catalog` | نعم | نعم، محفوظة في GitHub ومطبقة في Supabase |

تم التحقق من تسجيل الـMigrations في Supabase. لا توجد `DROP TABLE` أو `DROP COLUMN` أو `TRUNCATE`.

## 4. Edge Functions المنشورة

| الاسم | رقم/معرف النشر | وقت النشر | اختبار endpoint الحي |
|---|---|---|---|
| `ai-router` | النسخة الحية السابقة: v11 | موجودة قبل هذه الجولة | PASS للطلب بلا JWT: HTTP 401 |
| `ai-router` المعدلة | NOT_PUBLISHED | NOT_APPLICABLE | NOT_TESTED؛ مصدرها محفوظ في GitHub لكن لم يتم نشره |

لا أعتبر تغييرات Rate Limit/CORS/limits منشورة في Edge Function الحية لمجرد وجودها في GitHub. النسخة الحية التي اختُبرت سابقًا ما زالت تعرض CORS wildcard.

## 5. Secrets

| Secret/اعتماد | الحالة |
|---|---|
| Provider API/Vault credential للنموذج | MISSING |
| `SUPABASE_URL` لتشغيل Flutter | REQUIRED_FOR_ENVIRONMENT |
| `SUPABASE_ANON_KEY` أو `SUPABASE_PUBLISHABLE_KEY` لتشغيل Flutter | REQUIRED_FOR_ENVIRONMENT |
| `SUPABASE_SERVICE_ROLE_KEY` داخل Flutter/GitHub | NOT_USED |
| `WEB_CORS_ORIGIN` | MISSING؛ مطلوب فقط عند تفعيل Web |
| Embeddings provider | REQUIRED_FOR_DEFERRED_FEATURE |
| Tavily/Web Search | REQUIRED_FOR_DEFERRED_FEATURE |
| GitHub/Gmail credentials | REQUIRED_FOR_DEFERRED_FEATURE |

لم تُطبع أي قيمة Secret أو Token أو Password في التقرير أو Git diff.

## 6. اختبارات Flutter والبناء

| الاختبار | PASS | FAIL | NOT_TESTED | التفاصيل |
|---|---:|---:|---:|---|
| وجود Flutter SDK |  |  | نعم | الأمر `flutter` غير موجود |
| `dart format` |  |  | نعم | Dart SDK غير موجود |
| `flutter pub get` |  |  | نعم | Flutter SDK غير موجود |
| `flutter analyze` |  |  | نعم | Flutter SDK غير موجود |
| `flutter test` |  |  | نعم | Flutter SDK غير موجود |
| Android/iOS/Web platform files |  |  | نعم | المجلدات الثلاثة غير موجودة |
| Debug APK/Web build |  |  | نعم | لا توجد أداة أو منصة للبناء |
| تشغيل LoginPage والتسجيل |  |  | نعم | لا يوجد runtime |
| تشغيل `/chat` |  |  | نعم | لا يوجد runtime |
| تشغيل الناتج النهائي |  |  | نعم | لا يوجد artifact |
| فحص static للتغييرات | نعم |  |  | `git diff --check` وعمليات البحث الأمنية المحلية نجحت |

الحكم الخاص بالبيئة: `FLUTTER_BUILD_NOT_VERIFIED`.

## 7. اختبارات Auth وRLS

| الاختبار | النتيجة | التفاصيل |
|---|---|---|
| `ai-router` بلا JWT | PASS | endpoint الحي أعاد HTTP 401 `UNAUTHORIZED_NO_AUTH_HEADER` |
| JWT صحيح ينجح | NOT_TESTED | لا يوجد Provider credential أو حساب اختبار آمن |
| فتح `/chat` دون تسجيل | STATIC_CHECK_PASS / RUNTIME_NOT_TESTED | redirect موجود في `main.dart` |
| الخروج يعيد المستخدم | STATIC_CHECK_PASS / RUNTIME_NOT_TESTED | auth stream وredirect موجودان |
| User A يرى بياناته فقط | NOT_TESTED | يتطلب حسابي اختبار فعليين |
| User A لا يقرأ User B | NOT_TESTED | يتطلب حسابي اختبار فعليين |
| User A لا يعدل User B | NOT_TESTED | يتطلب حسابي اختبار فعليين |
| المستخدم العادي لا يستدعي admin | NOT_TESTED | يتطلب حساب اختبار فعلي |
| `api_key` لا يظهر للعميل | PASS جزئي | صلاحيات `ai_providers` مسحوبة، والـView لا يحتوي أعمدة الأسرار؛ اختبار REST بحساب Flutter NOT_TESTED |
| RLS للجداول الخاصة | PASS جزئي | تمت مراجعة السياسات الموجودة، اختبار User A/B NOT_TESTED |
| Security advisors | BLOCKER_OPEN | leaked password protection معطلة، وتحذيرات SECURITY DEFINER قائمة |

## 8. حدود الاستخدام والتكلفة

- حد يومي: 60 طلبًا لكل مستخدم.
- حد زمني: 3 ثوانٍ بين الطلبات.
- حد الرسائل: 20 رسالة.
- حد الرسالة: 16,000 حرف.
- حد السياق: 50,000 حرف.
- حد الإخراج: 4,096 token.
- Retry في SSE محدود إلى 3 محاولات.
- Billing/Credits: مؤجلة/غير مفعلة؛ إعداد `suly_credit_pricing.enabled` الحالي `false`، وتم إخفاء Credits من واجهة البيتا.
- Rate Limit في قاعدة البيانات مطبق، لكن استدعاءه من نسخة `ai-router` الحية ينتظر نشر الكود المعدل.

## 9. الميزات المؤجلة

- Vision: مؤجلة ومخفية.
- PDF/Word: مؤجلة وغير معلنة.
- Web Search: مؤجلة وغير معلنة؛ الأدوات الحالية تتضمن Mock logic.
- GitHub/Gmail: مؤجلة وغير معلنة.
- Long-term Memory: مؤجلة لعدم وجود Embeddings provider صالح ومختبر.
- Billing/Credits: مؤجلة وغير معلنة.

## 10. المشاكل المتبقية

| الخطورة | تمنع البيتا؟ | المطلوب | المسؤول |
|---|---|---|---|
| CRITICAL | نعم | توفير Flutter SDK والمنصات، تشغيل analyze/test وبناء وتشغيل artifact فعلي | Environment |
| CRITICAL | نعم | ربط Provider credential صالح في Vault واختبار رد حقيقي | Backend/Environment |
| HIGH | نعم | نشر نسخة `ai-router` المعدلة ثم اختبار endpoint الحي والlimits | Backend |
| HIGH | نعم إذا فُتح التسجيل العام | تفعيل leaked password protection في Supabase Auth أو إبقاء التسجيل مغلقًا | Backend |
| HIGH | نعم لاختبار العزل | إنشاء User A وUser B وتشغيل اختبارات القراءة والتعديل فعليًا | Backend/Environment |
| MEDIUM | نعم لنسخة Web | تحديد `CORS_DOMAIN_REQUIRED` وضبط `WEB_CORS_ORIGIN` دون تخمين دومين | Environment |
| MEDIUM | لا لمسار النص بعد الإخفاء | إزالة/تعطيل Mock Agent tools من أي مسار إنتاجي مستقبلي | Code |

## 11. الحكم النهائي

# NOT_READY_FOR_BETA

الموانع بالترتيب:

1. `FLUTTER_BUILD_NOT_VERIFIED`: لا يوجد Flutter SDK أو Android/iOS/Web platform files أو artifact.
2. `PROVIDER_CREDENTIAL_REQUIRED`: لا يوجد اعتماد Provider صالح ومختبر، لذلك لا يمكن إثبات رد نصي حقيقي.
3. نسخة `ai-router` المعدلة غير منشورة؛ الموجود في GitHub ليس دليل نشر حي.
4. اختبارات JWT الصحيح، User A/User B، isStreaming runtime، وإغلاق الموارد لم تُشغّل فعليًا.
5. leaked password protection وتحذيرات SECURITY DEFINER ما زالت مفتوحة.
6. `CORS_DOMAIN_REQUIRED` عند تجهيز Web.

لا يتم استخدام عبارة `BETA_READY` حتى تُغلق هذه الموانع وتُرفق نتيجة البناء والتشغيل الفعلية.

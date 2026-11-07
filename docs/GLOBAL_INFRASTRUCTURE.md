# البنية التحتية العالمية (Global Infrastructure)

هذه الوثيقة تشرح الطبقات الأربع التي بُنيت لخدمة **التطبيق بالكامل**، وكيف تُستخدم `HIMS` كأحد الأنظمة الفرعية دون أي كود خاص بها داخل الـ Edge Functions.

## الفكرة الأساسية

كل ميزة جديدة (HIMS، الجامعة، البحث، أي شيء لاحقًا) لا تحتاج بنية جديدة. تحتاج فقط **صفوفًا في قاعدة البيانات**، وتمر تلقائيًا عبر القنوات الثلاث:

```
طلب المستخدم
   │
   ├─ 1) Semantic Cache (ai_response_cache)  ──► إجابة مخزّنة؟ تُعاد فورًا بتكلفة صفر
   │
   ├─ 2) Global Vector Memory (user_task_memories) ──► سياق من مهام سابقة عبر كل الأقسام
   │
   ├─ 3) النموذج (ai-router)
   │
   └─ 4) Global Media Storage (global_media_assets + R2) ──► الملفات تُخزَّن خارج Supabase
```

## 1) الكاش الدلالي العالمي — `ai_response_cache`

| العمود | الوصف |
| --- | --- |
| `feature_key` | مساحة اسم الميزة (`chat`, `hims`, `general` …). غير معروف ⇒ `general`. |
| `scope` | `global` (مشترك) أو `user` (خاص بالمستخدم). |
| `prompt_hash` | بصمة السؤال بعد تطبيع النص (حالة الأحرف، المسافات، Unicode). |
| `context_hash` | بصمة السياق (System Prompt + نمط التوجيه + النموذج المثبّت). |
| `embedding` | متجه 1536 بُعدًا (pgvector + فهرس HNSW). |
| `response_text` | الإجابة المخزّنة. |
| `hit_count` / `last_hit_at` | عدّاد إعادة الاستخدام. |
| `expires_at` | صلاحية افتراضية 7 أيام. |

**الدوال (service_role فقط):**

- `suly_semantic_cache_lookup(feature_key, embedding, user_id, threshold, count, include_global)`
- `suly_semantic_cache_store(...)` — يحدّث بدل التكرار (`ON CONFLICT` على البصمة).
- `suly_semantic_cache_hit(id)` — يزيد العدّاد.
- `suly_semantic_cache_stats(feature_key)` / `suly_semantic_cache_purge(feature_key, expired_only)`.

**ضمانات:**

- لا تُخزَّن أي أسئلة تحتوي مفاتيح/كلمات مرور (`containsSensitiveText`).
- لا تُخزَّن أوامر التفعيل (`!ACTIVATE_*`) ولا الأسئلة الأقصر من 8 أحرف.
- الإجابات المخزّنة لا تُعاد إلا إذا تطابق `context_hash`، فلا تُستخدم إجابة نموذج مختلف في سياق مختلف.
- **العميل لا يستطيع قراءة الجدول إطلاقًا** (RLS `false` + سحب كل الصلاحيات).

## 2) الذاكرة المتجهية العالمية — `user_task_memories`

كل مهمة ذات معنى تُستخلص إلى متجه وتُخزَّن مرة واحدة لكل `(user, feature, content_hash)`:

- تُستخدم في بناء السياق قبل كل طلب (أعلى 4 نتائج تشابهًا).
- متاحة لأي Agent عبر أداة `memory_search`.
- المستخدم يستطيع البحث في ذكرياته فقط عبر `suly_my_task_memories` (تعتمد `auth.uid()`).
- الأسئلة التي تحتوي أسرارًا لا تُخزَّن.

## 3) التخزين الخارجي الشامل — `global_media_assets` + Cloudflare R2

**القاعدة الصارمة:** Supabase لا يخزّن أي ملفات؛ يخزّن **روابط** فقط.

- كل رفع يمر عبر Edge Function `media-gateway` (لا يوجد مسار آخر).
- البايتات تُرفع إلى R2 بتوقيع SigV4 (WebCrypto، بلا مكتبات خارجية).
- المسار: `<feature>/<yyyy>/<mm>/<user>/<uuid>-<sanitized-name>`.
- يُسجَّل في `global_media_assets`: `public_url`, `bucket`, `object_key`, `mime_type`, `size_bytes`, `checksum_sha256`.
- RLS: المستخدم يقرأ صفوفه فقط؛ **الكتابة ممنوعة على العميل نهائيًا** (service_role فقط).
- التحقق: الحجم (25MB افتراضيًا، قابل للضبط)، نوع MIME (قائمة سماح)، رفض التنفيذيات و`text/html` و`svg`، ورفض أي رابط غير `https`.

### عقد `media-gateway`

```http
POST /functions/v1/media-gateway
Authorization: Bearer <user access token>

# إما JSON:
{ "feature_key": "hims", "filename": "lecture1.pdf",
  "mime_type": "application/pdf", "content_base64": "...", "metadata": {} }

# أو multipart/form-data مع الحقول: file, feature_key, metadata

# القائمة:
POST /functions/v1/media-gateway?action=list
```

الاستجابة: `{ success, id, url, object_key, mime_type, size_bytes, feature_key }`.

## 4) تفعيل الميزات المعتمد على البيانات — HIMS كنموذج

الجداول: `suly_feature_flags`, `suly_activation_codes`, `suly_feature_activations`, `suly_feature_resources`.

HIMS مُسجَّل كصف واحد فقط:

```sql
insert into suly_feature_flags (feature_key, label, profile_column, activated_at_column)
values ('hims', 'HIMS - المحتوى الدراسي', 'hims_activated', 'hims_activated_at');
```

### كيف يعمل التفعيل؟

1. المستخدم يرسل في المحادثة: `!ACTIVATE_HIMS-2026`.
2. `ai-router` يعترض الرسالة **قبل** أي استدعاء نموذج أو خصم رصيد.
3. ينادي `suly_activate_feature(user_id, code)`:
   - يبحث عن الكود كـ **SHA-256** (لا يوجد نص صريح في القاعدة).
   - يتحقق من: التفعيل، الصلاحية، عدد الاستخدامات، وجود الميزة، وجود الملف الشخصي.
   - يقلب العمود المذكور في `profile_column` (بعبارة `format('%I')` بعد التحقق من وجوده في `information_schema`).
   - يسجّل صفًا في `suly_feature_activations` + `admin_audit_logs`.
4. الرد نصي فوري (بدون تكلفة)، ويُحفظ في المحادثة كرسالة مساعد.

**لإضافة ميزة جديدة لاحقًا:** أدخل صفًا في `suly_feature_flags` + عمودًا في `suly_profiles` + كودًا + روابط. لا تعديل على أي Edge Function.

### إدارة الأكواد والروابط (من لوحة التحكم)

```sql
-- كود جديد (للمشرف فقط)
select suly_admin_create_activation_code('hims', 'HIMS-2026', 'دفعة أولى', 50, null);

-- رابط محتوى للميزة
select suly_admin_upsert_feature_resource('hims', 'مكتبة المحاضرات', 'https://...', 'library', 'وصف', true);

-- منح/سحب يدوي
select suly_admin_grant_feature('<user-uuid>', 'hims', true);
```

## أدوات الوكيل العالمية

| الأداة | الوظيفة |
| --- | --- |
| `memory_search` | بحث في ذكريات المستخدم عبر كل الميزات. |
| `media_search` | العثور على ملفات رفعها المستخدم وإرجاع روابطها. |
| `document_read` | قراءة نص ملف عبر رابطه (https فقط، بحد أقصى 2MB). |
| `feature_resources` | روابط الميزة المفعّلة (مكتبة HIMS مثلًا). |
| `task_memory_save` | حفظ ملاحظة دائمة عن مهمة المستخدم. |

كل الأدوات مقيّدة بالمستخدم المُصادَق (`userId` من التوكن)، ولا تقبل معرّف مستخدم من الوسائط.

## متغيرات البيئة (Secrets)

| المتغير | الاستخدام |
| --- | --- |
| `R2_ACCOUNT_ID` | معرّف حساب Cloudflare. |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | مفاتيح S3 API في R2. |
| `R2_BUCKET` | اسم الحاوية. |
| `R2_PUBLIC_BASE_URL` | النطاق العام للقراءة (https). |
| `R2_ENDPOINT` | اختياري، الافتراضي `https://<account>.r2.cloudflarestorage.com`. |
| `R2_REGION` | افتراضي `auto`. |
| `MEDIA_MAX_UPLOAD_BYTES` | اختياري، الافتراضي 25MB. |

```bash
supabase secrets set R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... \
  R2_SECRET_ACCESS_KEY=... R2_BUCKET=... R2_PUBLIC_BASE_URL=https://cdn.example.com
```

## النشر

```bash
# 1) الهجرة
supabase db push

# 2) الدوال
supabase functions deploy ai-router
supabase functions deploy media-gateway
```

## التحقق المحلي (بدون لمس الإنتاج)

```bash
createdb smsm_test
psql -d smsm_test -f scripts/local-migration-harness.sql
psql -d smsm_test -f supabase/migrations/013_global_infrastructure.sql
psql -d smsm_test -f scripts/local-migration-verification.sql   # 47 فحصًا
```

واختبارات الوحدة:

```bash
cd apps/mobile && npx jest src/lib/infra --runInBand
```

## نموذج الأمان

- كل دوال الكاش والذاكرة والتفعيل: `security definer` + `service_role` فقط + `revoke` صريح من `anon` و`authenticated`.
- جداول الكاش/الذاكرة/الأكواد/التفعيلات: RLS بـ `false` للعميل، و`select` محدود للمستخدم على صفوفه في الوسائط فقط.
- `media-gateway` يتحقق من التوكن بنفسه (`auth.getUser`) ويرفض الحسابات الموقوفة.
- لا تُعاد رسائل أخطاء السيرفر الخام إلى العميل؛ تُحوَّل إلى رموز نتيجة محدودة.
- الملفات: قائمة سماح MIME، حد حجم، أسماء منظّفة، مفاتيح كائنات مُتحقَّق منها، ورفض `http`.

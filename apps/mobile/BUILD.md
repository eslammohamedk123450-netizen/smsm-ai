# بناء Suly Agent AI — دليل مختصر

## لماذا كان الـ APK كبيرًا؟

البناء الافتراضي الذي أنتج ~100 ميجا كان **Debug** و**شاملًا كل المعماريات**. لا علاقة للأمر بعدد الملفات أو الحزم.

| العامل | الأثر |
| --- | --- |
| Debug بدل Release (محرك تطوير + خرائط أخطاء) | +40 إلى +60 ميجا |
| APK شامل (arm64 + armv7 + x86 + x86_64) | ×2.5 تقريبًا |
| غياب R8 وتقليص الموارد | +5 إلى +10 ميجا |
| الإعلانات (مقصودة) | +5 إلى +8 ميجا |

## الأوامر

### APK خفيف لكل معمارية (للتوزيع المباشر)

```bash
cd apps/mobile
npm run build:apk
```

المخرجات في `android/app/build/outputs/apk/release/`:

- `app-arm64-v8a-release.apk` — معظم أجهزة Android الحديثة
- `app-armeabi-v7a-release.apk` — أجهزة قديمة
- `app-x86_64-release.apk` — محاكيات

### AAB للنشر على Google Play

```bash
cd apps/mobile
npm run build:aab
```

الـ AAB لا يُثبَّت مباشرة؛ Google Play يولّد منه نسخة مخصّصة لكل جهاز، فيكون حجم التنزيل أصغر من أي APK.

## ما تم ضبطه

في `app.config.ts` عبر `expo-build-properties`:

- `enableProguardInReleaseBuilds: true` — R8 يحذف الكود غير المستخدم
- `enableShrinkResourcesInReleaseBuilds: true` — يحذف الموارد غير المستخدمة
- `useLegacyPackaging: false` — ضغط أفضل للمكتبات الأصلية
- قواعد ProGuard تحمي `com.google.android.gms.ads.**` حتى لا يعطّل R8 الإعلانات

## تحذيرات

- لا تستخدم `./gradlew assembleDebug` للتوزيع — الحجم يتضاعف.
- لا تبنِ APK شاملًا (`assembleRelease` بدون `--split-per-abi`) — الحجم يتضاعف ثلاث مرات.
- إزالة `react-native-google-mobile-ads` توفّر 5–8 ميجا، لكنها تعطّل الإعلانات. غير مستحسن إذا كانت الإعلانات مخططة.
- تغييرات `app.config.ts` الأصلية تحتاج `expo prebuild --clean` قبل البناء المحلي.

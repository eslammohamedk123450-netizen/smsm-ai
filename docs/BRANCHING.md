# سياسة الفروع (Branching Policy)

آخر تحديث: 2026-11-07

## الوضع الحالي

المستودع يحتوي على **فرعين فقط**:

| الفرع | الدور |
| --- | --- |
| `main` | نسخة الإنتاج المستقرة. لا تُعدَّل إلا بدمج مُراجع من `release/v1`. |
| `release/v1` | فرع العمل والتطوير الموحّد. كل التغييرات القادمة تُبنى فوقه. |

## لماذا كان هناك 6 فروع؟

كل أداة أو نموذج ذكاء اصطناعي عمل على المشروع أنشأ فرعًا مستقلًا بدل البناء على فرع واحد، فتشعّب العمل على ثلاثة مسارات متوازية:

| الفرع القديم | ما كان فيه | ما حدث له |
| --- | --- | --- |
| `feat/global-infrastructure` | البنية التحتية العالمية + HIMS + إصلاحات المشرف + أمان الاعتماديات | دُمج بالكامل في `release/v1` |
| `fix/expo-parity-security` | تكافؤ Expo + هوية Suly + إخفاء HIMS | دُمج بالكامل في `release/v1` |
| `verify/expo-release-readiness` | إعادة التصميم الداكن + تحسين شاشات الإدارة | دُمج بالكامل في `release/v1` |
| `feat/admin-entry-and-agent-plan` | زر لوحة التحكم للمشرف | مكرر بالكامل، لم يحمل أي تغيير فريد |
| `manus/closed-text-beta-2026-11-06` | إصلاح دردشة تطبيق Flutter القديم | مؤرشف في وسم `archive/closed-text-beta-2026-11-06` |
| `origin` (فرع باسم `origin`) | نسخة مطابقة لـ `main` أُنشئت بالخطأ | حُذف |

## قواعد العمل من الآن

1. **لا فروع جديدة لكل مهمة.** اعمل على `release/v1` مباشرة، أو افتح فرعًا قصير العمر باسم `fix/<وصف>` أو `feat/<وصف>` يُمحى بعد الدمج.
2. **لا يُدمج في `main` إلا بعد:** `npx tsc --noEmit`، `npx jest --runInBand`، `npx expo export --platform web`، `npx expo export --platform android`، و`deno check` للدوال.
3. **لا يُحذف فرع قبل التأكد أن كل التزاماته موجودة في الفرع الهدف** (`git merge-base --is-ancestor`) أو أن فروقه متكافئة (`git log --cherry-pick --right-only`).
4. **أي فرع مهجور يُؤرشف بوسم** قبل حذفه: `git tag archive/<name> <sha> && git push origin archive/<name>`.

## أوامر مرجعية

```bash
# هل كل ما في الفرع موجود في الفرع الهدف؟
git merge-base --is-ancestor origin/<branch> release/v1 && echo merged

# ما الالتزامات التي في الفرع ولا يوجد ما يكافئها في الهدف؟
git log --cherry-pick --right-only --oneline release/v1...origin/<branch>

# أرشفة فرع ثم حذفه
git tag archive/<name> origin/<name> && git push origin archive/<name>
git push origin --delete <name>
```

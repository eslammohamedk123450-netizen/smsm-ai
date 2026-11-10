import express from 'express';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Suly Chat API
app.post('/api/chat', async (req, res) => {
  return res.status(410).json({ error: 'This legacy chat endpoint is retired. Use the authenticated AI router.' });
  /* Legacy implementation retained only for migration history; unreachable. */
  /*
  const { message, isFirstMessage } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'الرجاء إرسال رسالة صالحة' });
  }

  const cleanQuery = message.trim();

  // Calculate points cost (dynamic between 8 and 18 points)
  const cost = Math.floor(Math.random() * 8) + 10;

  // 1. Strict Identity Handlers (Pre-check for exact fixed answers)
  const identityResponse = checkStrictIdentity(cleanQuery);
  if (identityResponse) {
    return res.json({ reply: identityResponse, cost });
  }

  // 2. If no AI client available, use direct enterprise fallback
  if (!aiClient) {
    const rawReply = generateFallbackResponse(cleanQuery);
    const reply = formatDirectReply(rawReply, !!isFirstMessage);
    return res.json({ reply, cost });
  }

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: cleanQuery,
      config: {
        systemInstruction: `أنت Suly، مساعد ذكي. رد مباشرة على سؤال المستخدم بدون أي مقدمة تعريفية عن نفسك، وبدون تحية متكررة. ابدأ بالإجابة فورا.
الأسلوب: مباشر، احترافي، يرد على السؤال فقط. لا تشرح نفسك ولا تمدح نفسك.
ممنوع تماماً أن تبدأ أي رد عادي بعبارات مثل: "مرحبا بك، بصفتي Suly" أو "أنا Suly" أو "يسعدني أن أضع بين يديك" أو "كمستشارك" أو "سؤال ممتاز" أو "بالتأكيد" أو أي مقدمة تعريفية.
${isFirstMessage ? 'هذه الرسالة الأولى في المحادثة، يمكنك البدء بسطر تحية قصير واحد فقط مثل "أهلاً بك" ثم الدخول في الإجابة مباشرة.' : 'هذه ليست الرسالة الأولى، ادخل في الإجابة مباشرة دون أي تحية ودون أي مقدمة.'}

قواعد الهوية الصارمة (تظهر فقط عند السؤال الصريح عنها):
- لا تعرف بنفسك تلقائياً إلا إذا سألك المستخدم صراحة عن هويتك.
- عندما يسأل المستخدم "انت مين؟" أو "من أنت؟" أو "عرف بنفسك":
  الرد الثابت: "أنا Suly، مساعد ذكي تم تطويري بواسطة شركة Suly-Technologies."
- عندما يسأل المستخدم "مين اللي عملك؟" أو "مين طورك؟":
  الرد الثابت: "تم تطويري بواسطة شركة Suly-Technologies."
- عندما يسأل المستخدم عن الشركة "ايه هي Suly-Technologies؟" أو "كلمني عن الشركة":
  الرد الثابت: "شركة Suly-Technologies هي شركة مصرية تدعم الابتكار والخدمات الإلكترونية والبرمجة، تم تأسيسها على يد المهندس: إسلام محمد البدوي."
- ممنوع إضافة أي معلومات أخرى عن الشركة أو المؤسس من تأليفك، وممنوع اختراع تاريخ تأسيس أو مقر أو خدمات غير المكتوبة هنا.
- استخدم جداول وقوائم نقطية بتنسيق Markdown متوافق مع RTL.
- ممنوع استخدام كلمة Flex أو أي اسم موديل تقني آخر.`,
      },
    });

    const rawReply = response.text || generateFallbackResponse(cleanQuery);
    const reply = formatDirectReply(rawReply, !!isFirstMessage);
    return res.json({ reply, cost });
  } catch (error: any) {
    console.error('Chat error:', error);
    const rawReply = generateFallbackResponse(cleanQuery);
    const reply = formatDirectReply(rawReply, !!isFirstMessage);
    return res.json({ reply, cost });
  }
  */
});

// Check strict identity queries to guarantee exact wording
function checkStrictIdentity(query: string): string | null {
  const q = query.replace(/[؟?.,!]/g, '').trim().toLowerCase();

  // Pattern 1: انت مين؟ / من أنت؟ / عرف بنفسك
  const whoAreYouPattern = /^(انت مين|من انت|من أنت|عرف بنفسك|عرف عن نفسك|عرفنا بنفسك|ما هو سولي|ما هو suly|مين سولي|مين suly|انت ايه)$/i;
  if (whoAreYouPattern.test(q)) {
    return 'أنا Suly، مساعد ذكي تم تطويري بواسطة شركة Suly-Technologies.';
  }

  // Pattern 2: مين اللي عملك؟ / مين طورك؟
  const whoMadeYouPattern = /^(مين اللي عملك|مين عملك|مين طورك|مين اللي طورك|من طورك|من صنعك|مين صنعك|مين برمجك|من برمجك|من انشاك|مين انشاك)$/i;
  if (whoMadeYouPattern.test(q)) {
    return 'تم تطويري بواسطة شركة Suly-Technologies.';
  }

  // Pattern 3: ايه هي Suly-Technologies؟ / كلمني عن الشركة
  const companyPattern = /(suly-technologies|suly technologies|سولي تكنولوجي|كلمني عن الشرك[ةه]|ايه هي الشرك[ةه]|ما هي الشرك[ةه]|عن الشرك[ةه]|مين الشرك[ةه]|ما هي suly|معلومات عن الشرك[ةه])/i;
  if (companyPattern.test(q)) {
    return 'شركة Suly-Technologies هي شركة مصرية تدعم الابتكار والخدمات الإلكترونية والبرمجة، تم تأسيسها على يد المهندس: إسلام محمد البدوي.';
  }

  return null;
}

// Clean any accidental introductory boilerplate from LLM outputs
function formatDirectReply(text: string, isFirstMessage: boolean): string {
  let cleaned = text.trim();

  // Strip banned introductory phrases
  const bannedPrefixes = [
    /^مرحبا\s*بك،?\s*بصفتي\s*Suly[.:،\- ]*/i,
    /^مرحباً\s*بك،?\s*بصفتي\s*Suly[.:،\- ]*/i,
    /^أنا\s*Suly[.:،\- ]*/i,
    /^بصفتي\s*Suly[.:،\- ]*/i,
    /^يسعدني\s*أن\s*أضع\s*بين\s*يديك[.:،\- ]*/i,
    /^كمستشارك[.:،\- ]*/i,
    /^سؤال\s*ممتاز[.:،! \- ]*/i,
    /^بالتأكيد[.:،! \- ]*/i,
    /^بالتأكيد،?\s*/i,
    /^أهلاً\s*وسهلاً\s*بك[.:،! \- ]*/i,
    /^أهلاً\s*بك[.:،! \- ]*/i,
    /^مرحباً\s*بك[.:،! \- ]*/i,
    /^شكراً\s*لتواصلك\s*مع\s*\*{0,2}Suly\*{0,2}[.:،! \- ]*/i,
  ];

  for (const regex of bannedPrefixes) {
    cleaned = cleaned.replace(regex, '').trim();
  }

  if (isFirstMessage) {
    // Only first response has a short one-line greeting
    return `أهلاً بك.\n\n${cleaned}`;
  }

  // Subsequent responses jump straight into the answer
  return cleaned;
}

function generateFallbackResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('حفلات') || q.includes('موسيقية')) {
    return `أبرز الفعاليات الموسيقية لهذا الشهر:

| الفعالية | التاريخ | المكان | الفئة |
| :--- | :--- | :--- | :--- |
| أوركسترا السيمفونية العربية | 15 نوفمبر 2026 | مسرح دار الأوبرا | كلاسيكي وطربي |
| ليلة العود التراثية | 20 نوفمبر 2026 | مركز المؤتمرات الكبرى | موسيقى شرقية |
| ملتقى الإيقاعات العالمية | 28 نوفمبر 2026 | الساحة الثقافية المفتوحة | فيوجن ومعاصر |

* حجز التذاكر متاح إلكترونياً عبر البوابة الرسمية.`;
  }

  if (q.includes('عطلة') || q.includes('خطط لي') || q.includes('الويكند')) {
    return `جدول عطلة نهاية الأسبوع المقترح:

| اليوم | الفترة | النشاط الموصى به | الهدف |
| :--- | :--- | :--- | :--- |
| الجمعة | الصباح | قراءة واسترخاء خفيف | تصفية الذهن |
| الجمعة | المساء | لقاء اجتماعي في مطعم هادئ | التواصل الاجتماعي |
| السبت | الصباح | رياضة مشي في الهواء الطلق | النشاط البدني |
| السبت | بعد الظهر | مراجعة أولويات الأسبوع القادم | الجاهزية للعمل |`;
  }

  if (q.includes('أخبار') || q.includes('تحديثات')) {
    return `ملخص التحديثات الاقتصادية والتجارية اليوم:

1. **الأسواق المالية:** ارتفاع مؤشر قطاع التقنية والخدمات بنسبة 1.8%.
2. **الاستثمار المؤسسي:** إطلاق حوافز جديدة للشركات والمنشآت الرقمية.
3. **الخدمات اللوجستية:** تعديل أوقات الشحن السريع وسلاسل الإمداد.

| القطاع | التغير اليومي | الاتجاه |
| :--- | :--- | :--- |
| التقنية | +1.8% | صعود |
| الطاقة المتجددة | +0.9% | استقرار |
| العقارات التجارية | +0.4% | متوازن |`;
  }

  return `خطة العمل المقترحة:

1. **التحليل الأولي:** مراجعة المتطلبات الأساسية وتحديد الأهداف.
2. **التنفيذ المباشر:** توزيع المهام وفق الأولويات المعتمدة.
3. **المراجعة والتقييم:** التحقق من مطابقة المخرجات مع مؤشرات الأداء.

| المرحلة | الإجراء المطلوب | المدة المقدرة |
| :--- | :--- | :--- |
| الأولى | جمع البيانات والتدقيق | 3 أيام |
| الثانية | الصياغة والتنفيذ المبدئي | 5 أيام |
| الثالثة | الاعتماد والتقييم النهائي | يومان |`;
}

// Development and production Vite mounting
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, () => {
    console.log(`Suly Corporate App running on http://localhost:${PORT}`);
  });
}

startServer();

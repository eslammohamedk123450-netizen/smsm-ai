import { getImageGenerationPrompt, getStudioIntent } from "./image-generation";

describe("getImageGenerationPrompt", () => {
  it("recognizes Arabic requests to create an image", () => {
    expect(getImageGenerationPrompt("أنشئ صورة لمدينة خيالية وقت الغروب")).toBe("أنشئ صورة لمدينة خيالية وقت الغروب");
    expect(getImageGenerationPrompt("ارسم لي قطة ترتدي معطفًا أزرق")).toBe("ارسم لي قطة ترتدي معطفًا أزرق");
    expect(getImageGenerationPrompt("عايز صورة لقطة على الشاطئ")).toBe("عايز صورة لقطة على الشاطئ");
  });

  it("recognizes English requests to generate an image", () => {
    expect(getImageGenerationPrompt("Generate an image of a quiet beach at sunrise")).toBe("Generate an image of a quiet beach at sunrise");
    expect(getImageGenerationPrompt("I want a picture of a red vintage car")).toBe("I want a picture of a red vintage car");
  });

  it("does not route image analysis requests to image generation", () => {
    expect(getImageGenerationPrompt("حلل هذه الصورة من فضلك")).toBeNull();
    expect(getImageGenerationPrompt("What is in this image? Please describe it.")).toBeNull();
  });

  it("does not route unrelated chat requests", () => {
    expect(getImageGenerationPrompt("اكتب لي رسالة بريد إلكتروني رسمية")).toBeNull();
    expect(getImageGenerationPrompt("Tell me about image generation models")).toBeNull();
  });
});

describe("getStudioIntent", () => {
  it("routes explicit image creation to Studio", () => {
    expect(getStudioIntent("ارسم قطة ترتدي معطفًا")).toBe("image");
    expect(getStudioIntent("Create an image of a mountain")).toBe("image");
  });

  it("keeps charts, tables, flowcharts, and dashboards inside chat", () => {
    const visualRequests = [
      "أنشئ رسمًا بيانيًا بالأعمدة يوضح الأرباح خلال ستة أشهر",
      "أنشئ الرسم البياني للإيرادات",
      "أنشئ جدول المقارنة بين الخطط",
      "أنشئ جدول مقارنة بين ثلاث خطط اشتراك",
      "ارسم مخططًا يوضح رحلة المستخدم داخل التطبيق",
      "أنشئ لوحة معلومات Dashboard تعرض الإيرادات والمصروفات",
      "Create a bar chart of monthly revenue",
      "Create a comparison table for three plans",
      "Draw a flowchart for user onboarding",
      "Build a dashboard with revenue KPIs",
    ];
    for (const request of visualRequests) {
      expect(getStudioIntent(request)).toBeNull();
      expect(getImageGenerationPrompt(request)).toBeNull();
    }
  });

  it("routes explicit video and audio creation to Studio", () => {
    expect(getStudioIntent("عايز فيديو عن تاريخ مصر")).toBe("video");
    expect(getStudioIntent("عايز تعمل فيديو عن تاريخ مصر")).toBe("video");
    expect(getStudioIntent("Create a video about space")).toBe("video");
    expect(getStudioIntent("اعمل تعليق صوتي للنص ده")).toBe("audio");
    expect(getStudioIntent("عايز تعمل تعليق صوتي للنص ده")).toBe("audio");
    expect(getStudioIntent("Generate a voiceover for this text")).toBe("audio");
  });

  it("routes explicit transcription requests to Studio", () => {
    expect(getStudioIntent("فرغ التسجيل الصوتي ده")).toBe("transcription");
    expect(getStudioIntent("Transcribe this recording")).toBe("transcription");
  });

  it("does not redirect ordinary explanations or questions", () => {
    expect(getStudioIntent("اشرحلي صورة الأشعة")).toBeNull();
    expect(getStudioIntent("اشرحلي فيديو عن الفضاء")).toBeNull();
    expect(getStudioIntent("What is audio transcription?")).toBeNull();
  });
});

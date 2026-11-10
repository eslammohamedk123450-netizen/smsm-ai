import { getImageGenerationPrompt } from "./image-generation";

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

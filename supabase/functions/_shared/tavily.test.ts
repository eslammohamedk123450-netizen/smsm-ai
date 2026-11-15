import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isWebSearchRequest } from "./tavily.ts";

Deno.test("ordinary Arabic educational questions do not force live search", () => {
  assertEquals(isWebSearchRequest("معلومات عن بايثون للمبتدئين"), false);
  assertEquals(isWebSearchRequest("اشرحلي حديث نبوي ومعناه"), false);
  assertEquals(isWebSearchRequest("ما الفرق بين الإنترنت والشبكات؟"), false);
});

Deno.test("explicit Arabic search and freshness requests use live search", () => {
  assertEquals(isWebSearchRequest("ابحث على النت عن أحدث أسعار الهواتف"), true);
  assertEquals(isWebSearchRequest("عايز أخبار اليوم عن الذكاء الاصطناعي"), true);
  assertEquals(isWebSearchRequest("قارن من مصادر متعددة"), true);
});

Deno.test("explicit English web and current-information requests use live search", () => {
  assertEquals(isWebSearchRequest("search the web for current exchange rates"), true);
  assertEquals(isWebSearchRequest("what are the latest product announcements today?"), true);
  assertEquals(isWebSearchRequest("research recent changes in the API"), true);
});

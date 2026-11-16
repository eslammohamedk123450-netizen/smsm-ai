import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isWebSearchRequest } from "./tavily.ts";

Deno.test("study questions with an academic subject use live search", () => {
  assertEquals(isWebSearchRequest("معلومات عن بايثون للمبتدئين"), true);
  assertEquals(isWebSearchRequest("اشرحلي حديث نبوي ومعناه"), true);
  assertEquals(isWebSearchRequest("ما هو قانون العرض والطلب؟"), true);
  assertEquals(isWebSearchRequest("قارن بين المحاسبة المالية والإدارية"), true);
});

Deno.test("ordinary greetings and casual chat do not force live search", () => {
  assertEquals(isWebSearchRequest("هلا"), false);
  assertEquals(isWebSearchRequest("إزيك عامل إيه؟"), false);
  assertEquals(isWebSearchRequest("معلومات عنك"), false);
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

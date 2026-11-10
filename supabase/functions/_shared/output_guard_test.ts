import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { OutputGuard } from "./output_guard.ts";

Deno.test("cuts Arabic repetition across chunks before the repeated tail is released", () => {
  const guard = new OutputGuard({ maxChars: 1000 });
  const first = guard.push("مقدمة قصيرة. إذا كنت، ");
  const second = guard.push("إذا كنت، إذا كنت، ثم أكمل");
  const final = `${first.text}${second.text}${guard.finish().text}`;
  assertEquals(second.reason, "repetition");
  assert(final.includes("مقدمة قصيرة."));
  assertFalse(final.includes("إذا كنت"));
});

Deno.test("cuts English repeated phrases spanning chunks", () => {
  const guard = new OutputGuard({ maxChars: 1000 });
  const first = guard.push("A useful start. If you are, ");
  const second = guard.push("if you are, if you are, continue");
  const final = `${first.text}${second.text}${guard.finish().text}`;
  assertEquals(second.reason, "repetition");
  assert(final.includes("A useful start."));
  assertFalse(final.toLowerCase().includes("if you are"));
});

Deno.test("does not flag a normal numbered list", () => {
  const guard = new OutputGuard({ maxChars: 1000 });
  const result = guard.push("1. First item\n2. Second item\n3. Third item");
  const final = `${result.text}${guard.finish().text}`;
  assertFalse(result.stopped);
  assertEquals(guard.reason, null);
  assert(final.includes("2. Second item"));
});

Deno.test("does not flag natural repetition of one short word", () => {
  const guard = new OutputGuard({ maxChars: 1000 });
  guard.push("Yes. Yes. Yes. ");
  const result = guard.push("Yes, that is correct.");
  const final = `${result.text}${guard.finish().text}`;
  assertFalse(result.stopped);
  assertEquals(guard.reason, null);
  assert(final.includes("that is correct"));
});

Deno.test("enforces a hard output bound", () => {
  const guard = new OutputGuard({ maxChars: 20 });
  const result = guard.push("1234567890123456789012345");
  assert(result.stopped);
  assertEquals(result.reason, "max_output");
  assertEquals(guard.text.length, 20);
});

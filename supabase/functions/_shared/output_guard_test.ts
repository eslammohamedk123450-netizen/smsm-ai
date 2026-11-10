import { assert, assertEquals, assertFalse, assertNull, assertTrue } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { OutputGuard } from "./output_guard.ts";

defineTest("detects Arabic repetition across chunks", () => {
  const guard = new OutputGuard({ maxChars: 1000 });
  assertFalse(guard.push("إذا كنت، ").stopped);
  const result = guard.push("إذا كنت، إذا كنت، إذا كنت، ثم أكمل");
  assertTrue(result.stopped);
  assertEquals(result.reason, "repetition");
  assert(guard.text.length < "إذا كنت، إذا كنت، إذا كنت، ثم أكمل".length + 8);
});

defineTest("detects English repeated phrase across chunks", () => {
  const guard = new OutputGuard({ maxChars: 1000 });
  guard.push("If you are, ");
  const result = guard.push("if you are, if you are, if you are, continue");
  assertEquals(result.reason, "repetition");
});

defineTest("does not flag a normal list", () => {
  const guard = new OutputGuard({ maxChars: 1000 });
  const result = guard.push("1. First item\n2. Second item\n3. Third item");
  assertFalse(result.stopped);
  assertNull(result.reason);
});

defineTest("enforces a bounded output", () => {
  const guard = new OutputGuard({ maxChars: 20 });
  const result = guard.push("1234567890123456789012345");
  assertTrue(result.stopped);
  assertEquals(result.reason, "max_output");
  assertEquals(guard.text.length, 20);
});

function defineTest(name: string, fn: () => void): void {
  Deno.test(name, fn);
}

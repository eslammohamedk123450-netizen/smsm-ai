import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { InternalMarkerSanitizer } from "./internal_marker_sanitizer.ts";

Deno.test("removes thought block and preserves final user text", () => {
  const sanitizer = new InternalMarkerSanitizer();
  const visible = sanitizer.push("Hi <thought>private analysis</thought> final reply") + sanitizer.finish();
  assertEquals(visible, "Hi  final reply");
});

Deno.test("removes markers split across chunks without leaking hidden text", () => {
  const sanitizer = new InternalMarkerSanitizer();
  const visible = [
    sanitizer.push("Start <th"),
    sanitizer.push("ought>hidden stuff"),
    sanitizer.push(" more</th"),
    sanitizer.push("ought> end"),
    sanitizer.finish(),
  ].join("");
  assertEquals(visible, "Start  end");
});

Deno.test("drops unclosed hidden block at stream end", () => {
  const sanitizer = new InternalMarkerSanitizer();
  const visible = sanitizer.push("Visible <analysis>not for users") + sanitizer.finish();
  assertEquals(visible, "Visible ");
});

Deno.test("preserves ordinary content and think tag variants", () => {
  const sanitizer = new InternalMarkerSanitizer();
  const visible = sanitizer.push("Hello! <think>secret</think> world.") + sanitizer.finish();
  assertEquals(visible, "Hello!  world.");
});

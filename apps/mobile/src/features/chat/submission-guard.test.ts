import { runOnce } from "./submission-guard";

describe("runOnce message submission guard", () => {
  it("allows one concurrent operation and blocks a repeated submission", async () => {
    const lock = { current: false };
    let insertedMessages = 0;
    let releaseFirst: (() => void) | undefined;
    const first = runOnce(lock, async () => {
      insertedMessages += 1;
      await new Promise<void>((resolve) => { releaseFirst = resolve; });
      return "sent";
    });
    const duplicate = await runOnce(lock, async () => {
      insertedMessages += 1;
      return "duplicate";
    });

    expect(duplicate).toBeUndefined();
    expect(insertedMessages).toBe(1);
    releaseFirst?.();
    await expect(first).resolves.toBe("sent");
    expect(lock.current).toBe(false);
  });

  it("releases the gate if the operation fails", async () => {
    const lock = { current: false };
    await expect(runOnce(lock, async () => { throw new Error("expected"); })).rejects.toThrow("expected");
    expect(lock.current).toBe(false);
  });
});

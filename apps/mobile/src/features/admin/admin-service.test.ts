import { adminService } from "./admin-service";
import { supabase } from "../../lib/supabase/client";

jest.mock("../../lib/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    rpc: jest.fn(),
    from: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe("adminService tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("raises error if user is not logged in", async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: null });
    await expect(adminService.getProviders()).rejects.toThrow("سجّل الدخول مجددًا.");
  });

  test("raises error if user is not admin", async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: false, error: null });
    await expect(adminService.getProviders()).rejects.toThrow("يتطلب هذا الإجراء صلاحية مشرف موثقة.");
  });

  test("adjustCredits validates amount and reason", async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    (supabase.rpc as jest.Mock).mockImplementation((rpcName: string) => {
      if (rpcName === "suly_is_admin") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: { success: true }, error: null });
    });

    await expect(adminService.adjustCredits("user-1", 0, "test")).rejects.toThrow("أدخل مبلغًا صحيحًا غير صفري وسببًا من 1 إلى 500 حرف.");
    await expect(adminService.adjustCredits("user-1", 100, "")).rejects.toThrow("أدخل مبلغًا صحيحًا غير صفري وسببًا من 1 إلى 500 حرف.");
  });

  test("testModel verifies admin access and invokes the probe for the selected model", async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { model_id: 42, status: "success", duration_ms: 240, error_code: null },
      error: null,
    });

    await expect(adminService.testModel(42)).resolves.toEqual({
      model_id: 42,
      status: "success",
      duration_ms: 240,
      error_code: null,
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith("model-health-check", {
      body: { action: "test_model", model_id: 42 },
    });
  });

  test("testModelsBatch tests specified models and does not call updateModel", async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { model_id: 10, status: "success", duration_ms: 120, error_code: null },
      error: null,
    });
    const fromSpy = supabase.from as jest.Mock;

    const results = await adminService.testModelsBatch([10]);
    expect(results).toEqual([{ modelId: 10, status: "success", durationMs: 120, errorCode: null }]);
    expect(fromSpy).not.toHaveBeenCalledWith("ai_models");
  });
});

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

  test("getConversationsPage requires a verified admin before reading conversation metadata", async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: false, error: null });

    await expect(adminService.getConversationsPage()).rejects.toThrow("يتطلب هذا الإجراء صلاحية مشرف موثقة.");
    expect(supabase.from).not.toHaveBeenCalled();
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

  test("setHimsActivationCodeActive requires admin and calls the audited status RPC", async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    (supabase.rpc as jest.Mock).mockImplementation((rpcName: string) => {
      if (rpcName === "suly_is_admin") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: { success: true, id: "code-1", is_active: false }, error: null });
    });

    await expect(adminService.setHimsActivationCodeActive("code-1", false)).resolves.toMatchObject({
      success: true,
      id: "code-1",
      is_active: false,
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "suly_admin_set_activation_code_active", {
      p_code_id: "code-1",
      p_is_active: false,
    });
  });

  test("setHimsActivationCodeActive rejects non-admin sessions", async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: false, error: null });

    await expect(adminService.setHimsActivationCodeActive("code-1", false)).rejects.toThrow("يتطلب هذا الإجراء صلاحية مشرف موثقة.");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  test("setHimsResourceActive requires admin and preserves the existing resource identity", async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    (supabase.rpc as jest.Mock).mockImplementation((rpcName: string) => {
      if (rpcName === "suly_is_admin") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: { success: true, id: "resource-1", feature_key: "hims", media_asset_id: "asset-1" }, error: null });
    });

    await expect(adminService.setHimsResourceActive({
      id: "resource-1",
      feature_key: "hims",
      title: "محاضرة",
      url: "https://signed.example/file",
      media_asset_id: "asset-1",
      kind: "video",
      description: "وصف",
      is_active: true,
      created_at: "2026-11-16T00:00:00.000Z",
    }, false)).resolves.toMatchObject({ success: true, id: "resource-1" });

    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "suly_admin_upsert_feature_resource_v2", {
      p_feature_key: "hims",
      p_title: "محاضرة",
      p_url: null,
      p_kind: "video",
      p_description: "وصف",
      p_is_active: false,
      p_media_asset_id: "asset-1",
    });
  });

  test("createHimsResource can preserve an existing inactive resource during metadata edits", async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    (supabase.rpc as jest.Mock).mockImplementation((rpcName: string) => {
      if (rpcName === "suly_is_admin") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: { success: true, id: "resource-2", feature_key: "hims", media_asset_id: null }, error: null });
    });

    await expect(adminService.createHimsResource({
      title: "عنوان جديد",
      url: "https://example.com/lecture",
      kind: "lecture",
      description: "وصف جديد",
    }, false)).resolves.toMatchObject({ success: true, id: "resource-2" });

    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "suly_admin_upsert_feature_resource_v2", {
      p_feature_key: "hims",
      p_title: "عنوان جديد",
      p_url: "https://example.com/lecture",
      p_kind: "lecture",
      p_description: "وصف جديد",
      p_is_active: false,
      p_media_asset_id: null,
    });
  });

  test("setHimsResourceActive rejects non-admin sessions before the resource write", async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: false, error: null });

    await expect(adminService.setHimsResourceActive({
      id: "resource-1",
      feature_key: "hims",
      title: "محاضرة",
      url: "https://example.com/file",
      media_asset_id: null,
      kind: "file",
      description: null,
      is_active: true,
      created_at: "2026-11-16T00:00:00.000Z",
    }, false)).rejects.toThrow("يتطلب هذا الإجراء صلاحية مشرف موثقة.");

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  test("updateAgentModels requires admin and saves the two independent model selections", async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    (supabase.rpc as jest.Mock).mockImplementation((rpcName: string) => {
      if (rpcName === "suly_is_admin") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    await adminService.updateAgentModels(10, 5);

    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "suly_set_model_settings", {
      p_planner_model_id: 10,
      p_summarizer_model_id: 5,
    });
  });
});

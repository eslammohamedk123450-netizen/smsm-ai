import { parseAuthCallbackUrl } from "./auth-callback";

describe("parseAuthCallbackUrl", () => {
  it("reads access and refresh tokens from the Supabase URL fragment", () => {
    expect(parseAuthCallbackUrl("suly-agent-ai://auth/callback#access_token=access&refresh_token=refresh&type=magiclink")).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      tokenHash: null,
      code: null,
      type: "magiclink",
      errorDescription: null,
    });
  });

  it("reads PKCE code and token-hash query parameters", () => {
    expect(parseAuthCallbackUrl("suly-agent-ai://auth/callback?code=pkce&token_hash=hash&type=email")).toMatchObject({
      tokenHash: "hash",
      code: "pkce",
      type: "email",
    });
  });
});

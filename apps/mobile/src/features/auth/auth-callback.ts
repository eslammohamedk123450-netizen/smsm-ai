export interface AuthCallbackParams {
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  code: string | null;
  type: string | null;
  errorDescription: string | null;
}

export function parseAuthCallbackUrl(url: string): AuthCallbackParams {
  const parsed = new URL(url);
  const values = new URLSearchParams(parsed.search);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const get = (key: string) => fragment.get(key) ?? values.get(key);
  return {
    accessToken: get("access_token"),
    refreshToken: get("refresh_token"),
    tokenHash: get("token_hash"),
    code: get("code"),
    type: get("type"),
    errorDescription: get("error_description") ?? get("error"),
  };
}

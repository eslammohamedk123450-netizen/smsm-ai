export type UserRole = "user" | "admin";

export interface UserEntity {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  role: UserRole;
  creditBalance: number;
  subscriptionTier: "free" | "premium" | "pro";
}

export type AuthState = "unauthenticated" | "authenticated" | "loading";

export interface AuthStateChangeEvent {
  event: "SIGNED_IN" | "SIGNED_UP" | "SIGNED_OUT" | "TOKEN_REFRESHED" | "USER_UPDATED";
  session: any;
}
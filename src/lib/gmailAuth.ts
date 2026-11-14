import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type Auth,
  type User,
} from 'firebase/auth';

const configModules = import.meta.glob('../../firebase-applet-config.json', { eager: true }) as Record<
  string,
  { default?: Record<string, string> } & Record<string, string>
>;

const loadedConfig = Object.values(configModules)[0]?.default ?? Object.values(configModules)[0];

const envConfig =
  import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID
    ? {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain:
          import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
          `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
      }
    : null;

const firebaseConfig =
  loadedConfig && loadedConfig.apiKey && loadedConfig.projectId ? loadedConfig : envConfig;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (firebaseConfig) {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
}

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/gmail.modify');
provider.setCustomParameters({ prompt: 'consent select_account' });

let isSigningIn = false;
// Strictly in-memory token cache — never stored in localStorage or sessionStorage.
let cachedAccessToken: string | null = null;
let cachedEmail: string | null = null;

export type GmailConnectResult =
  | {
      ok: true;
      user: User;
      accessToken: string;
      email: string | null;
    }
  | {
      ok: false;
      cancelled: boolean;
      code: string;
      message: string;
    };

export const initGmailAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) {
    onAuthFailure?.();
    return () => {};
  }

  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      cachedEmail = user.email ?? cachedEmail;
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      cachedEmail = null;
      onAuthFailure?.();
    }
  });
};

export const connectGmail = async (): Promise<GmailConnectResult> => {
  if (!auth) {
    return {
      ok: false,
      cancelled: false,
      code: 'firebase-not-configured',
      message: 'إعدادات Firebase OAuth غير مهيأة في هذه البيئة.',
    };
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      return {
        ok: false,
        cancelled: false,
        code: 'missing-access-token',
        message: 'تعذر الحصول على تصريح الوصول لحساب Gmail. يرجى المحاولة مرة أخرى.',
      };
    }
    cachedAccessToken = credential.accessToken;
    cachedEmail = result.user.email ?? null;
    return {
      ok: true,
      user: result.user,
      accessToken: cachedAccessToken,
      email: cachedEmail,
    };
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';

    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return {
        ok: false,
        cancelled: true,
        code,
        message: 'تم إغلاق نافذة تسجيل دخول Google قبل إتمام الربط. اضغط "ربط Gmail" للمحاولة مرة أخرى.',
      };
    }

    if (code === 'auth/popup-blocked') {
      return {
        ok: false,
        cancelled: false,
        code,
        message:
          'المتصفح منع فتح نافذة تسجيل الدخول المنبثقة. يرجى السماح بالنوافذ المنبثقة (Pop-ups) لهذا الموقع والمحاولة مجدداً.',
      };
    }

    if (code === 'auth/unauthorized-domain') {
      return {
        ok: false,
        cancelled: false,
        code,
        message: 'هذا النطاق غير مضاف في Authorized Domains داخل إعدادات Firebase Authentication.',
      };
    }

    return {
      ok: false,
      cancelled: false,
      code: code || 'unknown',
      message: 'تعذر إتمام ربط Gmail الآن. يرجى التأكد من السماح بالنوافذ المنبثقة والمحاولة مجدداً.',
    };
  } finally {
    isSigningIn = false;
  }
};

export const getGmailAccessToken = (): string | null => cachedAccessToken;

export const getGmailCachedEmail = (): string | null =>
  cachedEmail ?? auth?.currentUser?.email ?? null;

export const clearGmailToken = (): void => {
  cachedAccessToken = null;
};

export const disconnectGmail = async (): Promise<void> => {
  cachedAccessToken = null;
  cachedEmail = null;
  if (auth) {
    await auth.signOut();
  }
};

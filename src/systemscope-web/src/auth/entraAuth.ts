import { PublicClientApplication, type AccountInfo, type AuthenticationResult, type Configuration, type RedirectRequest } from '@azure/msal-browser';

type EntraConfig = {
  tenantId: string;
  authority: string;
  clientId: string;
  apiClientId: string;
  audience: string;
  scope: string;
};

let cachedConfig: EntraConfig | null = null;
let msalInstance: PublicClientApplication | null = null;
let initializePromise: Promise<PublicClientApplication> | null = null;
let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function fetchEntraConfig(): Promise<EntraConfig> {
  if (cachedConfig) return cachedConfig;
  const response = await fetch('/api/auth/entra-config');
  if (!response.ok) throw Error('Unable to load sign-in configuration.');
  cachedConfig = await response.json();
  return cachedConfig!;
}

export async function initializeEntraAuth() {
  if (msalInstance) return msalInstance;
  if (!initializePromise) {
    initializePromise = (async () => {
      const config = await fetchEntraConfig();
      if (!config.clientId) throw Error('Entra client id is not configured.');
      const msalConfig: Configuration = {
        auth: {
          clientId: config.clientId,
          authority: config.authority || `https://login.microsoftonline.com/${config.tenantId}`,
          redirectUri: window.location.origin,
          postLogoutRedirectUri: window.location.origin,
          navigateToLoginRequestUrl: true,
        },
        cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false },
      };
      const instance = new PublicClientApplication(msalConfig);
      await instance.initialize();
      msalInstance = instance;
      return instance;
    })();
  }
  return initializePromise;
}

export async function handleEntraRedirect(): Promise<AuthenticationResult | null> {
  const instance = await initializeEntraAuth();
  const result = await instance.handleRedirectPromise();
  if (result?.account) instance.setActiveAccount(result.account);
  else {
    const existing = instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;
    if (existing) instance.setActiveAccount(existing);
  }
  return result;
}

export async function signInWithEntra() {
  const instance = await initializeEntraAuth();
  const config = await fetchEntraConfig();
  const request: RedirectRequest = {
    scopes: ['openid', 'profile', 'email', config.scope].filter(Boolean),
    redirectStartPage: window.location.href,
  };
  await instance.loginRedirect(request);
}

export async function signOutFromEntra() {
  accessToken = null;
  if (!cachedConfig?.clientId && !msalInstance) {
    window.location.reload();
    return;
  }
  const instance = await initializeEntraAuth();
  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
  await instance.logoutRedirect({ account: account ?? undefined, postLogoutRedirectUri: window.location.origin });
}

export async function acquireApiToken(): Promise<string | null> {
  const instance = await initializeEntraAuth();
  const config = await fetchEntraConfig();
  const account: AccountInfo | null = instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;
  if (!account) return null;
  const scopes = [config.scope].filter(Boolean);
  try {
    const silent = await instance.acquireTokenSilent({ account, scopes });
    accessToken = silent.accessToken;
    return silent.accessToken;
  } catch {
    await instance.acquireTokenRedirect({ account, scopes });
    return null;
  }
}

export async function getEntraAccount() {
  try {
    const instance = await initializeEntraAuth();
    return instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;
  } catch {
    return null;
  }
}

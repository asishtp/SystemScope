declare module '@azure/msal-browser' {
  export interface AccountInfo {
    homeAccountId: string;
    environment: string;
    tenantId: string;
    username: string;
    localAccountId: string;
    name?: string;
  }

  export interface AuthenticationResult {
    accessToken: string;
    account: AccountInfo | null;
  }

  export interface Configuration {
    auth: {
      clientId: string;
      authority?: string;
      redirectUri?: string;
      postLogoutRedirectUri?: string;
      navigateToLoginRequestUrl?: boolean;
    };
    cache?: {
      cacheLocation?: string;
      storeAuthStateInCookie?: boolean;
    };
  }

  export interface RedirectRequest {
    scopes: string[];
    account?: AccountInfo;
    redirectStartPage?: string;
  }

  export class PublicClientApplication {
    constructor(config: Configuration);
    initialize(): Promise<void>;
    handleRedirectPromise(): Promise<AuthenticationResult | null>;
    setActiveAccount(account: AccountInfo | null): void;
    getActiveAccount(): AccountInfo | null;
    getAllAccounts(): AccountInfo[];
    loginRedirect(request: RedirectRequest): Promise<void>;
    logoutRedirect(request?: { account?: AccountInfo; postLogoutRedirectUri?: string }): Promise<void>;
    acquireTokenSilent(request: { account: AccountInfo; scopes: string[] }): Promise<AuthenticationResult>;
    acquireTokenRedirect(request: { account?: AccountInfo; scopes: string[] }): Promise<void>;
  }
}

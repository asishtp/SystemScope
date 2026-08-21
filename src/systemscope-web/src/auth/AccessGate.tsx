import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { acquireApiToken, fetchEntraConfig, handleEntraRedirect, initializeEntraAuth, setAccessToken, signInWithEntra, signOutFromEntra } from './entraAuth';
import { setAuthToken } from '../landscape/api';
import './access.css';

export type AppIdentity = {
  userId: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
};

type AccessState = {
  email: string;
  displayName?: string;
  accessStatus: string;
  canRequestAccess: boolean;
  message: string;
  accessRequestedAt?: string;
};

const AuthContext = createContext<{ user: AppIdentity; signOut: () => void } | null>(null);

export function useAppUser() {
  const value = useContext(AuthContext);
  if (!value) throw Error('useAppUser must be used inside AccessGate');
  return value;
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<AppIdentity | null>(null);
  const [access, setAccess] = useState<AccessState | null>(null);
  const [busy, setBusy] = useState(false);
  const [ssoConfigured, setSsoConfigured] = useState(false);

  useEffect(() => { void bootstrap(); }, []);

  const bootstrap = async () => {
    setLoading(true);
    setError('');
    try {
      const config = await fetchEntraConfig();
      if (!config.clientId) {
        setSsoConfigured(false);
        setUser({ userId: 'local-user', email: 'local@systemscope', displayName: 'Local Assessment Lead', roles: ['Administrator'], permissions: ['security.users.manage'] });
        setLoading(false);
        return;
      }
      setSsoConfigured(true);
      await initializeEntraAuth();
      await handleEntraRedirect();
      const token = await acquireApiToken();
      if (!token) {
        setUser(null);
        setAccess(null);
        setLoading(false);
        return;
      }
      setAccessToken(token);
      setAuthToken(token);
      await loadMe(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setLoading(false);
    }
  };

  const loadMe = async (token: string) => {
    const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    const text = await response.text();
    const payload = text ? JSON.parse(text) as AccessState & AppIdentity & { message?: string } : {} as AccessState & AppIdentity;
    if (response.status === 401) {
      setUser(null);
      setAccess(null);
      setError('Your sign-in session expired. Sign in again.');
      setLoading(false);
      return;
    }
    if (response.status === 403) {
      setUser(null);
      setAccess(payload);
      setLoading(false);
      return;
    }
    if (!response.ok) {
      setError(payload.message || 'Unable to load your access record.');
      setLoading(false);
      return;
    }
    setUser(payload);
    setAccess(null);
    setLoading(false);
  };

  const requestAccess = async () => {
    setBusy(true);
    setError('');
    try {
      const token = await acquireApiToken();
      if (!token) throw Error('Unable to acquire an access token.');
      setAuthToken(token);
      const response = await fetch('/api/auth/request-access', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: access?.displayName }),
      });
      const payload = await response.json();
      if (!response.ok) throw Error(payload.message || 'Access request failed.');
      if (payload.accessStatus === 'Approved') await loadMe(token);
      else setAccess(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Access request failed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="access-shell"><div className="access-card"><h1>SystemScope</h1><p>Checking your access…</p></div></div>;
  }

  const signOut = () => {
    if (ssoConfigured) void signOutFromEntra();
    else window.location.reload();
  };

  if (user) {
    return <AuthContext.Provider value={{ user, signOut }}>{children}</AuthContext.Provider>;
  }

  return (
    <div className="access-shell">
      <div className="access-card">
        <h1>SystemScope</h1>
        <p>Sign in with your organisation Microsoft account. An administrator must approve access before you can use the application.</p>
        {error && <div className="access-error">{error}</div>}
        {access ? (
          <>
            <div className="access-info">
              <strong>{access.accessStatus === 'Pending' ? 'Access request pending' : 'No application access yet'}</strong>
              <p>{access.message}</p>
            </div>
            {access.canRequestAccess ? (
              <button className="access-button" disabled={busy} onClick={() => void requestAccess()}>{busy ? 'Submitting…' : 'Request access'}</button>
            ) : (
              <button className="access-button" disabled>Awaiting admin approval</button>
            )}
            <button className="access-link" onClick={() => void signOutFromEntra()}>Sign out</button>
          </>
        ) : (
          <button className="access-button" disabled={!ssoConfigured} onClick={() => void signInWithEntra()}>
            {ssoConfigured ? 'Sign in with DLGWV SSO' : 'SSO is not configured'}
          </button>
        )}
      </div>
    </div>
  );
}

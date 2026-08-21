import { useEffect, useState } from 'react';
import { api } from '../landscape/api';
import { formatDate } from '../market/types';
import '../market/market.css';
import { useAppUser } from './AccessGate';

type UserRow = {
  userId: string;
  email: string;
  displayName?: string;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  accessStatus: string;
  accessRequestedAt?: string;
  accessApprovedAt?: string;
  approvedByEmail?: string;
  accessNotes?: string;
  lastLoginAt?: string;
};

function isAdmin(roles: string[]) {
  return roles.some(r => r.toLowerCase() === 'admin' || r === 'Administrator');
}

export function UsersView() {
  const { user } = useAppUser();
  const canManage = user.permissions.includes('security.users.manage') || isAdmin(user.roles);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setError('');
    try {
      const payload = await api<{ users: UserRow[] }>('/security/users');
      setRows(payload.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load users.');
    }
  };

  useEffect(() => { if (canManage) void load(); }, [canManage]);

  const save = async (row: UserRow, accessStatus: string, isActive = row.isActive, roles = row.roles) => {
    setBusy(row.userId);
    setError('');
    try {
      const nextRoles = accessStatus === 'Approved' && roles.length === 0 ? ['user'] : roles;
      await api(`/security/users/${encodeURIComponent(row.userId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ accessStatus, roles: nextRoles, isActive }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save user access.');
    } finally {
      setBusy(null);
    }
  };

  if (!canManage) {
    return <section className="panel pad-form"><h2>Users</h2><p>This section is limited to security managers.</p></section>;
  }

  const pending = rows.filter(r => r.accessStatus === 'Pending').length;
  const approved = rows.filter(r => r.accessStatus === 'Approved' && r.isActive).length;

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>Users</h2>
          <p>Review access requests and approve people before they can use SystemScope.</p>
        </div>
        <button className="ghost" onClick={() => void load()}>Refresh</button>
      </div>
      <div className="scan-kpis" style={{ margin: 16 }}>
        <article><small>Tracked users</small><strong>{rows.length}</strong></article>
        <article><small>Pending requests</small><strong>{pending}</strong></article>
        <article><small>Approved users</small><strong>{approved}</strong></article>
      </div>
      {error && <div className="notice">{error}</div>}
      <div className="attr-head" style={{ gridTemplateColumns: '2fr 140px 120px 90px 140px 220px' }}>
        <span>User</span><span>Status</span><span>Role</span><span>Active</span><span>Requested</span><span />
      </div>
      {rows.map(row => (
        <div className="attr-row table" key={row.userId} style={{ gridTemplateColumns: '2fr 140px 120px 90px 140px 220px' }}>
          <span><b>{row.displayName || row.email}</b><small>{row.email}</small></span>
          <span>
            <select value={row.accessStatus} onChange={e => void save(row, e.target.value)} disabled={busy === row.userId}>
              <option>Pending</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </span>
          <span>
            <select
              value={isAdmin(row.roles) ? 'admin' : 'user'}
              disabled={busy === row.userId || row.accessStatus !== 'Approved'}
              onChange={e => void save(row, 'Approved', true, e.target.value === 'admin' ? ['admin', 'user'] : ['user'])}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </span>
          <span>{row.isActive ? 'Yes' : 'No'}</span>
          <span>{formatDate(row.accessRequestedAt)}</span>
          <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {row.accessStatus === 'Pending' && (
              <>
                <button className="primary compact" disabled={busy === row.userId} onClick={() => void save(row, 'Approved')}>Approve</button>
                <button className="ghost compact" disabled={busy === row.userId} onClick={() => void save(row, 'Rejected', false)}>Reject</button>
              </>
            )}
          </span>
        </div>
      ))}
      {!rows.length && <p className="pad">No user records yet. People appear here after they sign in and request access.</p>}
    </section>
  );
}

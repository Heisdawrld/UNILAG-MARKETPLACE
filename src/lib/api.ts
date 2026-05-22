// Shared API client for UNILAG Marketplace
const BASE = '';

export const api = {
  get: async (url: string) => {
    const res = await fetch(BASE + url, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `API Error: ${res.status}` }));
      throw new Error(err.error || `API Error: ${res.status}`);
    }
    return res.json();
  },
  post: async (url: string, body?: unknown) => {
    const res = await fetch(BASE + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },
  patch: async (url: string, body: unknown) => {
    const res = await fetch(BASE + url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Update failed' }));
      throw new Error(err.error || 'Update failed');
    }
    return res.json();
  },
  del: async (url: string) => {
    const res = await fetch(BASE + url, {
      method: 'DELETE',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(err.error || 'Delete failed');
    }
    return res.json();
  },
};

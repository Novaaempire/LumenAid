const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

export const api = {
  listCharities: (verified) =>
    request(`/api/charities${verified !== undefined ? `?verified=${verified}` : ''}`),
  getCharity: (id) => request(`/api/charities/${id}`),
  getDonations: (id, { limit, before } = {}) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    if (before) params.set('before', before);
    const qs = params.toString();
    return request(`/api/charities/${id}/donations${qs ? `?${qs}` : ''}`);
  },
  getAcceptedAssets: (id) => request(`/api/charities/${id}/assets`),
  createCharity: (payload, adminKey) =>
    request('/api/charities', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: JSON.stringify(payload),
    }),
  setVerified: (id, verified, adminKey) =>
    request(`/api/charities/${id}/verify`, {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey },
      body: JSON.stringify({ verified }),
    }),
};

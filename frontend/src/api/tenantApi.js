import client from './client';

export const tenantApi = {
  provision: (payload) =>
    client.post('/platform/tenants', payload, {
      headers: {
        'X-Platform-Api-Key': 'dev-only-platform-key-change-me',
      },
    }).then((r) => r.data),
};

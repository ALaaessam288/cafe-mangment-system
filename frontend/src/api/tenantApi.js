import client from './client';

/*
 * Tenant provisioning.
 *
 * This used to send a hardcoded 'X-Platform-Api-Key' that matched a value committed in
 * application.properties - the same key in every copy of the app, which meant anyone who opened
 * the installer could provision tenants on any installation. The key is now generated per
 * installation and the frontend has no way to know it, so the backend instead lets the very first
 * tenant through unauthenticated (there is nothing to protect on an empty database) and requires
 * the key for every call after that.
 *
 * If an operator has supplied a key out of band, it can be stashed under 'caffio_platform_key'
 * and it will be sent along.
 */
export const tenantApi = {
  provision: (payload) => {
    const operatorKey =
      typeof localStorage !== 'undefined' ? localStorage.getItem('caffio_platform_key') : null;

    return client
      .post('/platform/tenants', payload, {
        headers: operatorKey ? { 'X-Platform-Api-Key': operatorKey } : {},
      })
      .then((r) => r.data);
  },
};

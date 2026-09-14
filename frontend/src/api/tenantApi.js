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

  getMe: () => client.get('/tenant/me').then((r) => r.data),

  getUsage: () => client.get('/tenant/usage').then((r) => r.data),

  updateLogo: (logoUrl) => client.put('/tenant/logo', { logoUrl }).then((r) => r.data),

  /* Owner's own WhatsApp alert settings. Sends only the two fields the endpoint accepts —
     spreading a whole tenant object here is what produced three separate 500s on other
     screens, because the request records reject unknown properties. */
  updateWhatsApp: ({ ownerWhatsapp, whatsappAlertsEnabled }) =>
    client.put('/tenant/whatsapp', { ownerWhatsapp, whatsappAlertsEnabled }).then((r) => r.data),

  /* No recipient argument on purpose - the server sends to the number it has stored. */
  testWhatsApp: () => client.post('/tenant/whatsapp/test').then((r) => r.data),

  /** Takes a plan CODE. Only self-selectable plans (the trial) are accepted. */
  selectPlan: (planCode) => client.put('/tenant/plan', { plan: planCode }).then((r) => r.data),

  getSubscription: () => client.get('/tenant/subscription').then((r) => r.data),

  activateLicense: (key) => client.post('/tenant/license/activate', { key }).then((r) => r.data),
};

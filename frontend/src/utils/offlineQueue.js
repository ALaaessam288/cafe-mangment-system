/* ═══════════════════════════════════════════════
   CAFFIO OFFLINE RESILIENCE & INDEXED_DB QUEUE
   ═══════════════════════════════════════════════ */

const DB_NAME = 'caffio_offline_db';
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline_queue')) {
        db.createObjectStore('offline_queue', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('offline_cache')) {
        db.createObjectStore('offline_cache', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Enqueue an action to be executed when back online */
export async function enqueueOfflineAction(type, payload) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_queue', 'readwrite');
      const store = tx.objectStore('offline_queue');
      const record = {
        type,
        payload,
        createdAt: new Date().toISOString(),
        retryCount: 0
      };
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to enqueue offline action:', err);
  }
}

/** Retrieve all queued actions */
export async function getOfflineQueue() {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_queue', 'readonly');
      const store = tx.objectStore('offline_queue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return [];
  }
}

/** Remove an action once successfully synced */
export async function removeOfflineAction(id) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_queue', 'readwrite');
      const store = tx.objectStore('offline_queue');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to remove offline action:', err);
  }
}

/** Cache critical master data for offline access */
export async function cacheOfflineData(key, data) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_cache', 'readwrite');
      const store = tx.objectStore('offline_cache');
      const req = store.put({ key, data, updatedAt: new Date().toISOString() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to cache offline data:', err);
  }
}

/** Get cached master data */
export async function getCachedOfflineData(key) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_cache', 'readonly');
      const store = tx.objectStore('offline_cache');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return null;
  }
}
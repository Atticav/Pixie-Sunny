import { emptyState, normalizeState } from './models.js';

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, value);
    }
  };
};

const resolveStorage = (customStorage) => {
  if (customStorage) return customStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return memoryStorage();
};

export const sanitizeState = (raw) => {
  if (!raw || typeof raw !== 'object') return emptyState();
  return normalizeState(raw);
};

export const createStore = ({ key = 'pixieSunnyStudio', storage } = {}) => {
  const db = resolveStorage(storage);
  const backupKey = `${key}:backup`;
  const parseStoredState = (raw) => {
    if (!raw) return null;
    try {
      return sanitizeState(JSON.parse(raw));
    } catch {
      return null;
    }
  };

  const load = () => {
    const primary = parseStoredState(db.getItem(key));
    if (primary) return primary;

    const backup = parseStoredState(db.getItem(backupKey));
    if (backup) {
      try {
        db.setItem(key, JSON.stringify(backup));
      } catch {
        // fallback best-effort
      }
      return backup;
    }
    return emptyState();
  };

  const save = (state) => {
    const next = sanitizeState(state);
    const serialized = JSON.stringify(next);
    try {
      db.setItem(key, serialized);
    } catch {
    }
    try {
      db.setItem(backupKey, serialized);
    } catch {
    }
    return next;
  };

  const mutate = (updater) => {
    const next = updater(load());
    save(next);
    return next;
  };

  const upsert = (collection, item) =>
    mutate((state) => {
      const list = state[collection] ?? [];
      const idx = list.findIndex((entry) => entry.id === item.id);
      const nextList = [...list];
      if (idx >= 0) {
        nextList[idx] = item;
      } else {
        nextList.push(item);
      }
      return { ...state, [collection]: nextList };
    });

  const remove = (collection, id) =>
    mutate((state) => ({
      ...state,
      [collection]: (state[collection] ?? []).filter((item) => item.id !== id)
    }));

  return {
    load,
    save,
    mutate,
    upsert,
    remove
  };
};

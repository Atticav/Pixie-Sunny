import { emptyState } from './models.js';

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

export const createStore = ({ key = 'pixieSunnyStudio', storage } = {}) => {
  const db = resolveStorage(storage);

  const load = () => {
    const raw = db.getItem(key);
    if (!raw) return emptyState();
    try {
      return { ...emptyState(), ...JSON.parse(raw) };
    } catch {
      return emptyState();
    }
  };

  const save = (state) => {
    db.setItem(key, JSON.stringify(state));
    return state;
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
      if (idx >= 0) {
        list[idx] = item;
      } else {
        list.push(item);
      }
      return { ...state, [collection]: list };
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

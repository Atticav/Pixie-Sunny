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

export const sanitizeState = (raw) => {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    projects: Array.isArray(raw.projects) ? raw.projects : base.projects,
    books: Array.isArray(raw.books) ? raw.books : base.books,
    chapters: Array.isArray(raw.chapters) ? raw.chapters : base.chapters,
    scenes: Array.isArray(raw.scenes) ? raw.scenes : base.scenes,
    characters: Array.isArray(raw.characters) ? raw.characters : base.characters,
    loreEntries: Array.isArray(raw.loreEntries) ? raw.loreEntries : base.loreEntries,
    assets: Array.isArray(raw.assets) ? raw.assets : base.assets,
    settings: {
      ...base.settings,
      ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {})
    }
  };
};

export const createStore = ({ key = 'pixieSunnyStudio', storage } = {}) => {
  const db = resolveStorage(storage);

  const load = () => {
    const raw = db.getItem(key);
    if (!raw) return emptyState();
    try {
      return sanitizeState(JSON.parse(raw));
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { createProject } from '../src/models.js';
import { searchLore } from '../src/assistant.js';

const fakeStorage = () => {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    }
  };
};

test('store persists state in storage', () => {
  const storage = fakeStorage();
  const store = createStore({ key: 'test', storage });
  const data = store.load();
  data.projects.push(createProject({ name: 'A', tone: 'B' }));
  store.save(data);

  const loaded = store.load();
  assert.equal(loaded.projects.length, 1);
  assert.equal(loaded.projects[0].name, 'A');
});

test('lore search finds matching text', () => {
  const entries = [
    { title: 'Magia de Sangue', content: 'Ritual proibido na floresta antiga.' },
    { title: 'Ordem Solar', content: 'Guarda imperial da capital.' }
  ];

  const found = searchLore(entries, 'floresta');
  assert.equal(found.length, 1);
  assert.equal(found[0].title, 'Magia de Sangue');
});

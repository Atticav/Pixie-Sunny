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

test('lore search handles empty and case-insensitive queries', () => {
  const entries = [
    { title: 'Aliança Lunar', content: 'Pacto selado em ruínas antigas.' },
    { title: 'Guarda do Norte', content: 'Juramento no inverno eterno.' }
  ];

  assert.equal(searchLore(entries, '').length, 2);
  assert.equal(searchLore(entries, 'LUNAR').length, 1);
  assert.equal(searchLore(entries, '??').length, 0);
});

test('store load ignores unexpected parsed properties', () => {
  const storage = fakeStorage();
  storage.setItem(
    'test',
    JSON.stringify({ projects: [{ id: '1', name: 'A' }], injected: { malicious: true } })
  );
  const store = createStore({ key: 'test', storage });
  const loaded = store.load();

  assert.equal(loaded.projects.length, 1);
  assert.equal(loaded.injected, undefined);
});

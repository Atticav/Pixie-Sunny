import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, sanitizeState } from '../src/store.js';
import {
  createBook,
  createChapter,
  createCharacter,
  createLoreEntry,
  createProject,
  createScene,
  deleteEntity
} from '../src/models.js';
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

test('sanitizeState removes orphaned nested records after import', () => {
  const sanitized = sanitizeState({
    projects: [{ id: 'project-1', name: 'Projeto A' }],
    books: [
      { id: 'book-1', projectId: 'project-1', title: 'Livro A' },
      { id: 'book-2', projectId: 'ghost-project', title: 'Livro órfão' }
    ],
    chapters: [
      { id: 'chapter-1', projectId: 'project-1', bookId: 'book-1', title: 'Capítulo A' },
      { id: 'chapter-2', projectId: 'project-1', bookId: 'ghost-book', title: 'Capítulo órfão' }
    ],
    scenes: [
      { id: 'scene-1', projectId: 'project-1', chapterId: 'chapter-1', title: 'Cena A' },
      { id: 'scene-2', projectId: 'project-1', chapterId: 'ghost-chapter', title: 'Cena órfã' }
    ],
    characters: [
      { id: 'character-1', projectId: 'project-1', name: 'Lyra' },
      { id: 'character-2', projectId: 'ghost-project', name: 'Órfã' }
    ],
    loreEntries: [
      { id: 'lore-1', projectId: 'project-1', title: 'Canon', content: 'Fato válido' },
      { id: 'lore-2', projectId: 'ghost-project', title: 'Ghost', content: 'Fato inválido' }
    ]
  });

  assert.deepEqual(sanitized.projects.map((entry) => entry.id), ['project-1']);
  assert.deepEqual(sanitized.books.map((entry) => entry.id), ['book-1']);
  assert.deepEqual(sanitized.chapters.map((entry) => entry.id), ['chapter-1']);
  assert.deepEqual(sanitized.scenes.map((entry) => entry.id), ['scene-1']);
  assert.deepEqual(sanitized.characters.map((entry) => entry.id), ['character-1']);
  assert.deepEqual(sanitized.loreEntries.map((entry) => entry.id), ['lore-1']);
});

test('deleteEntity removes a whole project graph', () => {
  const project = createProject({ name: 'Universo', tone: 'Sombrio' });
  const otherProject = createProject({ name: 'Outro', tone: 'Solar' });
  const book = createBook({ projectId: project.id, title: 'Livro' });
  const chapter = createChapter({ projectId: project.id, bookId: book.id, title: 'Capítulo' });
  const scene = createScene({ projectId: project.id, chapterId: chapter.id, title: 'Cena', description: 'Acontece algo' });
  const character = createCharacter({ projectId: project.id, name: 'Nora' });
  const lore = createLoreEntry({ projectId: project.id, title: 'Lei', content: 'Nada de ferro frio.' });

  const next = deleteEntity(
    {
      projects: [project, otherProject],
      books: [book],
      chapters: [chapter],
      scenes: [scene],
      characters: [character],
      loreEntries: [lore],
      assets: [],
      settings: {}
    },
    'project',
    project.id
  );

  assert.deepEqual(next.projects.map((entry) => entry.id), [otherProject.id]);
  assert.equal(next.books.length, 0);
  assert.equal(next.chapters.length, 0);
  assert.equal(next.scenes.length, 0);
  assert.equal(next.characters.length, 0);
  assert.equal(next.loreEntries.length, 0);
});

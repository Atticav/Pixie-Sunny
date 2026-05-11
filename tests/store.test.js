import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, sanitizeState } from '../src/store.js';
import {
  createPromptDocument,
  createBook,
  createChapter,
  createCharacter,
  createGenerationJob,
  createGenerationOutput,
  createLoreEntry,
  createProject,
  createReferenceImage,
  createScene,
  deleteEntity,
  CHAPTER_STATUSES,
  IMAGE_GEN_TYPES,
  IMAGE_GEN_STATUSES,
  REFERENCE_TYPES
} from '../src/models.js';
import { buildCharacterPromptPack, buildScenePromptPack, inferSceneCharactersFromContext, searchLore } from '../src/assistant.js';

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

test('createChapter includes writer studio fields with correct defaults', () => {
  const project = createProject({ name: 'Teste' });
  const book = createBook({ projectId: project.id, title: 'Livro' });
  const chapter = createChapter({ projectId: project.id, bookId: book.id, title: 'Cap' });

  assert.equal(chapter.status, 'rascunho');
  assert.equal(chapter.notes, '');
  assert.equal(chapter.goal, '');
  assert.equal(chapter.conflict, '');
  assert.deepEqual(chapter.presentCharacters, []);
  assert.equal(chapter.continuity, '');
  assert.equal(chapter.wordGoal, 0);
});

test('createChapter stores custom writer studio fields', () => {
  const project = createProject({ name: 'Teste' });
  const book = createBook({ projectId: project.id, title: 'Livro' });
  const chapter = createChapter({
    projectId: project.id,
    bookId: book.id,
    title: 'Cap',
    status: 'finalizado',
    notes: 'Revisar ritmo',
    goal: 'Revelar segredo',
    conflict: 'Protagonista vs destino',
    presentCharacters: ['Lyra', 'Kael'],
    continuity: 'Após o duelo',
    wordGoal: 2500
  });

  assert.equal(chapter.status, 'finalizado');
  assert.equal(chapter.notes, 'Revisar ritmo');
  assert.equal(chapter.goal, 'Revelar segredo');
  assert.equal(chapter.conflict, 'Protagonista vs destino');
  assert.deepEqual(chapter.presentCharacters, ['Lyra', 'Kael']);
  assert.equal(chapter.continuity, 'Após o duelo');
  assert.equal(chapter.wordGoal, 2500);
});

test('normalizeChapter coerces invalid status to rascunho', () => {
  const sanitized = sanitizeState({
    projects: [{ id: 'p1', name: 'P' }],
    books: [{ id: 'b1', projectId: 'p1', title: 'L' }],
    chapters: [
      { id: 'c1', projectId: 'p1', bookId: 'b1', title: 'Cap', status: 'invalido' },
      { id: 'c2', projectId: 'p1', bookId: 'b1', title: 'Cap2', status: 'finalizado' }
    ]
  });

  assert.equal(sanitized.chapters.find((c) => c.id === 'c1').status, 'rascunho');
  assert.equal(sanitized.chapters.find((c) => c.id === 'c2').status, 'finalizado');
});

test('CHAPTER_STATUSES contains expected values', () => {
  assert.deepEqual(CHAPTER_STATUSES, ['rascunho', 'revisão', 'finalizado']);
});

test('store persists chapter writer studio fields across save/load', () => {
  const storage = fakeStorage();
  const store = createStore({ key: 'test-ws', storage });
  const project = createProject({ name: 'WS Test' });
  const book = createBook({ projectId: project.id, title: 'Livro' });
  const chapter = createChapter({
    projectId: project.id,
    bookId: book.id,
    title: 'Capítulo WS',
    status: 'revisão',
    notes: 'Nota de teste',
    wordGoal: 1000
  });

  store.save({ ...store.load(), projects: [project], books: [book], chapters: [chapter] });
  const loaded = store.load();

  assert.equal(loaded.chapters[0].status, 'revisão');
  assert.equal(loaded.chapters[0].notes, 'Nota de teste');
  assert.equal(loaded.chapters[0].wordGoal, 1000);
});

test('createCharacter includes visual canon fields with correct defaults', () => {
  const project = createProject({ name: 'Universo' });
  const character = createCharacter({ projectId: project.id, name: 'Lyra' });

  assert.equal(character.apparentAge, '');
  assert.equal(character.genderPresentation, '');
  assert.equal(character.skinTone, '');
  assert.equal(character.hair, '');
  assert.equal(character.eyes, '');
  assert.equal(character.faceShape, '');
  assert.equal(character.bodyType, '');
  assert.equal(character.marks, '');
  assert.equal(character.typicalClothing, '');
  assert.equal(character.accessories, '');
  assert.equal(character.dominantExpression, '');
  assert.equal(character.presence, '');
  assert.equal(character.visualAesthetic, '');
  assert.equal(character.colorPalette, '');
  assert.equal(character.periodStyle, '');
  assert.deepEqual(character.fixedTraits, []);
  assert.deepEqual(character.variableTraits, []);
  assert.deepEqual(character.consistencyRules, []);
  assert.deepEqual(character.visualTags, []);
  assert.equal(character.cinematicNotes, '');
  assert.equal(character.masterPrompt, '');
  assert.equal(character.negativePrompt, '');
});

test('createCharacter stores custom visual canon fields', () => {
  const project = createProject({ name: 'Universo' });
  const character = createCharacter({
    projectId: project.id,
    name: 'Lyra',
    apparentAge: '28-32',
    skinTone: 'médio acobreado',
    eyes: 'azul-acinzentados',
    hair: 'ruivo acobreado, ondulado',
    fixedTraits: ['sardas', 'olhos azul-acinzentados'],
    variableTraits: ['expressão', 'pose'],
    consistencyRules: ['nunca mudar cor dos olhos', 'não usar roupa moderna'],
    visualTags: ['ruiva', 'sardas', 'medieval'],
    cinematicNotes: 'luz suave exalta sardas',
    masterPrompt: 'ruiva com sardas, olhos azul-cinza',
    negativePrompt: 'anime, cartoon'
  });

  assert.equal(character.apparentAge, '28-32');
  assert.equal(character.skinTone, 'médio acobreado');
  assert.equal(character.eyes, 'azul-acinzentados');
  assert.equal(character.hair, 'ruivo acobreado, ondulado');
  assert.deepEqual(character.fixedTraits, ['sardas', 'olhos azul-acinzentados']);
  assert.deepEqual(character.variableTraits, ['expressão', 'pose']);
  assert.deepEqual(character.consistencyRules, ['nunca mudar cor dos olhos', 'não usar roupa moderna']);
  assert.deepEqual(character.visualTags, ['ruiva', 'sardas', 'medieval']);
  assert.equal(character.cinematicNotes, 'luz suave exalta sardas');
  assert.equal(character.masterPrompt, 'ruiva com sardas, olhos azul-cinza');
  assert.equal(character.negativePrompt, 'anime, cartoon');
});

test('REFERENCE_TYPES contains all expected types', () => {
  assert.deepEqual(REFERENCE_TYPES, ['character', 'place', 'scene', 'clothing', 'aesthetic', 'pose', 'lighting', 'object']);
});

test('createReferenceImage creates a reference with required fields', () => {
  const project = createProject({ name: 'P' });
  const character = createCharacter({ projectId: project.id, name: 'Lyra' });
  const ref = createReferenceImage({
    projectId: project.id,
    characterId: character.id,
    name: 'Rosto canônico',
    type: 'character',
    dataUrl: 'data:image/png;base64,abc123',
    isCanonical: true,
    preserve: 'estrutura facial, sardas',
    mayVary: 'ângulo, expressão',
    notes: 'Referência oficial'
  });

  assert.ok(ref.id);
  assert.equal(ref.projectId, project.id);
  assert.equal(ref.characterId, character.id);
  assert.equal(ref.name, 'Rosto canônico');
  assert.equal(ref.type, 'character');
  assert.equal(ref.dataUrl, 'data:image/png;base64,abc123');
  assert.equal(ref.isCanonical, true);
  assert.equal(ref.preserve, 'estrutura facial, sardas');
  assert.equal(ref.mayVary, 'ângulo, expressão');
  assert.equal(ref.notes, 'Referência oficial');
  assert.ok(ref.createdAt);
});

test('createReferenceImage has correct defaults', () => {
  const project = createProject({ name: 'P' });
  const ref = createReferenceImage({ projectId: project.id, name: 'Ref' });

  assert.equal(ref.characterId, '');
  assert.equal(ref.type, 'character');
  assert.equal(ref.dataUrl, '');
  assert.equal(ref.localPath, '');
  assert.equal(ref.fileName, '');
  assert.equal(ref.linkedEntityId, '');
  assert.equal(ref.linkedEntityType, '');
  assert.equal(ref.isCanonical, false);
  assert.equal(ref.preserve, '');
  assert.equal(ref.mayVary, '');
  assert.equal(ref.notes, '');
});

test('normalizeState preserves local workspace settings and merges defaults', () => {
  const sanitized = sanitizeState({
    settings: {
      localWorkspace: {
        enabled: false,
        rootPath: '/Custom/Workspace',
        directories: {
          projects: 'my-projects'
        },
        preferences: {
          saveExportsToWorkspace: false
        }
      }
    }
  });

  assert.equal(sanitized.settings.localWorkspace.enabled, false);
  assert.equal(sanitized.settings.localWorkspace.rootPath, '/Custom/Workspace');
  assert.equal(sanitized.settings.localWorkspace.directories.projects, 'my-projects');
  assert.equal(sanitized.settings.localWorkspace.directories.references, 'references');
  assert.equal(sanitized.settings.localWorkspace.preferences.saveExportsToWorkspace, false);
  assert.equal(sanitized.settings.localWorkspace.preferences.autoMirrorProjectState, true);
});

test('normalizeState includes referenceImages from raw data', () => {
  const sanitized = sanitizeState({
    projects: [{ id: 'p1', name: 'Projeto A' }],
    characters: [{ id: 'c1', projectId: 'p1', name: 'Lyra' }],
    referenceImages: [
      { id: 'r1', projectId: 'p1', characterId: 'c1', name: 'Rosto', type: 'character' },
      { id: 'r2', projectId: 'ghost-project', characterId: 'c1', name: 'Órfã', type: 'place' }
    ]
  });

  assert.equal(sanitized.referenceImages.length, 1);
  assert.equal(sanitized.referenceImages[0].id, 'r1');
  assert.equal(sanitized.referenceImages[0].type, 'character');
});

test('normalizeState coerces invalid reference type to character', () => {
  const sanitized = sanitizeState({
    projects: [{ id: 'p1', name: 'P' }],
    referenceImages: [
      { id: 'r1', projectId: 'p1', name: 'Ref', type: 'invalid-type' }
    ]
  });

  assert.equal(sanitized.referenceImages[0].type, 'character');
});

test('deleteEntity removes character and its referenceImages', () => {
  const project = createProject({ name: 'P' });
  const character = createCharacter({ projectId: project.id, name: 'Lyra' });
  const otherCharacter = createCharacter({ projectId: project.id, name: 'Kael' });
  const ref1 = createReferenceImage({ projectId: project.id, characterId: character.id, name: 'R1' });
  const ref2 = createReferenceImage({ projectId: project.id, characterId: otherCharacter.id, name: 'R2' });

  const next = deleteEntity(
    { projects: [project], books: [], chapters: [], scenes: [], characters: [character, otherCharacter], loreEntries: [], assets: [], referenceImages: [ref1, ref2] },
    'character',
    character.id
  );

  assert.equal(next.characters.length, 1);
  assert.equal(next.characters[0].id, otherCharacter.id);
  assert.equal(next.referenceImages.length, 1);
  assert.equal(next.referenceImages[0].id, ref2.id);
});

test('deleteEntity removes project and its referenceImages', () => {
  const project = createProject({ name: 'P' });
  const character = createCharacter({ projectId: project.id, name: 'Lyra' });
  const ref = createReferenceImage({ projectId: project.id, characterId: character.id, name: 'R1' });

  const next = deleteEntity(
    { projects: [project], books: [], chapters: [], scenes: [], characters: [character], loreEntries: [], assets: [], referenceImages: [ref] },
    'project',
    project.id
  );

  assert.equal(next.projects.length, 0);
  assert.equal(next.characters.length, 0);
  assert.equal(next.referenceImages.length, 0);
});

test('deleteEntity removes a single referenceImage by id', () => {
  const project = createProject({ name: 'P' });
  const ref1 = createReferenceImage({ projectId: project.id, name: 'R1' });
  const ref2 = createReferenceImage({ projectId: project.id, name: 'R2' });

  const next = deleteEntity(
    { projects: [project], books: [], chapters: [], scenes: [], characters: [], loreEntries: [], assets: [], referenceImages: [ref1, ref2] },
    'referenceImage',
    ref1.id
  );

  assert.equal(next.referenceImages.length, 1);
  assert.equal(next.referenceImages[0].id, ref2.id);
});

test('store persists character visual canon fields across save/load', () => {
  const storage = fakeStorage();
  const store = createStore({ key: 'test-canon', storage });
  const project = createProject({ name: 'Canon Test' });
  const character = createCharacter({
    projectId: project.id,
    name: 'Lyra',
    apparentAge: '28',
    eyes: 'azul-acinzentados',
    fixedTraits: ['sardas', 'olhos azul-acinzentados'],
    consistencyRules: ['nunca mudar cor dos olhos']
  });
  const ref = createReferenceImage({ projectId: project.id, characterId: character.id, name: 'Rosto', type: 'character', isCanonical: true });

  store.save({ ...store.load(), projects: [project], characters: [character], referenceImages: [ref] });
  const loaded = store.load();

  assert.equal(loaded.characters[0].apparentAge, '28');
  assert.equal(loaded.characters[0].eyes, 'azul-acinzentados');
  assert.deepEqual(loaded.characters[0].fixedTraits, ['sardas', 'olhos azul-acinzentados']);
  assert.deepEqual(loaded.characters[0].consistencyRules, ['nunca mudar cor dos olhos']);
  assert.equal(loaded.referenceImages.length, 1);
  assert.equal(loaded.referenceImages[0].name, 'Rosto');
  assert.equal(loaded.referenceImages[0].isCanonical, true);
});

test('createPromptDocument includes versioning and export-friendly defaults', () => {
  const project = createProject({ name: 'Prompt Test' });
  const promptDocument = createPromptDocument({
    projectId: project.id,
    title: 'Lyra · Prompt mestre',
    targetType: 'character',
    targetId: 'char-1'
  });

  assert.equal(promptDocument.promptMedium, 'image');
  assert.equal(promptDocument.targetType, 'character');
  assert.equal(promptDocument.targetId, 'char-1');
  assert.equal(promptDocument.versions.length, 1);
  assert.ok(promptDocument.activeVersionId);
  assert.equal(promptDocument.isFavorite, false);
  assert.equal(promptDocument.isOfficial, false);
});

test('normalizeState keeps prompt documents for valid project and target', () => {
  const sanitized = sanitizeState({
    projects: [{ id: 'p1', name: 'Projeto A' }],
    books: [{ id: 'b1', projectId: 'p1', title: 'Livro' }],
    chapters: [{ id: 'ch1', projectId: 'p1', bookId: 'b1', title: 'Capítulo' }],
    scenes: [{ id: 's1', projectId: 'p1', chapterId: 'ch1', title: 'Cena', description: 'Desc' }],
    characters: [{ id: 'c1', projectId: 'p1', name: 'Lyra' }],
    promptDocuments: [
      {
        id: 'pd1',
        projectId: 'p1',
        title: 'Prompt personagem',
        targetType: 'character',
        targetId: 'c1',
        versions: [{ id: 'v1', label: 'V1', masterPrompt: 'abc' }],
        activeVersionId: 'v1'
      },
      {
        id: 'pd2',
        projectId: 'p1',
        title: 'Prompt órfão',
        targetType: 'scene',
        targetId: 'ghost-scene',
        versions: [{ id: 'v2', label: 'V2' }],
        activeVersionId: 'v2'
      }
    ]
  });

  assert.equal(sanitized.promptDocuments.length, 1);
  assert.equal(sanitized.promptDocuments[0].id, 'pd1');
  assert.equal(sanitized.promptDocuments[0].versions[0].masterPrompt, 'abc');
});

test('deleteEntity removes prompt documents linked to deleted character, scene and references', () => {
  const project = createProject({ name: 'P' });
  const book = createBook({ projectId: project.id, title: 'Livro' });
  const chapter = createChapter({ projectId: project.id, bookId: book.id, title: 'Capítulo' });
  const scene = createScene({ projectId: project.id, chapterId: chapter.id, title: 'Cena', description: 'Desc' });
  const character = createCharacter({ projectId: project.id, name: 'Lyra' });
  const reference = createReferenceImage({ projectId: project.id, characterId: character.id, name: 'Ref' });
  const charPrompt = createPromptDocument({
    projectId: project.id,
    title: 'Prompt personagem',
    targetType: 'character',
    targetId: character.id,
    referenceIds: [reference.id]
  });
  const scenePrompt = createPromptDocument({
    projectId: project.id,
    title: 'Prompt cena',
    targetType: 'scene',
    targetId: scene.id,
    referenceIds: [reference.id]
  });

  const afterReferenceDelete = deleteEntity(
    {
      projects: [project],
      books: [book],
      chapters: [chapter],
      scenes: [scene],
      characters: [character],
      loreEntries: [],
      assets: [],
      referenceImages: [reference],
      promptDocuments: [charPrompt, scenePrompt]
    },
    'referenceImage',
    reference.id
  );
  assert.deepEqual(afterReferenceDelete.promptDocuments.map((entry) => entry.referenceIds), [[], []]);

  const afterCharacterDelete = deleteEntity(afterReferenceDelete, 'character', character.id);
  assert.equal(afterCharacterDelete.promptDocuments.length, 1);
  assert.equal(afterCharacterDelete.promptDocuments[0].id, scenePrompt.id);

  const afterSceneDelete = deleteEntity(afterCharacterDelete, 'scene', scene.id);
  assert.equal(afterSceneDelete.promptDocuments.length, 0);
});

test('buildCharacterPromptPack uses canon, references and preserve-vary controls', () => {
  const character = createCharacter({
    projectId: 'p1',
    name: 'Lyra',
    hair: 'ruivo acobreado',
    eyes: 'azul-acinzentados',
    marks: 'sardas',
    fixedTraits: ['rosto', 'sardas'],
    variableTraits: ['pose'],
    consistencyRules: ['nunca mudar cor dos olhos'],
    negativePrompt: 'baixa resolução'
  });
  const pack = buildCharacterPromptPack({
    character,
    projectTone: 'fantasia sombria',
    references: [{ name: 'Rosto oficial', type: 'character', preserve: 'estrutura facial', mayVary: 'ângulo' }],
    preserve: ['olhos'],
    vary: ['expressão']
  });

  assert.match(pack.masterPrompt, /Lyra/);
  assert.match(pack.masterPrompt, /estrutura facial/);
  assert.match(pack.negativePrompt, /baixa resolução/);
  assert.deepEqual(pack.fixedChecklist, ['rosto', 'sardas', 'olhos', 'estrutura facial']);
  assert.ok(pack.variations.some((entry) => entry.includes('expressão')));
});

test('buildScenePromptPack uses chapter, lore and references for scene outputs', () => {
  const scene = createScene({
    projectId: 'p1',
    chapterId: 'ch1',
    title: 'Duelo na ponte',
    description: 'Lyra enfrenta Kael sob chuva gelada.',
    location: 'ponte de pedra'
  });
  const chapter = createChapter({
    projectId: 'p1',
    bookId: 'b1',
    title: 'Capítulo',
    summary: 'Lyra e Kael se encontram na fronteira.',
    presentCharacters: ['Lyra', 'Kael']
  });
  const lyra = createCharacter({ projectId: 'p1', name: 'Lyra', fixedTraits: ['sardas'], variableTraits: ['ângulo'] });
  const kael = createCharacter({ projectId: 'p1', name: 'Kael', fixedTraits: ['capa escura'] });
  const pack = buildScenePromptPack({
    projectTone: 'fantasia sombria',
    scene,
    chapter,
    characters: [lyra, kael],
    loreEntries: [{ title: 'Ponte antiga', content: 'Marco de guerra ancestral.' }],
    references: [{ name: 'Atmosfera da ponte', type: 'place', preserve: 'névoa fria', mayVary: 'clima' }],
    emotionalTone: 'tensão contida',
    environment: 'chuva, névoa',
    lighting: 'lua fria',
    composition: 'plano médio dramático',
    preserve: ['identidade dos personagens'],
    vary: ['distância da câmera']
  });

  assert.match(pack.scenePrompt, /Duelo na ponte/);
  assert.match(pack.scenePrompt, /Marco de guerra ancestral/);
  assert.match(pack.cinematicPrompt, /tensão contida/);
  assert.ok(pack.fixedChecklist.includes('identidade dos personagens'));
  assert.ok(pack.variations.length >= 3);
});

test('inferSceneCharactersFromContext avoids substring false positives', () => {
  const scene = createScene({
    projectId: 'p1',
    chapterId: 'ch1',
    title: 'Banana na feira',
    description: 'A análise da vila continua.',
    location: 'mercado'
  });
  const chapter = createChapter({
    projectId: 'p1',
    bookId: 'b1',
    title: 'Capítulo',
    summary: 'Somente Kael está presente.',
    presentCharacters: ['Kael']
  });
  const ana = createCharacter({ projectId: 'p1', name: 'Ana' });
  const kael = createCharacter({ projectId: 'p1', name: 'Kael' });

  const found = inferSceneCharactersFromContext([ana, kael], scene, chapter);

  assert.deepEqual(found.map((entry) => entry.name), ['Kael']);
});

test('IMAGE_GEN_TYPES and IMAGE_GEN_STATUSES contain expected values', () => {
  assert.deepEqual(IMAGE_GEN_TYPES, ['character', 'scene', 'environment', 'portrait', 'variation']);
  assert.deepEqual(IMAGE_GEN_STATUSES, ['pending', 'running', 'done', 'error']);
});

test('createGenerationJob creates a job with required fields and defaults', () => {
  const project = createProject({ name: 'Projeto' });
  const job = createGenerationJob({
    projectId: project.id,
    prompt: 'Lyra, close-up portrait',
    generationType: 'portrait',
    params: { resolution: '512x768', steps: 28, seed: 42 },
    providerType: 'mock',
    providerLabel: 'Mock'
  });

  assert.ok(job.id);
  assert.equal(job.projectId, project.id);
  assert.equal(job.generationType, 'portrait');
  assert.equal(job.prompt, 'Lyra, close-up portrait');
  assert.equal(job.status, 'pending');
  assert.equal(job.providerType, 'mock');
  assert.deepEqual(job.outputs, []);
  assert.deepEqual(job.referenceIds, []);
  assert.equal(job.errorMessage, '');
  assert.ok(job.createdAt);
});

test('createGenerationOutput creates output with required fields and defaults', () => {
  const project = createProject({ name: 'Projeto' });
  const output = createGenerationOutput({
    projectId: project.id,
    jobId: 'job-1',
    prompt: 'Lyra portrait',
    generationType: 'portrait',
    seed: 42,
    dataUrl: 'data:image/svg+xml;base64,abc'
  });

  assert.ok(output.id);
  assert.equal(output.projectId, project.id);
  assert.equal(output.jobId, 'job-1');
  assert.equal(output.prompt, 'Lyra portrait');
  assert.equal(output.generationType, 'portrait');
  assert.equal(output.seed, 42);
  assert.equal(output.dataUrl, 'data:image/svg+xml;base64,abc');
  assert.equal(output.isFavorite, false);
  assert.equal(output.isCanonical, false);
  assert.ok(output.createdAt);
});

test('normalizeState includes generationJobs from raw data', () => {
  const sanitized = sanitizeState({
    projects: [{ id: 'p1', name: 'Projeto A' }],
    generationJobs: [
      {
        id: 'j1',
        projectId: 'p1',
        generationType: 'character',
        prompt: 'Lyra portrait',
        status: 'done',
        outputs: [
          {
            id: 'o1',
            projectId: 'p1',
            jobId: 'j1',
            generationType: 'character',
            prompt: 'Lyra portrait',
            seed: 42
          }
        ]
      },
      {
        id: 'j2',
        projectId: 'ghost-project',
        generationType: 'scene',
        prompt: 'Orphan job',
        status: 'pending',
        outputs: []
      }
    ]
  });

  assert.equal(sanitized.generationJobs.length, 1);
  assert.equal(sanitized.generationJobs[0].id, 'j1');
  assert.equal(sanitized.generationJobs[0].outputs.length, 1);
  assert.equal(sanitized.generationJobs[0].outputs[0].id, 'o1');
});

test('normalizeState applies default imageGenProvider settings', () => {
  const sanitized = sanitizeState({});
  assert.equal(sanitized.settings.imageGenProvider.type, 'mock');
  assert.equal(sanitized.settings.imageGenProvider.steps, 28);
  assert.equal(sanitized.settings.imageGenProvider.seed, -1);
  assert.equal(sanitized.settings.imageGenProvider.seedLocked, false);
  assert.equal(sanitized.settings.imageGenProvider.resolution, '512x768');
});

test('normalizeState preserves custom imageGenProvider settings', () => {
  const sanitized = sanitizeState({
    settings: {
      imageGenProvider: {
        type: 'local-api',
        endpoint: 'http://127.0.0.1:8080',
        steps: 40,
        seed: 12345,
        seedLocked: true,
        resolution: '768x1024',
        cfgScale: 9
      }
    }
  });

  assert.equal(sanitized.settings.imageGenProvider.type, 'local-api');
  assert.equal(sanitized.settings.imageGenProvider.endpoint, 'http://127.0.0.1:8080');
  assert.equal(sanitized.settings.imageGenProvider.steps, 40);
  assert.equal(sanitized.settings.imageGenProvider.seed, 12345);
  assert.equal(sanitized.settings.imageGenProvider.seedLocked, true);
  assert.equal(sanitized.settings.imageGenProvider.resolution, '768x1024');
  assert.equal(sanitized.settings.imageGenProvider.cfgScale, 9);
});

test('deleteEntity removes generationJobs when project is deleted', () => {
  const project = createProject({ name: 'P' });
  const otherProject = createProject({ name: 'Q' });
  const job = createGenerationJob({ projectId: project.id, prompt: 'test' });
  const otherJob = createGenerationJob({ projectId: otherProject.id, prompt: 'other' });

  const result = deleteEntity(
    {
      projects: [project, otherProject],
      books: [],
      chapters: [],
      scenes: [],
      characters: [],
      loreEntries: [],
      assets: [],
      referenceImages: [],
      promptDocuments: [],
      generationJobs: [job, otherJob]
    },
    'project',
    project.id
  );

  assert.equal(result.projects.length, 1);
  assert.equal(result.generationJobs.length, 1);
  assert.equal(result.generationJobs[0].id, otherJob.id);
});

test('deleteEntity removes a single generationJob by id', () => {
  const project = createProject({ name: 'P' });
  const job1 = createGenerationJob({ projectId: project.id, prompt: 'a' });
  const job2 = createGenerationJob({ projectId: project.id, prompt: 'b' });

  const result = deleteEntity(
    {
      projects: [project],
      books: [],
      chapters: [],
      scenes: [],
      characters: [],
      loreEntries: [],
      assets: [],
      referenceImages: [],
      promptDocuments: [],
      generationJobs: [job1, job2]
    },
    'generationJob',
    job1.id
  );

  assert.equal(result.generationJobs.length, 1);
  assert.equal(result.generationJobs[0].id, job2.id);
});

test('deleteEntity removes a single generationOutput by id', () => {
  const project = createProject({ name: 'P' });
  const out1 = createGenerationOutput({ projectId: project.id, jobId: 'j1', prompt: 'a', seed: 1 });
  const out2 = createGenerationOutput({ projectId: project.id, jobId: 'j1', prompt: 'b', seed: 2 });
  const job = { ...createGenerationJob({ projectId: project.id, prompt: 'test' }), outputs: [out1, out2] };

  const result = deleteEntity(
    {
      projects: [project],
      books: [],
      chapters: [],
      scenes: [],
      characters: [],
      loreEntries: [],
      assets: [],
      referenceImages: [],
      promptDocuments: [],
      generationJobs: [job]
    },
    'generationOutput',
    out1.id
  );

  assert.equal(result.generationJobs[0].outputs.length, 1);
  assert.equal(result.generationJobs[0].outputs[0].id, out2.id);
});

test('store persists generationJobs across save/load', () => {
  const storage = fakeStorage();
  const store = createStore({ key: 'test-gen', storage });
  const project = createProject({ name: 'Test' });
  const job = createGenerationJob({
    projectId: project.id,
    prompt: 'portrait test',
    generationType: 'portrait',
    providerType: 'mock',
    params: { seed: 99, steps: 20 }
  });
  const output = createGenerationOutput({
    projectId: project.id,
    jobId: job.id,
    prompt: 'portrait test',
    seed: 99,
    generationType: 'portrait',
    isFavorite: true
  });
  job.status = 'done';
  output.isFavorite = true;
  job.outputs = [output];

  store.save({ ...store.load(), projects: [project], generationJobs: [job] });
  const loaded = store.load();

  assert.equal(loaded.generationJobs.length, 1);
  assert.equal(loaded.generationJobs[0].id, job.id);
  assert.equal(loaded.generationJobs[0].status, 'done');
  assert.equal(loaded.generationJobs[0].outputs.length, 1);
  assert.equal(loaded.generationJobs[0].outputs[0].isFavorite, true);
  assert.equal(loaded.generationJobs[0].outputs[0].seed, 99);
});

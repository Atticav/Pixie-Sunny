import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, sanitizeState } from '../src/store.js';
import {
  createAsset,
  createBeat,
  createPromptDocument,
  createBook,
  createCanonPromotion,
  createDecisionEvent,
  createChapter,
  createCharacter,
  createGenerationJob,
  createGenerationOutput,
  createLoreEntry,
  createProject,
  createReferenceImage,
  createScene,
  createShot,
  createWorkspaceSandbox,
  createWorkspaceCheckpoint,
  deleteEntity,
  CANON_PROMOTION_TYPES,
  CHAPTER_STATUSES,
  DECISION_RESULT_STATUSES,
  DECISION_SCOPE_TYPES,
  DECISION_TYPES,
  IMAGE_GEN_TYPES,
  IMAGE_GEN_STATUSES,
  OUTPUT_REVIEW_STATUSES,
  REFERENCE_TYPES,
  SHOT_STATUSES,
  WORKSPACE_SANDBOX_STATUSES
} from '../src/models.js';
import { buildCharacterPromptPack, buildScenePromptPack, inferSceneCharactersFromContext, searchLore } from '../src/assistant.js';
import { buildAssistivePlanningBundle } from '../src/assistive-planning.js';

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

test('OUTPUT_REVIEW_STATUSES and CANON_PROMOTION_TYPES contain expected values', () => {
  assert.deepEqual(OUTPUT_REVIEW_STATUSES, ['unreviewed', 'candidate', 'favorite', 'rejected', 'archived']);
  assert.deepEqual(CANON_PROMOTION_TYPES, ['character', 'place', 'scene', 'aesthetic']);
});

test('createGenerationOutput includes review fields with correct defaults', () => {
  const project = createProject({ name: 'P' });
  const output = createGenerationOutput({
    projectId: project.id,
    jobId: 'j1',
    prompt: 'Lyra portrait',
    generationType: 'portrait',
    seed: 42
  });

  assert.equal(output.reviewStatus, 'unreviewed');
  assert.equal(output.isBestReference, false);
  assert.equal(output.notes, '');
  assert.equal(output.score, 0);
});

test('createGenerationOutput stores custom review fields', () => {
  const project = createProject({ name: 'P' });
  const output = createGenerationOutput({
    projectId: project.id,
    jobId: 'j1',
    prompt: 'test',
    reviewStatus: 'candidate',
    isBestReference: true,
    notes: 'boa composição',
    score: 4
  });

  assert.equal(output.reviewStatus, 'candidate');
  assert.equal(output.isBestReference, true);
  assert.equal(output.notes, 'boa composição');
  assert.equal(output.score, 4);
});

test('normalizeState coerces invalid reviewStatus to unreviewed', () => {
  const sanitized = sanitizeState({
    projects: [{ id: 'p1', name: 'P' }],
    generationJobs: [
      {
        id: 'j1',
        projectId: 'p1',
        generationType: 'character',
        prompt: 'test',
        status: 'done',
        outputs: [
          { id: 'o1', projectId: 'p1', jobId: 'j1', generationType: 'character', seed: -1, reviewStatus: 'invalid-status' }
        ]
      }
    ]
  });
  assert.equal(sanitized.generationJobs[0].outputs[0].reviewStatus, 'unreviewed');
});

test('createCanonPromotion creates a promotion with required fields', () => {
  const project = createProject({ name: 'P' });
  const character = createCharacter({ projectId: project.id, name: 'Lyra' });
  const promotion = createCanonPromotion({
    projectId: project.id,
    outputId: 'output-1',
    jobId: 'job-1',
    canonType: 'character',
    targetId: character.id,
    targetType: 'character',
    reason: 'Melhor representação visual da Lyra',
    notes: 'sardas e olhos bem definidos'
  });

  assert.ok(promotion.id);
  assert.equal(promotion.projectId, project.id);
  assert.equal(promotion.outputId, 'output-1');
  assert.equal(promotion.jobId, 'job-1');
  assert.equal(promotion.canonType, 'character');
  assert.equal(promotion.targetId, character.id);
  assert.equal(promotion.targetType, 'character');
  assert.equal(promotion.reason, 'Melhor representação visual da Lyra');
  assert.equal(promotion.notes, 'sardas e olhos bem definidos');
  assert.ok(promotion.promotedAt);
});

test('createCanonPromotion coerces invalid canonType to character', () => {
  const project = createProject({ name: 'P' });
  const promotion = createCanonPromotion({
    projectId: project.id,
    outputId: 'o1',
    canonType: 'invalid-type',
    reason: 'test'
  });
  assert.equal(promotion.canonType, 'character');
});

test('normalizeState includes canonPromotions from raw data', () => {
  const sanitized = sanitizeState({
    projects: [{ id: 'p1', name: 'P' }],
    canonPromotions: [
      {
        id: 'cp1',
        projectId: 'p1',
        outputId: 'o1',
        jobId: 'j1',
        canonType: 'scene',
        targetId: 's1',
        targetType: 'scene',
        reason: 'Cena icônica',
        notes: '',
        promotedAt: new Date().toISOString()
      },
      {
        id: 'cp2',
        projectId: 'ghost-project',
        outputId: 'o2',
        canonType: 'character',
        reason: 'Orphan',
        promotedAt: new Date().toISOString()
      }
    ]
  });

  assert.equal(sanitized.canonPromotions.length, 1);
  assert.equal(sanitized.canonPromotions[0].id, 'cp1');
  assert.equal(sanitized.canonPromotions[0].canonType, 'scene');
});

test('deleteEntity removes canonPromotions when project is deleted', () => {
  const project = createProject({ name: 'P' });
  const otherProject = createProject({ name: 'Q' });
  const job = createGenerationJob({ projectId: project.id, prompt: 'test' });
  const promotion = createCanonPromotion({ projectId: project.id, outputId: 'o1', canonType: 'character', reason: 'test' });
  const otherPromotion = createCanonPromotion({ projectId: otherProject.id, outputId: 'o2', canonType: 'scene', reason: 'other' });

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
      generationJobs: [job],
      canonPromotions: [promotion, otherPromotion]
    },
    'project',
    project.id
  );

  assert.equal(result.canonPromotions.length, 1);
  assert.equal(result.canonPromotions[0].id, otherPromotion.id);
});

test('deleteEntity removes a single canonPromotion by id', () => {
  const project = createProject({ name: 'P' });
  const promotion1 = createCanonPromotion({ projectId: project.id, outputId: 'o1', canonType: 'character', reason: 'a' });
  const promotion2 = createCanonPromotion({ projectId: project.id, outputId: 'o2', canonType: 'scene', reason: 'b' });

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
      generationJobs: [],
      canonPromotions: [promotion1, promotion2]
    },
    'canonPromotion',
    promotion1.id
  );

  assert.equal(result.canonPromotions.length, 1);
  assert.equal(result.canonPromotions[0].id, promotion2.id);
});

test('store persists canonPromotions across save/load', () => {
  const storage = fakeStorage();
  const store = createStore({ key: 'test-canon', storage });
  const project = createProject({ name: 'Test' });
  const promotion = createCanonPromotion({
    projectId: project.id,
    outputId: 'o1',
    jobId: 'j1',
    canonType: 'character',
    targetId: 'c1',
    targetType: 'character',
    reason: 'Referência definitiva do personagem',
    notes: 'olhos e sardas perfeitos'
  });

  store.save({ ...store.load(), projects: [project], canonPromotions: [promotion] });
  const loaded = store.load();

  assert.equal(loaded.canonPromotions.length, 1);
  assert.equal(loaded.canonPromotions[0].id, promotion.id);
  assert.equal(loaded.canonPromotions[0].canonType, 'character');
  assert.equal(loaded.canonPromotions[0].reason, 'Referência definitiva do personagem');
});

test('DECISION enums contain expected values', () => {
  assert.deepEqual(DECISION_TYPES, [
    'approve',
    'reject',
    'promote_to_canon',
    'supersede',
    'send_back_for_revision',
    'archive_deprecate'
  ]);
  assert.deepEqual(DECISION_SCOPE_TYPES, ['asset', 'shot', 'scene', 'sequence', 'briefing', 'canon_entry', 'reference_visual']);
  assert.deepEqual(DECISION_RESULT_STATUSES, [
    'pending_review',
    'approved',
    'rejected',
    'current_official',
    'superseded',
    'needs_revision',
    'archived_deprecated'
  ]);
});

test('createDecisionEvent creates editorial history record with defaults', () => {
  const project = createProject({ name: 'P' });
  const event = createDecisionEvent({
    projectId: project.id,
    decisionType: 'approve',
    scopeType: 'scene',
    scopeId: 'scene-1',
    targetId: 'output-1',
    rationale: 'frame aprovado'
  });

  assert.ok(event.id);
  assert.equal(event.projectId, project.id);
  assert.equal(event.decisionType, 'approve');
  assert.equal(event.scopeType, 'scene');
  assert.equal(event.scopeId, 'scene-1');
  assert.equal(event.targetType, 'generationOutput');
  assert.equal(event.targetId, 'output-1');
  assert.equal(event.resultingStatus, 'pending_review');
  assert.ok(event.happenedAt);
});

test('normalizeState keeps valid decisionHistory events and drops orphan project events', () => {
  const sanitized = sanitizeState({
    projects: [{ id: 'p1', name: 'P' }],
    decisionHistory: [
      {
        id: 'd1',
        projectId: 'p1',
        decisionType: 'promote_to_canon',
        scopeType: 'canon_entry',
        scopeId: 'c1',
        targetType: 'generationOutput',
        targetId: 'o1',
        rationale: 'oficial',
        resultingStatus: 'current_official',
        happenedAt: new Date().toISOString()
      },
      {
        id: 'd2',
        projectId: 'ghost-project',
        decisionType: 'approve',
        scopeType: 'asset',
        scopeId: 'o2',
        targetType: 'generationOutput',
        targetId: 'o2',
        happenedAt: new Date().toISOString()
      }
    ]
  });

  assert.equal(sanitized.decisionHistory.length, 1);
  assert.equal(sanitized.decisionHistory[0].id, 'd1');
});

test('deleteEntity removes decisionHistory records when generation output is deleted', () => {
  const project = createProject({ name: 'P' });
  const output1 = createGenerationOutput({ projectId: project.id, jobId: 'j1', prompt: 'one', seed: 1 });
  const output2 = createGenerationOutput({ projectId: project.id, jobId: 'j1', prompt: 'two', seed: 2 });
  const job = { ...createGenerationJob({ projectId: project.id, prompt: 'test' }), outputs: [output1, output2] };
  const event1 = createDecisionEvent({
    projectId: project.id,
    decisionType: 'approve',
    scopeType: 'asset',
    scopeId: output1.id,
    targetId: output1.id,
    resultingStatus: 'approved'
  });
  const event2 = createDecisionEvent({
    projectId: project.id,
    decisionType: 'approve',
    scopeType: 'asset',
    scopeId: output2.id,
    targetId: output2.id,
    relatedItemType: 'generationOutput',
    relatedItemId: output1.id,
    resultingStatus: 'approved'
  });

  const result = deleteEntity(
    {
      projects: [project],
      books: [],
      chapters: [],
      scenes: [],
      beats: [],
      shots: [],
      characters: [],
      loreEntries: [],
      assets: [],
      referenceImages: [],
      promptDocuments: [],
      generationJobs: [job],
      canonPromotions: [],
      decisionHistory: [event1, event2]
    },
    'generationOutput',
    output1.id
  );

  assert.equal(result.decisionHistory.length, 0);
});

test('createWorkspaceCheckpoint stores metadata and snapshot payload', () => {
  const project = createProject({ name: 'Checkpoint Project' });
  const checkpoint = createWorkspaceCheckpoint({
    projectId: project.id,
    name: 'Antes da revisão final',
    reason: 'baseline',
    notes: 'estado antes de abrir triagem',
    snapshot: { shots: 4, reviewInboxPending: 2 }
  });

  assert.ok(checkpoint.id);
  assert.equal(checkpoint.projectId, project.id);
  assert.equal(checkpoint.name, 'Antes da revisão final');
  assert.equal(checkpoint.reason, 'baseline');
  assert.equal(checkpoint.notes, 'estado antes de abrir triagem');
  assert.deepEqual(checkpoint.snapshot, { shots: 4, reviewInboxPending: 2 });
  assert.ok(checkpoint.createdAt);
});

test('normalizeState keeps valid workspace checkpoints and removes orphan project checkpoints', () => {
  const sanitized = sanitizeState({
    projects: [{ id: 'p1', name: 'Projeto' }],
    workspaceCheckpoints: [
      {
        id: 'cp1',
        projectId: 'p1',
        name: 'Checkpoint válido',
        reason: 'milestone',
        notes: 'ok',
        snapshot: { scenes: 2 },
        createdAt: '2026-05-10T10:00:00.000Z'
      },
      {
        id: 'cp2',
        projectId: 'ghost-project',
        name: 'Checkpoint órfão',
        snapshot: { scenes: 999 }
      }
    ]
  });

  assert.equal(sanitized.workspaceCheckpoints.length, 1);
  assert.equal(sanitized.workspaceCheckpoints[0].id, 'cp1');
  assert.deepEqual(sanitized.workspaceCheckpoints[0].snapshot, { scenes: 2 });
});

test('deleteEntity removes workspace checkpoints when project is deleted', () => {
  const project = createProject({ name: 'Projeto A' });
  const otherProject = createProject({ name: 'Projeto B' });
  const checkpointA = createWorkspaceCheckpoint({
    projectId: project.id,
    name: 'Checkpoint A',
    snapshot: { shots: 1 }
  });
  const checkpointB = createWorkspaceCheckpoint({
    projectId: otherProject.id,
    name: 'Checkpoint B',
    snapshot: { shots: 3 }
  });

  const result = deleteEntity(
    {
      projects: [project, otherProject],
      books: [],
      chapters: [],
      scenes: [],
      beats: [],
      shots: [],
      characters: [],
      loreEntries: [],
      assets: [],
      referenceImages: [],
      promptDocuments: [],
      generationJobs: [],
      canonPromotions: [],
      decisionHistory: [],
      workspaceCheckpoints: [checkpointA, checkpointB],
      settings: {}
    },
    'project',
    project.id
  );

  assert.equal(result.workspaceCheckpoints.length, 1);
  assert.equal(result.workspaceCheckpoints[0].id, checkpointB.id);
});

test('WORKSPACE_SANDBOX_STATUSES contains expected values', () => {
  assert.deepEqual(WORKSPACE_SANDBOX_STATUSES, ['exploratory', 'candidate', 'review-ready']);
});

test('createWorkspaceSandbox stores metadata and snapshot payload', () => {
  const project = createProject({ name: 'Sandbox Project' });
  const sandbox = createWorkspaceSandbox({
    projectId: project.id,
    name: 'Ramo alternativo A',
    purpose: 'Testar direção mais intimista',
    status: 'candidate',
    snapshot: { scenes: 5, reviewInboxPending: 1 }
  });

  assert.ok(sandbox.id);
  assert.equal(sandbox.projectId, project.id);
  assert.equal(sandbox.name, 'Ramo alternativo A');
  assert.equal(sandbox.purpose, 'Testar direção mais intimista');
  assert.equal(sandbox.status, 'candidate');
  assert.deepEqual(sandbox.snapshot, { scenes: 5, reviewInboxPending: 1 });
  assert.ok(sandbox.createdAt);
  assert.ok(sandbox.updatedAt);
});

test('normalizeState keeps valid workspace sandboxes and removes orphan project sandboxes', () => {
  const sanitized = sanitizeState({
    projects: [{ id: 'p1', name: 'Projeto' }],
    workspaceSandboxes: [
      {
        id: 'sb1',
        projectId: 'p1',
        name: 'Sandbox válido',
        purpose: 'Explorar caminho alternativo',
        status: 'review-ready',
        snapshot: { scenes: 3 },
        createdAt: '2026-05-12T10:00:00.000Z',
        updatedAt: '2026-05-12T11:00:00.000Z'
      },
      {
        id: 'sb2',
        projectId: 'ghost-project',
        name: 'Sandbox órfão',
        snapshot: { scenes: 999 }
      }
    ]
  });

  assert.equal(sanitized.workspaceSandboxes.length, 1);
  assert.equal(sanitized.workspaceSandboxes[0].id, 'sb1');
  assert.equal(sanitized.workspaceSandboxes[0].status, 'review-ready');
  assert.deepEqual(sanitized.workspaceSandboxes[0].snapshot, { scenes: 3 });
});

test('deleteEntity removes workspace sandboxes when project is deleted', () => {
  const project = createProject({ name: 'Projeto A' });
  const otherProject = createProject({ name: 'Projeto B' });
  const sandboxA = createWorkspaceSandbox({
    projectId: project.id,
    name: 'Sandbox A',
    snapshot: { shots: 1 }
  });
  const sandboxB = createWorkspaceSandbox({
    projectId: otherProject.id,
    name: 'Sandbox B',
    snapshot: { shots: 3 }
  });

  const result = deleteEntity(
    {
      projects: [project, otherProject],
      books: [],
      chapters: [],
      scenes: [],
      beats: [],
      shots: [],
      characters: [],
      loreEntries: [],
      assets: [],
      referenceImages: [],
      promptDocuments: [],
      generationJobs: [],
      canonPromotions: [],
      decisionHistory: [],
      workspaceCheckpoints: [],
      workspaceSandboxes: [sandboxA, sandboxB],
      settings: {}
    },
    'project',
    project.id
  );

  assert.equal(result.workspaceSandboxes.length, 1);
  assert.equal(result.workspaceSandboxes[0].id, sandboxB.id);
});

test('createBeat and createShot include planning defaults', () => {
  const project = createProject({ name: 'Planejamento' });
  const book = createBook({ projectId: project.id, title: 'Livro' });
  const chapter = createChapter({ projectId: project.id, bookId: book.id, title: 'Capítulo' });
  const scene = createScene({ projectId: project.id, chapterId: chapter.id, title: 'Cena', description: 'Desc' });
  const beat = createBeat({ projectId: project.id, chapterId: chapter.id, sceneId: scene.id, title: 'Beat 1' });
  const shot = createShot({ projectId: project.id, chapterId: chapter.id, sceneId: scene.id, beatId: beat.id, title: 'Shot 1' });

  assert.equal(beat.summary, '');
  assert.equal(beat.order, 0);
  assert.equal(shot.status, 'idea');
  assert.equal(shot.shotType, '');
  assert.equal(shot.focusCharacterId, '');
  assert.deepEqual(shot.promptDocumentIds, []);
  assert.deepEqual(shot.generationOutputIds, []);
  assert.deepEqual(shot.continuityMustKeep, []);
  assert.deepEqual(shot.continuityReferenceIds, []);
});

test('SHOT_STATUSES contains expected editorial values', () => {
  assert.deepEqual(SHOT_STATUSES, ['idea', 'planned', 'generated', 'approved', 'canonical', 'needs redo']);
});

test('normalizeState keeps valid beats and shots while cleaning orphan links', () => {
  const project = createProject({ name: 'Planejamento' });
  const book = createBook({ projectId: project.id, title: 'Livro' });
  const chapter = createChapter({ projectId: project.id, bookId: book.id, title: 'Capítulo' });
  const scene = createScene({ projectId: project.id, chapterId: chapter.id, title: 'Cena', description: 'Desc' });
  const character = createCharacter({ projectId: project.id, name: 'Lyra' });
  const prompt = createPromptDocument({ projectId: project.id, title: 'Prompt', targetType: 'scene', targetId: scene.id });
  const reference = createReferenceImage({ projectId: project.id, name: 'Canon', type: 'scene', isCanonical: true });
  const videoAsset = createAsset({ projectId: project.id, name: 'Clip', type: 'video', path: '/tmp/clip.mp4' });
  const output = createGenerationOutput({ projectId: project.id, jobId: 'job-1', sceneId: scene.id, fileName: 'frame.png' });
  const beat = createBeat({ projectId: project.id, chapterId: chapter.id, sceneId: scene.id, title: 'Beat' });

  const sanitized = sanitizeState({
    projects: [project],
    books: [book],
    chapters: [chapter],
    scenes: [scene],
    characters: [character],
    assets: [videoAsset],
    referenceImages: [reference],
    promptDocuments: [prompt],
    generationJobs: [{ ...createGenerationJob({ projectId: project.id, prompt: 'test' }), outputs: [output] }],
    beats: [beat, { id: 'beat-orphan', projectId: project.id, sceneId: 'ghost', title: 'Órfão' }],
    shots: [
      {
        ...createShot({
          projectId: project.id,
          chapterId: 'ghost-chapter',
          sceneId: scene.id,
          beatId: beat.id,
          title: 'Shot limpo',
          focusCharacterId: character.id,
          promptDocumentIds: [prompt.id, 'ghost-prompt'],
          generationOutputIds: [output.id, 'ghost-output'],
          videoAssetIds: [videoAsset.id, 'ghost-video'],
          referenceImageIds: [reference.id, 'ghost-reference'],
          linkedCharacterIds: [character.id, 'ghost-character'],
          continuityReferenceIds: [reference.id, 'ghost-reference']
        })
      },
      { id: 'shot-orphan', projectId: project.id, sceneId: 'ghost', title: 'Órfão' }
    ]
  });

  assert.equal(sanitized.beats.length, 1);
  assert.equal(sanitized.shots.length, 1);
  assert.equal(sanitized.shots[0].chapterId, chapter.id);
  assert.deepEqual(sanitized.shots[0].promptDocumentIds, [prompt.id]);
  assert.deepEqual(sanitized.shots[0].generationOutputIds, [output.id]);
  assert.deepEqual(sanitized.shots[0].videoAssetIds, [videoAsset.id]);
  assert.deepEqual(sanitized.shots[0].referenceImageIds, [reference.id]);
  assert.deepEqual(sanitized.shots[0].linkedCharacterIds, [character.id]);
  assert.deepEqual(sanitized.shots[0].continuityReferenceIds, [reference.id]);
});

test('deleteEntity updates shot planning links for beat and generation output removals', () => {
  const project = createProject({ name: 'Planejamento' });
  const book = createBook({ projectId: project.id, title: 'Livro' });
  const chapter = createChapter({ projectId: project.id, bookId: book.id, title: 'Capítulo' });
  const scene = createScene({ projectId: project.id, chapterId: chapter.id, title: 'Cena', description: 'Desc' });
  const beat = createBeat({ projectId: project.id, chapterId: chapter.id, sceneId: scene.id, title: 'Beat' });
  const output = createGenerationOutput({ projectId: project.id, jobId: 'job-1', sceneId: scene.id, fileName: 'frame.png' });
  const job = { ...createGenerationJob({ projectId: project.id, prompt: 'test' }), outputs: [output] };
  const shot = createShot({
    projectId: project.id,
    chapterId: chapter.id,
    sceneId: scene.id,
    beatId: beat.id,
    title: 'Shot',
    generationOutputIds: [output.id]
  });

  const afterBeatDelete = deleteEntity(
    {
      projects: [project],
      books: [book],
      chapters: [chapter],
      scenes: [scene],
      beats: [beat],
      shots: [shot],
      characters: [],
      loreEntries: [],
      assets: [],
      referenceImages: [],
      promptDocuments: [],
      generationJobs: [job],
      canonPromotions: []
    },
    'beat',
    beat.id
  );

  assert.equal(afterBeatDelete.beats.length, 0);
  assert.equal(afterBeatDelete.shots[0].beatId, '');

  const afterOutputDelete = deleteEntity(afterBeatDelete, 'generationOutput', output.id);
  assert.equal(afterOutputDelete.generationJobs[0].outputs.length, 0);
  assert.deepEqual(afterOutputDelete.shots[0].generationOutputIds, []);
});

test('assistive planning flags missing dependencies as blocked', () => {
  const project = createProject({ name: 'P' });
  const book = createBook({ projectId: project.id, title: 'Livro' });
  const chapter = createChapter({ projectId: project.id, bookId: book.id, title: 'Capítulo' });
  const scene = createScene({ projectId: project.id, chapterId: chapter.id, title: 'Cena', description: 'Desc' });

  const bundle = buildAssistivePlanningBundle({
    state: { projects: [project], books: [book], chapters: [chapter], scenes: [scene] },
    projectId: project.id,
    scopeType: 'scene',
    scopeValue: scene.id
  });

  assert.ok(bundle.recommendations.some((entry) => entry.type === 'missing dependency' && entry.status === 'blocked'));
  assert.ok(bundle.recommendations.some((entry) => entry.type === 'scene not production-ready'));
});

test('assistive planning emits review required when outputs are pending review', () => {
  const project = createProject({ name: 'P' });
  const book = createBook({ projectId: project.id, title: 'Livro' });
  const chapter = createChapter({ projectId: project.id, bookId: book.id, title: 'Capítulo' });
  const scene = createScene({ projectId: project.id, chapterId: chapter.id, title: 'Cena', description: 'Desc' });
  const prompt = createPromptDocument({ projectId: project.id, title: 'Prompt', targetType: 'scene', targetId: scene.id });
  const shot = createShot({ projectId: project.id, chapterId: chapter.id, sceneId: scene.id, title: 'Shot 1' });
  const output = createGenerationOutput({
    projectId: project.id,
    sceneId: scene.id,
    jobId: 'job-1',
    generationType: 'scene',
    reviewStatus: 'candidate'
  });
  const job = { ...createGenerationJob({ projectId: project.id, sceneId: scene.id, prompt: 'test' }), outputs: [output] };

  const bundle = buildAssistivePlanningBundle({
    state: {
      projects: [project],
      books: [book],
      chapters: [chapter],
      scenes: [scene],
      promptDocuments: [prompt],
      shots: [shot],
      generationJobs: [job]
    },
    projectId: project.id
  });

  assert.ok(bundle.recommendations.some((entry) => entry.type === 'review required' && entry.status === 'ready-to-review'));
});

test('assistive planning respects sequence scope and suggests generation', () => {
  const project = createProject({ name: 'P' });
  const book = createBook({ projectId: project.id, title: 'Livro' });
  const chapter = createChapter({ projectId: project.id, bookId: book.id, title: 'Capítulo' });
  const scene = createScene({ projectId: project.id, chapterId: chapter.id, title: 'Cena', description: 'Desc' });
  const beat = createBeat({ projectId: project.id, chapterId: chapter.id, sceneId: scene.id, title: 'Sequência 1' });
  const shot = createShot({ projectId: project.id, chapterId: chapter.id, sceneId: scene.id, beatId: beat.id, title: 'Shot 1' });
  const prompt = createPromptDocument({ projectId: project.id, title: 'Prompt', targetType: 'scene', targetId: scene.id });

  const bundle = buildAssistivePlanningBundle({
    state: {
      projects: [project],
      books: [book],
      chapters: [chapter],
      scenes: [scene],
      beats: [beat],
      shots: [shot],
      promptDocuments: [prompt]
    },
    projectId: project.id,
    scopeType: 'sequence',
    scopeValue: beat.id
  });

  assert.ok(bundle.recommendations.every((entry) => entry.sceneId === scene.id));
  assert.ok(
    bundle.recommendations.some(
      (entry) => entry.type === 'recommended asset to generate' && entry.status === 'ready-to-generate'
    )
  );
});

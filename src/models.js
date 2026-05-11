const newId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
};

const now = () => new Date().toISOString();

const stringValue = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

const stringList = (value) =>
  Array.isArray(value)
    ? value.map((entry) => stringValue(entry).trim()).filter(Boolean)
    : [];

const recordValue = (value) => (value && typeof value === 'object' ? value : null);

const baseSettings = () => ({
  imagePipeline: {
    provider: 'local-runner',
    modelHint: 'cinematic-realism',
    extensionPoint: 'src/pipelines.js#runImagePipeline'
  },
  videoPipeline: {
    provider: 'local-runner',
    modelHint: 'image-to-video-cinematic',
    extensionPoint: 'src/pipelines.js#runVideoPipeline'
  }
});

export const emptyState = () => ({
  projects: [],
  books: [],
  chapters: [],
  scenes: [],
  characters: [],
  loreEntries: [],
  assets: [],
  settings: baseSettings()
});

export const createProject = ({ name, tone = '', description = '' }) => ({
  id: newId(),
  name,
  tone,
  description,
  createdAt: now(),
  updatedAt: now()
});

export const createBook = ({ projectId, title, synopsis = '' }) => ({
  id: newId(),
  projectId,
  title,
  synopsis,
  createdAt: now(),
  updatedAt: now()
});

export const createChapter = ({ projectId, bookId, title, summary = '', content = '' }) => ({
  id: newId(),
  projectId,
  bookId,
  title,
  summary,
  content,
  createdAt: now(),
  updatedAt: now()
});

export const createCharacter = ({
  projectId,
  name,
  notes = '',
  canonTraits = [],
  masterPrompt = '',
  negativePrompt = ''
}) => ({
  id: newId(),
  projectId,
  name,
  notes,
  canonTraits,
  masterPrompt,
  negativePrompt,
  references: [],
  createdAt: now(),
  updatedAt: now()
});

export const createLoreEntry = ({ projectId, title, content, tags = [] }) => ({
  id: newId(),
  projectId,
  title,
  content,
  tags,
  createdAt: now(),
  updatedAt: now()
});

export const createScene = ({ projectId, chapterId = '', title, description, location = '' }) => ({
  id: newId(),
  projectId,
  chapterId,
  title,
  description,
  location,
  createdAt: now(),
  updatedAt: now()
});

export const createAsset = ({ projectId, name, type, path }) => ({
  id: newId(),
  projectId,
  name,
  type,
  path,
  createdAt: now()
});

const normalizeProject = (project) => {
  const value = recordValue(project);
  if (!value || !stringValue(value.id)) return null;
  const createdAt = stringValue(value.createdAt) || now();
  return {
    id: value.id,
    name: stringValue(value.name, 'Projeto sem nome'),
    tone: stringValue(value.tone),
    description: stringValue(value.description),
    createdAt,
    updatedAt: stringValue(value.updatedAt) || createdAt
  };
};

const normalizeBook = (book) => {
  const value = recordValue(book);
  if (!value || !stringValue(value.id) || !stringValue(value.projectId)) return null;
  const createdAt = stringValue(value.createdAt) || now();
  return {
    id: value.id,
    projectId: value.projectId,
    title: stringValue(value.title, 'Livro sem título'),
    synopsis: stringValue(value.synopsis),
    createdAt,
    updatedAt: stringValue(value.updatedAt) || createdAt
  };
};

const normalizeChapter = (chapter) => {
  const value = recordValue(chapter);
  if (!value || !stringValue(value.id) || !stringValue(value.projectId) || !stringValue(value.bookId)) return null;
  const createdAt = stringValue(value.createdAt) || now();
  return {
    id: value.id,
    projectId: value.projectId,
    bookId: value.bookId,
    title: stringValue(value.title, 'Capítulo sem título'),
    summary: stringValue(value.summary),
    content: stringValue(value.content),
    createdAt,
    updatedAt: stringValue(value.updatedAt) || createdAt
  };
};

const normalizeCharacter = (character) => {
  const value = recordValue(character);
  if (!value || !stringValue(value.id) || !stringValue(value.projectId)) return null;
  const createdAt = stringValue(value.createdAt) || now();
  return {
    id: value.id,
    projectId: value.projectId,
    name: stringValue(value.name, 'Personagem sem nome'),
    notes: stringValue(value.notes),
    canonTraits: stringList(value.canonTraits),
    masterPrompt: stringValue(value.masterPrompt),
    negativePrompt: stringValue(value.negativePrompt),
    references: stringList(value.references),
    createdAt,
    updatedAt: stringValue(value.updatedAt) || createdAt
  };
};

const normalizeLoreEntry = (entry) => {
  const value = recordValue(entry);
  if (!value || !stringValue(value.id) || !stringValue(value.projectId)) return null;
  const createdAt = stringValue(value.createdAt) || now();
  return {
    id: value.id,
    projectId: value.projectId,
    title: stringValue(value.title, 'Lore sem título'),
    content: stringValue(value.content),
    tags: stringList(value.tags),
    createdAt,
    updatedAt: stringValue(value.updatedAt) || createdAt
  };
};

const normalizeScene = (scene) => {
  const value = recordValue(scene);
  if (!value || !stringValue(value.id) || !stringValue(value.projectId)) return null;
  const createdAt = stringValue(value.createdAt) || now();
  return {
    id: value.id,
    projectId: value.projectId,
    chapterId: stringValue(value.chapterId),
    title: stringValue(value.title, 'Cena sem título'),
    description: stringValue(value.description),
    location: stringValue(value.location),
    createdAt,
    updatedAt: stringValue(value.updatedAt) || createdAt
  };
};

const normalizeAsset = (asset) => {
  const value = recordValue(asset);
  if (!value || !stringValue(value.id) || !stringValue(value.projectId)) return null;
  return {
    id: value.id,
    projectId: value.projectId,
    name: stringValue(value.name, 'Asset sem nome'),
    type: stringValue(value.type, 'ref'),
    path: stringValue(value.path),
    createdAt: stringValue(value.createdAt) || now()
  };
};

export const normalizeState = (raw) => {
  const value = recordValue(raw) || {};
  const settingsSource = recordValue(value.settings) || {};
  const state = emptyState();
  const projects = (Array.isArray(value.projects) ? value.projects : []).map(normalizeProject).filter(Boolean);
  const projectIds = new Set(projects.map((project) => project.id));
  const books = (Array.isArray(value.books) ? value.books : [])
    .map(normalizeBook)
    .filter((book) => book && projectIds.has(book.projectId));
  const bookIds = new Set(books.map((book) => book.id));
  const chapters = (Array.isArray(value.chapters) ? value.chapters : [])
    .map(normalizeChapter)
    .filter((chapter) => chapter && projectIds.has(chapter.projectId) && bookIds.has(chapter.bookId));
  const chapterIds = new Set(chapters.map((chapter) => chapter.id));
  const scenes = (Array.isArray(value.scenes) ? value.scenes : [])
    .map(normalizeScene)
    .filter(
      (scene) =>
        scene &&
        projectIds.has(scene.projectId) &&
        (!scene.chapterId || chapterIds.has(scene.chapterId))
    );

  return {
    ...state,
    projects,
    books,
    chapters,
    scenes,
    characters: (Array.isArray(value.characters) ? value.characters : [])
      .map(normalizeCharacter)
      .filter((character) => character && projectIds.has(character.projectId)),
    loreEntries: (Array.isArray(value.loreEntries) ? value.loreEntries : [])
      .map(normalizeLoreEntry)
      .filter((entry) => entry && projectIds.has(entry.projectId)),
    assets: (Array.isArray(value.assets) ? value.assets : [])
      .map(normalizeAsset)
      .filter((asset) => asset && projectIds.has(asset.projectId)),
    settings: {
      ...baseSettings(),
      ...settingsSource
    }
  };
};

export const deleteEntity = (state, entityType, id) => {
  if (!id) return normalizeState(state);
  const current = normalizeState(state);

  if (entityType === 'project') {
    const bookIds = new Set(current.books.filter((book) => book.projectId === id).map((book) => book.id));
    const chapterIds = new Set(
      current.chapters.filter((chapter) => chapter.projectId === id || bookIds.has(chapter.bookId)).map((chapter) => chapter.id)
    );
    return normalizeState({
      ...current,
      projects: current.projects.filter((project) => project.id !== id),
      books: current.books.filter((book) => book.projectId !== id),
      chapters: current.chapters.filter((chapter) => chapter.projectId !== id && !bookIds.has(chapter.bookId)),
      scenes: current.scenes.filter((scene) => scene.projectId !== id && !chapterIds.has(scene.chapterId)),
      characters: current.characters.filter((character) => character.projectId !== id),
      loreEntries: current.loreEntries.filter((entry) => entry.projectId !== id),
      assets: current.assets.filter((asset) => asset.projectId !== id)
    });
  }

  if (entityType === 'book') {
    const chapterIds = new Set(current.chapters.filter((chapter) => chapter.bookId === id).map((chapter) => chapter.id));
    return normalizeState({
      ...current,
      books: current.books.filter((book) => book.id !== id),
      chapters: current.chapters.filter((chapter) => chapter.bookId !== id),
      scenes: current.scenes.filter((scene) => !chapterIds.has(scene.chapterId))
    });
  }

  if (entityType === 'chapter') {
    return normalizeState({
      ...current,
      chapters: current.chapters.filter((chapter) => chapter.id !== id),
      scenes: current.scenes.filter((scene) => scene.chapterId !== id)
    });
  }

  if (entityType === 'scene') {
    return { ...current, scenes: current.scenes.filter((scene) => scene.id !== id) };
  }

  if (entityType === 'character') {
    return { ...current, characters: current.characters.filter((character) => character.id !== id) };
  }

  if (entityType === 'lore') {
    return { ...current, loreEntries: current.loreEntries.filter((entry) => entry.id !== id) };
  }

  if (entityType === 'asset') {
    return { ...current, assets: current.assets.filter((asset) => asset.id !== id) };
  }

  return current;
};

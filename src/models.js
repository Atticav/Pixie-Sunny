const newId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
};

const nowUtc = () => new Date().toISOString();

const stringValue = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

const stringList = (value) =>
  Array.isArray(value)
    ? value.map((entry) => stringValue(entry).trim()).filter(Boolean)
    : [];

const recordValue = (value) => (value && typeof value === 'object' ? value : null);

const hasRequiredFields = (value, fields) => fields.every((field) => stringValue(value[field]));

const baseLocalWorkspaceSettings = () => ({
  mode: 'opfs',
  enabled: true,
  rootPath: 'MacBook/PixieSunnyStudio',
  directories: {
    projects: 'projects',
    references: 'references',
    outputs: 'outputs',
    exports: 'exports',
    settings: 'settings'
  },
  preferences: {
    autoMirrorProjectState: true,
    saveReferenceFilesToWorkspace: true,
    saveExportsToWorkspace: true
  }
});

const normalizeLocalWorkspaceSettings = (source) => {
  const value = recordValue(source) || {};
  const directories = recordValue(value.directories) || {};
  const preferences = recordValue(value.preferences) || {};
  const defaults = baseLocalWorkspaceSettings();
  return {
    ...defaults,
    ...value,
    mode: stringValue(value.mode, defaults.mode),
    rootPath: stringValue(value.rootPath, defaults.rootPath),
    enabled: typeof value.enabled === 'boolean' ? value.enabled : defaults.enabled,
    directories: {
      ...defaults.directories,
      projects: stringValue(directories.projects, defaults.directories.projects),
      references: stringValue(directories.references, defaults.directories.references),
      outputs: stringValue(directories.outputs, defaults.directories.outputs),
      exports: stringValue(directories.exports, defaults.directories.exports),
      settings: stringValue(directories.settings, defaults.directories.settings)
    },
    preferences: {
      ...defaults.preferences,
      autoMirrorProjectState:
        typeof preferences.autoMirrorProjectState === 'boolean'
          ? preferences.autoMirrorProjectState
          : defaults.preferences.autoMirrorProjectState,
      saveReferenceFilesToWorkspace:
        typeof preferences.saveReferenceFilesToWorkspace === 'boolean'
          ? preferences.saveReferenceFilesToWorkspace
          : defaults.preferences.saveReferenceFilesToWorkspace,
      saveExportsToWorkspace:
        typeof preferences.saveExportsToWorkspace === 'boolean'
          ? preferences.saveExportsToWorkspace
          : defaults.preferences.saveExportsToWorkspace
    }
  };
};

export const IMAGE_GEN_TYPES = ['character', 'scene', 'environment', 'portrait', 'variation'];
export const IMAGE_GEN_STATUSES = ['pending', 'running', 'done', 'error'];
export const IMAGE_GEN_PROVIDER_TYPES = ['mock', 'local-api'];

const baseImageGenSettings = () => ({
  type: 'mock',
  endpoint: 'http://127.0.0.1:7860',
  outputDir: 'outputs',
  resolution: '512x768',
  steps: 28,
  sampler: 'DPM++ 2M Karras',
  cfgScale: 7,
  numImages: 1,
  seed: -1,
  seedLocked: false
});

const normalizeImageGenSettings = (source) => {
  const value = recordValue(source) || {};
  const defaults = baseImageGenSettings();
  return {
    ...defaults,
    type: IMAGE_GEN_PROVIDER_TYPES.includes(stringValue(value.type)) ? stringValue(value.type) : defaults.type,
    endpoint: stringValue(value.endpoint, defaults.endpoint),
    outputDir: stringValue(value.outputDir, defaults.outputDir),
    resolution: stringValue(value.resolution, defaults.resolution),
    steps:
      typeof value.steps === 'number' && value.steps > 0 ? Math.floor(value.steps) : defaults.steps,
    sampler: stringValue(value.sampler, defaults.sampler),
    cfgScale: typeof value.cfgScale === 'number' ? value.cfgScale : defaults.cfgScale,
    numImages:
      typeof value.numImages === 'number' && value.numImages > 0
        ? Math.floor(value.numImages)
        : defaults.numImages,
    seed: typeof value.seed === 'number' ? value.seed : defaults.seed,
    seedLocked:
      typeof value.seedLocked === 'boolean' ? value.seedLocked : defaults.seedLocked
  };
};

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
  },
  localWorkspace: baseLocalWorkspaceSettings(),
  imageGenProvider: baseImageGenSettings()
});

export const UNASSIGNED_CHAPTER_ID = '';

export const emptyState = () => ({
  projects: [],
  books: [],
  chapters: [],
  scenes: [],
  characters: [],
  loreEntries: [],
  assets: [],
  referenceImages: [],
  promptDocuments: [],
  generationJobs: [],
  settings: baseSettings()
});

export const createProject = ({ name, tone = '', description = '' }) => ({
  id: newId(),
  name,
  tone,
  description,
  createdAt: nowUtc(),
  updatedAt: nowUtc()
});

export const createBook = ({ projectId, title, synopsis = '' }) => ({
  id: newId(),
  projectId,
  title,
  synopsis,
  createdAt: nowUtc(),
  updatedAt: nowUtc()
});

export const CHAPTER_STATUSES = ['rascunho', 'revisão', 'finalizado'];

export const createChapter = ({
  projectId,
  bookId,
  title,
  summary = '',
  content = '',
  status = 'rascunho',
  notes = '',
  goal = '',
  conflict = '',
  presentCharacters = [],
  continuity = '',
  wordGoal = 0
}) => ({
  id: newId(),
  projectId,
  bookId,
  title,
  summary,
  content,
  status,
  notes,
  goal,
  conflict,
  presentCharacters: stringList(presentCharacters),
  continuity,
  wordGoal: typeof wordGoal === 'number' && wordGoal >= 0 ? Math.floor(wordGoal) : 0,
  createdAt: nowUtc(),
  updatedAt: nowUtc()
});

export const REFERENCE_TYPES = ['character', 'place', 'scene', 'clothing', 'aesthetic', 'pose', 'lighting', 'object'];

export const createCharacter = ({
  projectId,
  name,
  notes = '',
  canonTraits = [],
  fixedTraits = [],
  variableTraits = [],
  consistencyRules = [],
  apparentAge = '',
  genderPresentation = '',
  skinTone = '',
  hair = '',
  eyes = '',
  faceShape = '',
  bodyType = '',
  marks = '',
  typicalClothing = '',
  accessories = '',
  dominantExpression = '',
  presence = '',
  visualAesthetic = '',
  colorPalette = '',
  periodStyle = '',
  visualTags = [],
  cinematicNotes = '',
  masterPrompt = '',
  negativePrompt = ''
}) => ({
  id: newId(),
  projectId,
  name,
  notes,
  canonTraits,
  fixedTraits,
  variableTraits,
  consistencyRules,
  apparentAge,
  genderPresentation,
  skinTone,
  hair,
  eyes,
  faceShape,
  bodyType,
  marks,
  typicalClothing,
  accessories,
  dominantExpression,
  presence,
  visualAesthetic,
  colorPalette,
  periodStyle,
  visualTags,
  cinematicNotes,
  masterPrompt,
  negativePrompt,
  references: [],
  createdAt: nowUtc(),
  updatedAt: nowUtc()
});

export const createReferenceImage = ({
  projectId,
  characterId = '',
  name,
  type = 'character',
  dataUrl = '',
  localPath = '',
  fileName = '',
  linkedEntityId = '',
  linkedEntityType = '',
  isCanonical = false,
  preserve = '',
  mayVary = '',
  notes = ''
}) => ({
  id: newId(),
  projectId,
  characterId,
  name,
  type,
  dataUrl,
  localPath,
  fileName,
  linkedEntityId,
  linkedEntityType,
  isCanonical: Boolean(isCanonical),
  preserve,
  mayVary,
  notes,
  createdAt: nowUtc()
});

export const createLoreEntry = ({ projectId, title, content, tags = [] }) => ({
  id: newId(),
  projectId,
  title,
  content,
  tags,
  createdAt: nowUtc(),
  updatedAt: nowUtc()
});

export const createScene = ({
  projectId,
  chapterId = UNASSIGNED_CHAPTER_ID,
  title,
  description,
  location = ''
}) => ({
  id: newId(),
  projectId,
  chapterId,
  title,
  description,
  location,
  createdAt: nowUtc(),
  updatedAt: nowUtc()
});

export const createAsset = ({ projectId, name, type, path }) => ({
  id: newId(),
  projectId,
  name,
  type,
  path,
  createdAt: nowUtc()
});

export const createGenerationOutput = ({
  projectId,
  jobId = '',
  characterId = '',
  sceneId = '',
  prompt = '',
  params = {},
  dataUrl = '',
  localPath = '',
  fileName = '',
  generationType = 'character',
  seed = -1
}) => ({
  id: newId(),
  projectId,
  jobId,
  characterId,
  sceneId,
  prompt,
  params,
  dataUrl,
  localPath,
  fileName,
  generationType,
  seed,
  isFavorite: false,
  isCanonical: false,
  createdAt: nowUtc()
});

export const createGenerationJob = ({
  projectId,
  generationType = 'character',
  characterId = '',
  sceneId = '',
  promptDocumentId = '',
  prompt = '',
  negativePrompt = '',
  referenceIds = [],
  params = {},
  providerType = 'mock',
  providerLabel = 'Mock'
}) => ({
  id: newId(),
  projectId,
  generationType,
  characterId,
  sceneId,
  promptDocumentId,
  prompt,
  negativePrompt,
  referenceIds: stringList(referenceIds),
  params,
  providerType,
  providerLabel,
  status: 'pending',
  errorMessage: '',
  outputs: [],
  createdAt: nowUtc(),
  updatedAt: nowUtc()
});

const createPromptVersion = ({
  id = newId(),
  label = 'Versão inicial',
  source = 'manual',
  preserve = [],
  vary = [],
  masterPrompt = '',
  negativePrompt = '',
  shortPrompt = '',
  detailedPrompt = '',
  scenePrompt = '',
  cinematicPrompt = '',
  variations = [],
  fixedChecklist = [],
  notes = '',
  createdAt = nowUtc()
} = {}) => ({
  id,
  label,
  source,
  preserve: stringList(preserve),
  vary: stringList(vary),
  masterPrompt,
  negativePrompt,
  shortPrompt,
  detailedPrompt,
  scenePrompt,
  cinematicPrompt,
  variations: stringList(variations),
  fixedChecklist: stringList(fixedChecklist),
  notes,
  createdAt
});

export const createPromptDocument = ({
  projectId,
  title,
  targetType = 'character',
  targetId = '',
  promptMedium = 'image',
  stylePreset = 'cinematic-realism',
  cinematicPreset = 'portrait-intimate',
  lensLightingPreset = 'natural-soft',
  emotionalTone = '',
  environment = '',
  lighting = '',
  composition = '',
  notes = '',
  referenceIds = [],
  versions = [],
  activeVersionId = '',
  isFavorite = false,
  isOfficial = false
}) => {
  const safeVersions = versions.length ? versions.map((version) => createPromptVersion(version)) : [createPromptVersion()];
  const currentActiveVersionId = safeVersions.some((version) => version.id === activeVersionId)
    ? activeVersionId
    : safeVersions[0].id;
  return {
    id: newId(),
    projectId,
    title,
    targetType: targetType === 'scene' ? 'scene' : 'character',
    targetId,
    promptMedium: promptMedium === 'video' ? 'video' : 'image',
    stylePreset,
    cinematicPreset,
    lensLightingPreset,
    emotionalTone,
    environment,
    lighting,
    composition,
    notes,
    referenceIds: stringList(referenceIds),
    versions: safeVersions,
    activeVersionId: currentActiveVersionId,
    isFavorite: Boolean(isFavorite),
    isOfficial: Boolean(isOfficial),
    createdAt: nowUtc(),
    updatedAt: nowUtc()
  };
};

const normalizeProject = (project) => {
  const value = recordValue(project);
  if (!value || !stringValue(value.id)) return null;
  const createdAt = stringValue(value.createdAt) || nowUtc();
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
  if (!value || !hasRequiredFields(value, ['id', 'projectId'])) return null;
  const createdAt = stringValue(value.createdAt) || nowUtc();
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
  if (!value || !hasRequiredFields(value, ['id', 'projectId', 'bookId'])) return null;
  const createdAt = stringValue(value.createdAt) || nowUtc();
  const rawStatus = stringValue(value.status);
  return {
    id: value.id,
    projectId: value.projectId,
    bookId: value.bookId,
    title: stringValue(value.title, 'Capítulo sem título'),
    summary: stringValue(value.summary),
    content: stringValue(value.content),
    status: CHAPTER_STATUSES.includes(rawStatus) ? rawStatus : 'rascunho',
    notes: stringValue(value.notes),
    goal: stringValue(value.goal),
    conflict: stringValue(value.conflict),
    presentCharacters: stringList(value.presentCharacters),
    continuity: stringValue(value.continuity),
    wordGoal: typeof value.wordGoal === 'number' && value.wordGoal >= 0 ? Math.floor(value.wordGoal) : 0,
    createdAt,
    updatedAt: stringValue(value.updatedAt) || createdAt
  };
};

const normalizeCharacter = (character) => {
  const value = recordValue(character);
  if (!value || !hasRequiredFields(value, ['id', 'projectId'])) return null;
  const createdAt = stringValue(value.createdAt) || nowUtc();
  return {
    id: value.id,
    projectId: value.projectId,
    name: stringValue(value.name, 'Personagem sem nome'),
    notes: stringValue(value.notes),
    canonTraits: stringList(value.canonTraits),
    fixedTraits: stringList(value.fixedTraits),
    variableTraits: stringList(value.variableTraits),
    consistencyRules: stringList(value.consistencyRules),
    apparentAge: stringValue(value.apparentAge),
    genderPresentation: stringValue(value.genderPresentation),
    skinTone: stringValue(value.skinTone),
    hair: stringValue(value.hair),
    eyes: stringValue(value.eyes),
    faceShape: stringValue(value.faceShape),
    bodyType: stringValue(value.bodyType),
    marks: stringValue(value.marks),
    typicalClothing: stringValue(value.typicalClothing),
    accessories: stringValue(value.accessories),
    dominantExpression: stringValue(value.dominantExpression),
    presence: stringValue(value.presence),
    visualAesthetic: stringValue(value.visualAesthetic),
    colorPalette: stringValue(value.colorPalette),
    periodStyle: stringValue(value.periodStyle),
    visualTags: stringList(value.visualTags),
    cinematicNotes: stringValue(value.cinematicNotes),
    masterPrompt: stringValue(value.masterPrompt),
    negativePrompt: stringValue(value.negativePrompt),
    references: stringList(value.references),
    createdAt,
    updatedAt: stringValue(value.updatedAt) || createdAt
  };
};

const normalizeReferenceImage = (ref) => {
  const value = recordValue(ref);
  if (!value || !hasRequiredFields(value, ['id', 'projectId'])) return null;
  const rawType = stringValue(value.type);
  return {
    id: value.id,
    projectId: value.projectId,
    characterId: stringValue(value.characterId),
    name: stringValue(value.name, 'Referência sem nome'),
    type: REFERENCE_TYPES.includes(rawType) ? rawType : 'character',
    dataUrl: stringValue(value.dataUrl),
    localPath: stringValue(value.localPath),
    fileName: stringValue(value.fileName),
    linkedEntityId: stringValue(value.linkedEntityId),
    linkedEntityType: stringValue(value.linkedEntityType),
    isCanonical: Boolean(value.isCanonical),
    preserve: stringValue(value.preserve),
    mayVary: stringValue(value.mayVary),
    notes: stringValue(value.notes),
    createdAt: stringValue(value.createdAt) || nowUtc()
  };
};

const normalizeLoreEntry = (entry) => {
  const value = recordValue(entry);
  if (!value || !hasRequiredFields(value, ['id', 'projectId'])) return null;
  const createdAt = stringValue(value.createdAt) || nowUtc();
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
  if (!value || !hasRequiredFields(value, ['id', 'projectId'])) return null;
  const createdAt = stringValue(value.createdAt) || nowUtc();
  return {
    id: value.id,
    projectId: value.projectId,
    chapterId: stringValue(value.chapterId, UNASSIGNED_CHAPTER_ID),
    title: stringValue(value.title, 'Cena sem título'),
    description: stringValue(value.description),
    location: stringValue(value.location),
    createdAt,
    updatedAt: stringValue(value.updatedAt) || createdAt
  };
};

const normalizeAsset = (asset) => {
  const value = recordValue(asset);
  if (!value || !hasRequiredFields(value, ['id', 'projectId'])) return null;
  return {
    id: value.id,
    projectId: value.projectId,
    name: stringValue(value.name, 'Asset sem nome'),
    type: stringValue(value.type, 'ref'),
    path: stringValue(value.path),
    createdAt: stringValue(value.createdAt) || nowUtc()
  };
};

const normalizeGenerationOutput = (output) => {
  const value = recordValue(output);
  if (!value || !hasRequiredFields(value, ['id', 'projectId'])) return null;
  return {
    id: value.id,
    projectId: value.projectId,
    jobId: stringValue(value.jobId),
    characterId: stringValue(value.characterId),
    sceneId: stringValue(value.sceneId),
    prompt: stringValue(value.prompt),
    params: recordValue(value.params) || {},
    dataUrl: stringValue(value.dataUrl),
    localPath: stringValue(value.localPath),
    fileName: stringValue(value.fileName),
    generationType: IMAGE_GEN_TYPES.includes(stringValue(value.generationType))
      ? stringValue(value.generationType)
      : 'character',
    seed: typeof value.seed === 'number' ? value.seed : -1,
    isFavorite: Boolean(value.isFavorite),
    isCanonical: Boolean(value.isCanonical),
    createdAt: stringValue(value.createdAt) || nowUtc()
  };
};

const normalizeGenerationJob = (job) => {
  const value = recordValue(job);
  if (!value || !hasRequiredFields(value, ['id', 'projectId'])) return null;
  const createdAt = stringValue(value.createdAt) || nowUtc();
  const rawStatus = stringValue(value.status);
  const outputs = (Array.isArray(value.outputs) ? value.outputs : [])
    .map(normalizeGenerationOutput)
    .filter(Boolean);
  return {
    id: value.id,
    projectId: value.projectId,
    generationType: IMAGE_GEN_TYPES.includes(stringValue(value.generationType))
      ? stringValue(value.generationType)
      : 'character',
    characterId: stringValue(value.characterId),
    sceneId: stringValue(value.sceneId),
    promptDocumentId: stringValue(value.promptDocumentId),
    prompt: stringValue(value.prompt),
    negativePrompt: stringValue(value.negativePrompt),
    referenceIds: stringList(value.referenceIds),
    params: recordValue(value.params) || {},
    providerType: stringValue(value.providerType, 'mock'),
    providerLabel: stringValue(value.providerLabel, 'Mock'),
    status: IMAGE_GEN_STATUSES.includes(rawStatus) ? rawStatus : 'pending',
    errorMessage: stringValue(value.errorMessage),
    outputs,
    createdAt,
    updatedAt: stringValue(value.updatedAt) || createdAt
  };
};

const normalizePromptVersion = (version) => {
  const value = recordValue(version);
  if (!value || !stringValue(value.id)) return null;
  const createdAt = stringValue(value.createdAt) || nowUtc();
  return {
    id: value.id,
    label: stringValue(value.label, 'Versão'),
    source: stringValue(value.source, 'manual'),
    preserve: stringList(value.preserve),
    vary: stringList(value.vary),
    masterPrompt: stringValue(value.masterPrompt),
    negativePrompt: stringValue(value.negativePrompt),
    shortPrompt: stringValue(value.shortPrompt),
    detailedPrompt: stringValue(value.detailedPrompt),
    scenePrompt: stringValue(value.scenePrompt),
    cinematicPrompt: stringValue(value.cinematicPrompt),
    variations: stringList(value.variations),
    fixedChecklist: stringList(value.fixedChecklist),
    notes: stringValue(value.notes),
    createdAt
  };
};

const normalizePromptDocument = (promptDocument) => {
  const value = recordValue(promptDocument);
  if (!value || !hasRequiredFields(value, ['id', 'projectId'])) return null;
  const createdAt = stringValue(value.createdAt) || nowUtc();
  const versions = (Array.isArray(value.versions) ? value.versions : [])
    .map(normalizePromptVersion)
    .filter(Boolean);
  const safeVersions = versions.length ? versions : [createPromptVersion()];
  const activeVersionId = safeVersions.some((version) => version.id === value.activeVersionId)
    ? value.activeVersionId
    : safeVersions[0].id;
  return {
    id: value.id,
    projectId: value.projectId,
    title: stringValue(value.title, 'Prompt sem título'),
    targetType: stringValue(value.targetType) === 'scene' ? 'scene' : 'character',
    targetId: stringValue(value.targetId),
    promptMedium: stringValue(value.promptMedium) === 'video' ? 'video' : 'image',
    stylePreset: stringValue(value.stylePreset, 'cinematic-realism'),
    cinematicPreset: stringValue(value.cinematicPreset, 'portrait-intimate'),
    lensLightingPreset: stringValue(value.lensLightingPreset, 'natural-soft'),
    emotionalTone: stringValue(value.emotionalTone),
    environment: stringValue(value.environment),
    lighting: stringValue(value.lighting),
    composition: stringValue(value.composition),
    notes: stringValue(value.notes),
    referenceIds: stringList(value.referenceIds),
    versions: safeVersions,
    activeVersionId,
    isFavorite: Boolean(value.isFavorite),
    isOfficial: Boolean(value.isOfficial),
    createdAt,
    updatedAt: stringValue(value.updatedAt) || createdAt
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
        (scene.chapterId === UNASSIGNED_CHAPTER_ID || chapterIds.has(scene.chapterId))
    );
  const characters = (Array.isArray(value.characters) ? value.characters : [])
    .map(normalizeCharacter)
    .filter((character) => character && projectIds.has(character.projectId));
  const characterIds = new Set(characters.map((character) => character.id));
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const loreEntries = (Array.isArray(value.loreEntries) ? value.loreEntries : [])
    .map(normalizeLoreEntry)
    .filter((entry) => entry && projectIds.has(entry.projectId));
  const assets = (Array.isArray(value.assets) ? value.assets : [])
    .map(normalizeAsset)
    .filter((asset) => asset && projectIds.has(asset.projectId));
  const referenceImages = (Array.isArray(value.referenceImages) ? value.referenceImages : [])
    .map(normalizeReferenceImage)
    .filter((ref) => ref && projectIds.has(ref.projectId));
  const promptDocuments = (Array.isArray(value.promptDocuments) ? value.promptDocuments : [])
    .map(normalizePromptDocument)
    .filter((promptDocument) => {
      if (!promptDocument || !projectIds.has(promptDocument.projectId)) return false;
      if (promptDocument.targetType === 'character') {
        return !promptDocument.targetId || characterIds.has(promptDocument.targetId);
      }
      return !promptDocument.targetId || sceneIds.has(promptDocument.targetId);
    });
  const generationJobs = (Array.isArray(value.generationJobs) ? value.generationJobs : [])
    .map(normalizeGenerationJob)
    .filter((job) => job && projectIds.has(job.projectId));

  return {
    ...state,
    projects,
    books,
    chapters,
    scenes,
    characters,
    loreEntries,
    assets,
    referenceImages,
    promptDocuments,
    generationJobs,
    settings: {
      ...baseSettings(),
      ...settingsSource,
      localWorkspace: normalizeLocalWorkspaceSettings(settingsSource.localWorkspace),
      imageGenProvider: normalizeImageGenSettings(settingsSource.imageGenProvider)
    }
  };
};

export const deleteEntity = (state, entityType, id) => {
  if (!id) return normalizeState(state);
  const current = normalizeState(state);

  if (entityType === 'project') {
    const bookIds = new Set(current.books.filter((book) => book.projectId === id).map((book) => book.id));
    const chapterIds = new Set(current.chapters.filter((chapter) => bookIds.has(chapter.bookId)).map((chapter) => chapter.id));
    return normalizeState({
      ...current,
      projects: current.projects.filter((project) => project.id !== id),
      books: current.books.filter((book) => book.projectId !== id),
      chapters: current.chapters.filter((chapter) => !bookIds.has(chapter.bookId)),
      scenes: current.scenes.filter((scene) => scene.projectId !== id && !chapterIds.has(scene.chapterId)),
      characters: current.characters.filter((character) => character.projectId !== id),
      loreEntries: current.loreEntries.filter((entry) => entry.projectId !== id),
      assets: current.assets.filter((asset) => asset.projectId !== id),
      referenceImages: current.referenceImages.filter((ref) => ref.projectId !== id),
      promptDocuments: current.promptDocuments.filter((promptDocument) => promptDocument.projectId !== id),
      generationJobs: current.generationJobs.filter((job) => job.projectId !== id)
    });
  }

  if (entityType === 'generationJob') {
    return {
      ...current,
      generationJobs: current.generationJobs.filter((job) => job.id !== id)
    };
  }

  if (entityType === 'generationOutput') {
    return {
      ...current,
      generationJobs: current.generationJobs.map((job) => ({
        ...job,
        outputs: job.outputs.filter((output) => output.id !== id)
      }))
    };
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
    return {
      ...current,
      scenes: current.scenes.filter((scene) => scene.id !== id),
      promptDocuments: current.promptDocuments.filter(
        (promptDocument) => !(promptDocument.targetType === 'scene' && promptDocument.targetId === id)
      )
    };
  }

  if (entityType === 'character') {
    return {
      ...current,
      characters: current.characters.filter((character) => character.id !== id),
      referenceImages: current.referenceImages.filter((ref) => ref.characterId !== id),
      promptDocuments: current.promptDocuments.filter(
        (promptDocument) => !(promptDocument.targetType === 'character' && promptDocument.targetId === id)
      )
    };
  }

  if (entityType === 'referenceImage') {
    return {
      ...current,
      referenceImages: current.referenceImages.filter((ref) => ref.id !== id),
      promptDocuments: current.promptDocuments.map((promptDocument) => ({
        ...promptDocument,
        referenceIds: promptDocument.referenceIds.filter((referenceId) => referenceId !== id)
      }))
    };
  }

  if (entityType === 'promptDocument') {
    return {
      ...current,
      promptDocuments: current.promptDocuments.filter((promptDocument) => promptDocument.id !== id)
    };
  }

  if (entityType === 'lore') {
    return { ...current, loreEntries: current.loreEntries.filter((entry) => entry.id !== id) };
  }

  if (entityType === 'asset') {
    return { ...current, assets: current.assets.filter((asset) => asset.id !== id) };
  }

  return current;
};

const newId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
};

export const emptyState = () => ({
  projects: [],
  books: [],
  chapters: [],
  scenes: [],
  characters: [],
  loreEntries: [],
  assets: [],
  settings: {
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
  }
});

export const createProject = ({ name, tone }) => ({
  id: newId(),
  name,
  tone,
  createdAt: new Date().toISOString()
});

export const createBook = ({ projectId, title }) => ({
  id: newId(),
  projectId,
  title,
  createdAt: new Date().toISOString()
});

export const createChapter = ({ projectId, bookId, title, content = '' }) => ({
  id: newId(),
  projectId,
  bookId,
  title,
  content,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

export const createCharacter = ({ projectId, name, canonTraits, masterPrompt, negativePrompt }) => ({
  id: newId(),
  projectId,
  name,
  canonTraits,
  masterPrompt,
  negativePrompt,
  references: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

export const createLoreEntry = ({ projectId, title, content }) => ({
  id: newId(),
  projectId,
  title,
  content,
  tags: [],
  createdAt: new Date().toISOString()
});

export const createScene = ({ projectId, chapterId, title, description }) => ({
  id: newId(),
  projectId,
  chapterId,
  title,
  description,
  createdAt: new Date().toISOString()
});

export const createAsset = ({ projectId, name, type, path }) => ({
  id: newId(),
  projectId,
  name,
  type,
  path,
  createdAt: new Date().toISOString()
});

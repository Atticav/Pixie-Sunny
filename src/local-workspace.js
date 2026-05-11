const textEncoder = new TextEncoder();

const joinPath = (...parts) =>
  parts
    .filter(Boolean)
    .map((part) => String(part).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');

const extensionFromMime = (mimeType = '') => {
  if (!mimeType) return 'bin';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return mimeType.split('/')[1] || 'bin';
};

const ensureDirectoryPath = async (rootHandle, path) => {
  let current = rootHandle;
  const segments = joinPath(path).split('/').filter(Boolean);
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
};

const writeTextFile = async (rootHandle, path, content) => {
  const segments = joinPath(path).split('/').filter(Boolean);
  const fileName = segments.pop();
  if (!fileName) throw new Error('Caminho de arquivo inválido.');
  const directory = await ensureDirectoryPath(rootHandle, segments.join('/'));
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(textEncoder.encode(content));
  await writable.close();
};

const rootDirectory = async () => {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;
  return navigator.storage.getDirectory();
};

export const localWorkspaceSupported = () =>
  typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';

export const localWorkspaceSummary = (settings) => {
  const workspace = settings?.localWorkspace || {};
  const dirs = workspace.directories || {};
  const rootPath = workspace.rootPath || '~/Library/Application Support/PixieSunnyStudio';
  return {
    rootPath,
    projectsPath: joinPath(rootPath, dirs.projects || 'projects'),
    referencesPath: joinPath(rootPath, dirs.references || 'references'),
    outputsPath: joinPath(rootPath, dirs.outputs || 'outputs'),
    exportsPath: joinPath(rootPath, dirs.exports || 'exports'),
    settingsPath: joinPath(rootPath, dirs.settings || 'settings')
  };
};

export const initializeLocalWorkspace = async (settings) => {
  const root = await rootDirectory();
  if (!root) {
    return {
      ok: false,
      message: 'Filesystem local avançado indisponível neste runtime. Estado seguirá em localStorage.'
    };
  }

  const workspace = settings?.localWorkspace || {};
  const directories = workspace.directories || {};
  await ensureDirectoryPath(root, directories.projects || 'projects');
  await ensureDirectoryPath(root, directories.references || 'references');
  await ensureDirectoryPath(root, directories.outputs || 'outputs');
  await ensureDirectoryPath(root, directories.exports || 'exports');
  await ensureDirectoryPath(root, directories.settings || 'settings');
  await writeTextFile(
    root,
    joinPath(directories.settings || 'settings', 'app-settings.json'),
    JSON.stringify(
      {
        initializedAt: new Date().toISOString(),
        localWorkspace: workspace
      },
      null,
      2
    )
  );
  return {
    ok: true,
    message: 'Workspace local inicializado com sucesso.'
  };
};

export const mirrorProjectStateToWorkspace = async (settings, project, state) => {
  const workspace = settings?.localWorkspace || {};
  const prefs = workspace.preferences || {};
  if (!workspace.enabled || !prefs.autoMirrorProjectState) return null;
  const root = await rootDirectory();
  if (!root || !project?.id) return null;
  const dir = workspace.directories?.projects || 'projects';
  const projectState = {
    project,
    books: (state.books || []).filter((book) => book.projectId === project.id),
    chapters: (state.chapters || []).filter((chapter) => chapter.projectId === project.id),
    scenes: (state.scenes || []).filter((scene) => scene.projectId === project.id),
    characters: (state.characters || []).filter((character) => character.projectId === project.id),
    loreEntries: (state.loreEntries || []).filter((entry) => entry.projectId === project.id),
    assets: (state.assets || []).filter((asset) => asset.projectId === project.id),
    referenceImages: (state.referenceImages || []).filter((ref) => ref.projectId === project.id),
    promptDocuments: (state.promptDocuments || []).filter((promptDocument) => promptDocument.projectId === project.id)
  };
  await writeTextFile(
    root,
    joinPath(dir, project.id, 'project-state.json'),
    JSON.stringify(projectState, null, 2)
  );
  return joinPath(dir, project.id, 'project-state.json');
};

export const saveReferenceFileToWorkspace = async ({ settings, projectId, referenceId, blob, fileName }) => {
  const workspace = settings?.localWorkspace || {};
  const prefs = workspace.preferences || {};
  if (!workspace.enabled || !prefs.saveReferenceFilesToWorkspace) return '';
  const root = await rootDirectory();
  if (!root || !projectId || !referenceId || !blob) return '';
  const extension = extensionFromMime(blob.type);
  const safeName = fileName ? fileName.replace(/[^\w.-]+/g, '-').toLowerCase() : `reference.${extension}`;
  const directory = await ensureDirectoryPath(
    root,
    joinPath(workspace.directories?.references || 'references', projectId)
  );
  const fileHandle = await directory.getFileHandle(`${referenceId}-${safeName}`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return joinPath(workspace.directories?.references || 'references', projectId, `${referenceId}-${safeName}`);
};

export const saveExportToWorkspace = async ({ settings, filename, content }) => {
  const workspace = settings?.localWorkspace || {};
  const prefs = workspace.preferences || {};
  if (!workspace.enabled || !prefs.saveExportsToWorkspace) return '';
  const root = await rootDirectory();
  if (!root) return '';
  const targetPath = joinPath(workspace.directories?.exports || 'exports', filename);
  await writeTextFile(root, targetPath, content);
  return targetPath;
};

import {
  createAsset,
  createBook,
  createChapter,
  createCharacter,
  createLoreEntry,
  createPromptDocument,
  createProject,
  createReferenceImage,
  createScene,
  deleteEntity,
  REFERENCE_TYPES,
  UNASSIGNED_CHAPTER_ID
} from './models.js';
import { createStore, sanitizeState } from './store.js';
import {
  buildCharacterPromptPack,
  buildScenePromptPack,
  buildSceneSpec,
  buildVideoSpec,
  inferSceneCharactersFromContext,
  PROMPT_CINEMATIC_PRESETS,
  PROMPT_LENS_LIGHT_PRESETS,
  PROMPT_STYLE_PRESETS,
  searchLore,
  suggestNextParagraph
} from './assistant.js';
import {
  initializeLocalWorkspace,
  localWorkspaceSupported,
  localWorkspaceSummary,
  mirrorProjectStateToWorkspace,
  saveExportToWorkspace,
  saveReferenceFileToWorkspace
} from './local-workspace.js';

const store = createStore();
let state = store.load();

const $ = (id) => document.getElementById(id);
const newClientId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e9)}-${Math.floor(Math.random() * 1e6)}`;

const refs = {
  projectSelect: $('projectSelect'),
  bookSelect: $('bookSelect'),
  chapterSelect: $('chapterSelect'),
  characterSelect: $('characterSelect'),
  loreSelect: $('loreSelect'),
  sceneSelect: $('sceneSelect'),
  videoImageAssetSelect: $('videoImageAssetSelect'),
  loreList: $('loreList'),
  assetList: $('assetList'),
  chapterContent: $('chapterContent'),
  writingSuggestion: $('writingSuggestion'),
  characterPreview: $('characterPreview'),
  sceneSpec: $('sceneSpec'),
  videoSpec: $('videoSpec'),
  promptDocumentSelect: $('promptDocumentSelect'),
  promptDocumentPreview: $('promptDocumentPreview'),
  workspaceEnabled: $('workspaceEnabled'),
  workspaceMode: $('workspaceMode'),
  workspaceRootPath: $('workspaceRootPath'),
  workspaceProjectsDir: $('workspaceProjectsDir'),
  workspaceReferencesDir: $('workspaceReferencesDir'),
  workspaceOutputsDir: $('workspaceOutputsDir'),
  workspaceExportsDir: $('workspaceExportsDir'),
  workspaceSettingsDir: $('workspaceSettingsDir'),
  workspaceMirrorState: $('workspaceMirrorState'),
  workspaceSaveRefs: $('workspaceSaveRefs'),
  workspaceSaveExports: $('workspaceSaveExports'),
  workspaceSupport: $('workspaceSupport'),
  workspacePreview: $('workspacePreview'),
  workspaceStatus: $('workspaceStatus')
};

const parseTextList = (value, separator) =>
  (typeof value === 'string' ? value : '')
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseLines = (value) => parseTextList(value, '\n');

const parseTags = (value) => parseTextList(value, ',');

const sanitizeFilename = (value) => (value || 'prompt').replace(/[^\w-]+/g, '-').toLowerCase();
const sanitizeFileName = (value, fallback = 'file') =>
  (value || fallback)
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;

const selectedProjectId = () => refs.projectSelect.value;

const selectedBookId = () => refs.bookSelect.value;

const selectedChapterId = () => refs.chapterSelect.value;

const selectedCharacterId = () => refs.characterSelect.value;

const selectedLoreId = () => refs.loreSelect.value;

const selectedSceneId = () => refs.sceneSelect.value;

const workspaceSettings = () => state.settings?.localWorkspace || {};

const setWorkspaceStatus = (message) => {
  if (refs.workspaceStatus) refs.workspaceStatus.textContent = message;
};

const renderOptions = (select, options, selectedId, emptyLabel = 'Nenhum item cadastrado') => {
  select.innerHTML = '';
  if (!options.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = emptyLabel;
    select.append(option);
    select.value = '';
    return;
  }

  options.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name || item.title;
    if (selectedId && selectedId === item.id) option.selected = true;
    select.append(option);
  });

  if (!select.value && options[0]) {
    select.value = options[0].id;
  }
};

const setValue = (id, value) => {
  $(id).value = value || '';
};

const setDisabled = (ids, disabled) => {
  ids.forEach((id) => {
    $(id).disabled = disabled;
  });
};

const currentProject = () => state.projects.find((project) => project.id === selectedProjectId());

const currentBook = () => state.books.find((book) => book.id === selectedBookId());

const currentChapter = () => state.chapters.find((chapter) => chapter.id === selectedChapterId());

const currentCharacter = () => state.characters.find((character) => character.id === selectedCharacterId());

const currentLoreEntry = () => state.loreEntries.find((entry) => entry.id === selectedLoreId());

const currentScene = () => state.scenes.find((scene) => scene.id === selectedSceneId());

const projectBooks = () => state.books.filter((book) => book.projectId === selectedProjectId());

const projectChapters = () =>
  state.chapters.filter(
    (chapter) => chapter.projectId === selectedProjectId() && chapter.bookId === selectedBookId()
  );

const projectCharacters = () => state.characters.filter((character) => character.projectId === selectedProjectId());

const projectLore = () => state.loreEntries.filter((entry) => entry.projectId === selectedProjectId());

const projectScenes = () =>
  state.scenes.filter(
    (scene) =>
      scene.projectId === selectedProjectId() &&
      (!selectedChapterId() ||
        scene.chapterId === UNASSIGNED_CHAPTER_ID ||
        scene.chapterId === selectedChapterId())
  );

const projectAssets = () => state.assets.filter((asset) => asset.projectId === selectedProjectId());

const projectPromptDocuments = () =>
  state.promptDocuments.filter((promptDocument) => promptDocument.projectId === selectedProjectId());

const currentPromptDocument = () =>
  state.promptDocuments.find((promptDocument) => promptDocument.id === refs.promptDocumentSelect.value);

const currentPromptVersion = (promptDocument = currentPromptDocument()) =>
  promptDocument?.versions?.find((version) => version.id === promptDocument.activeVersionId) ||
  promptDocument?.versions?.[0] ||
  null;

const renderLore = () => {
  const query = $('loreSearch').value;
  const entries = searchLore(projectLore(), query);
  refs.loreList.innerHTML = '';

  entries.forEach((entry) => {
    const li = document.createElement('li');
    const tags = entry.tags.length ? ` [${entry.tags.join(', ')}]` : '';
    li.textContent = `${entry.title}${tags}: ${entry.content}`;
    refs.loreList.append(li);
  });
};

const renderAssets = () => {
  refs.assetList.innerHTML = '';
  const assets = projectAssets();

  assets.forEach((asset) => {
    const li = document.createElement('li');
    li.textContent = `${asset.type} · ${asset.name} · ${asset.path}`;
    refs.assetList.append(li);
  });

  const imageAssets = assets.filter((asset) => asset.type.toLowerCase() === 'image');
  renderOptions(
    refs.videoImageAssetSelect,
    imageAssets,
    refs.videoImageAssetSelect.value || imageAssets[0]?.id,
    'Nenhuma imagem cadastrada'
  );
};

const renderProjectEditor = () => {
  const project = currentProject();
  setValue('projectNameInput', project?.name);
  setValue('projectToneInput', project?.tone);
  setValue('projectDescriptionInput', project?.description);
  setDisabled(['saveProjectBtn', 'deleteProjectBtn'], !project);
};

const renderBookEditor = () => {
  const book = currentBook();
  setValue('bookTitleInput', book?.title);
  setValue('bookSynopsisInput', book?.synopsis);
  setDisabled(['saveBookBtn', 'deleteBookBtn', 'createChapterBtn'], !book);
};

const renderChapterEditor = () => {
  const chapter = currentChapter();
  setValue('chapterTitleInput', chapter?.title);
  setValue('chapterSummaryInput', chapter?.summary);
  refs.chapterContent.value = chapter?.content || '';
  setDisabled(['saveChapterBtn', 'deleteChapterBtn', 'suggestTextBtn', 'openWriterStudioBtn'], !chapter);
};

const renderCharacterEditor = () => {
  const character = currentCharacter();
  setValue('characterNameInput', character?.name);
  setValue('characterNotesInput', character?.notes);
  setValue('characterCanonInput', character?.canonTraits?.join('\n'));
  setValue('characterPromptInput', character?.masterPrompt);
  setValue('characterNegativePromptInput', character?.negativePrompt);
  refs.characterPreview.textContent = character
    ? JSON.stringify(character, null, 2)
    : 'Sem personagem selecionado.';
  setDisabled(['saveCharacterBtn', 'deleteCharacterBtn'], !character);
};

const renderLoreEditor = () => {
  const entry = currentLoreEntry();
  setValue('loreTitleInput', entry?.title);
  setValue('loreContentInput', entry?.content);
  setValue('loreTagsInput', entry?.tags?.join(', '));
  setDisabled(['saveLoreBtn', 'deleteLoreBtn'], !entry);
};

const renderSceneEditor = () => {
  const scene = currentScene();
  setValue('sceneTitleInput', scene?.title);
  setValue('sceneDescriptionInput', scene?.description);
  setValue('sceneLocationInput', scene?.location);
  setDisabled(['saveSceneBtn', 'deleteSceneBtn', 'generateSceneSpecBtn'], !scene);
};

const renderPromptEditor = () => {
  const promptDocument = currentPromptDocument();
  const version = currentPromptVersion(promptDocument);
  if (!promptDocument || !version) {
    refs.promptDocumentPreview.textContent = 'Nenhum prompt estruturado selecionado.';
    return;
  }

  const targetLabel =
    promptDocument.targetType === 'scene'
      ? state.scenes.find((scene) => scene.id === promptDocument.targetId)?.title || 'Cena removida'
      : state.characters.find((character) => character.id === promptDocument.targetId)?.name || 'Personagem removido';
  refs.promptDocumentPreview.textContent = JSON.stringify(
    {
      title: promptDocument.title,
      targetType: promptDocument.targetType,
      target: targetLabel,
      promptMedium: promptDocument.promptMedium,
      favorite: promptDocument.isFavorite,
      official: promptDocument.isOfficial,
      version: version.label,
      preserve: version.preserve,
      vary: version.vary,
      masterPrompt: version.masterPrompt,
      scenePrompt: version.scenePrompt,
      cinematicPrompt: version.cinematicPrompt,
      fixedChecklist: version.fixedChecklist
    },
    null,
    2
  );
};

const renderWorkspaceSettings = () => {
  const workspace = workspaceSettings();
  const directories = workspace.directories || {};
  const preferences = workspace.preferences || {};
  const summary = localWorkspaceSummary(state.settings);

  refs.workspaceEnabled.checked = Boolean(workspace.enabled);
  refs.workspaceMode.value = workspace.mode || 'opfs';
  refs.workspaceRootPath.value = workspace.rootPath || '';
  refs.workspaceProjectsDir.value = directories.projects || '';
  refs.workspaceReferencesDir.value = directories.references || '';
  refs.workspaceOutputsDir.value = directories.outputs || '';
  refs.workspaceExportsDir.value = directories.exports || '';
  refs.workspaceSettingsDir.value = directories.settings || '';
  refs.workspaceMirrorState.checked = Boolean(preferences.autoMirrorProjectState);
  refs.workspaceSaveRefs.checked = Boolean(preferences.saveReferenceFilesToWorkspace);
  refs.workspaceSaveExports.checked = Boolean(preferences.saveExportsToWorkspace);
  refs.workspaceSupport.textContent = localWorkspaceSupported()
    ? 'OPFS disponível neste runtime (filesystem local ativo). `rootPath` é um rótulo lógico de organização.'
    : 'OPFS indisponível neste runtime (fallback para localStorage/browser).';
  refs.workspacePreview.textContent = JSON.stringify(summary, null, 2);
};

const render = () => {
  renderOptions(refs.projectSelect, state.projects, selectedProjectId(), 'Crie seu primeiro projeto');

  const books = projectBooks();
  renderOptions(refs.bookSelect, books, selectedBookId(), 'Nenhum livro neste projeto');

  const chapters = projectChapters();
  renderOptions(refs.chapterSelect, chapters, selectedChapterId(), 'Nenhum capítulo neste livro');

  const characters = projectCharacters();
  renderOptions(refs.characterSelect, characters, selectedCharacterId(), 'Nenhum personagem neste projeto');

  const loreEntries = projectLore();
  renderOptions(refs.loreSelect, loreEntries, selectedLoreId(), 'Nenhuma entrada de lore');

  const scenes = projectScenes();
  renderOptions(refs.sceneSelect, scenes, selectedSceneId(), 'Nenhuma cena neste contexto');

  const promptDocuments = projectPromptDocuments();
  renderOptions(
    refs.promptDocumentSelect,
    promptDocuments.map((promptDocument) => ({
      ...promptDocument,
      name: `${promptDocument.isOfficial ? '✓ ' : ''}${promptDocument.isFavorite ? '★ ' : ''}${promptDocument.title}`
    })),
    refs.promptDocumentSelect.value,
    'Nenhum prompt estruturado'
  );

  renderProjectEditor();
  renderBookEditor();
  renderChapterEditor();
  renderCharacterEditor();
  renderLoreEditor();
  renderSceneEditor();
  renderPromptEditor();
  renderWorkspaceSettings();
  renderLore();
  renderAssets();

  setDisabled(['createBookBtn', 'createCharacterBtn', 'createLoreBtn', 'createSceneBtn', 'saveAssetBtn'], !selectedProjectId());
  setDisabled(['openCanonStudioBtn'], !selectedCharacterId() || !selectedProjectId());
  setDisabled(
    ['openPromptStudioBtn', 'createPromptDocumentBtn', 'openPromptStudioFromCharacterBtn', 'openPromptStudioFromSceneBtn'],
    !selectedProjectId()
  );
};

const persist = () => {
  state = store.save(state);
  const project = currentProject();
  if (project) {
    mirrorProjectStateToWorkspace(state.settings, project, state).catch((error) => {
      console.warn('Falha ao espelhar projeto no workspace local:', error);
      setWorkspaceStatus(`Falha ao espelhar projeto automaticamente: ${error?.message || 'erro desconhecido'}`);
    });
  }
  render();
};

const readWorkspaceSettingsFromUi = () => ({
  mode: refs.workspaceMode.value || 'opfs',
  enabled: refs.workspaceEnabled.checked,
  rootPath: refs.workspaceRootPath.value.trim(),
  directories: {
    projects: refs.workspaceProjectsDir.value.trim() || 'projects',
    references: refs.workspaceReferencesDir.value.trim() || 'references',
    outputs: refs.workspaceOutputsDir.value.trim() || 'outputs',
    exports: refs.workspaceExportsDir.value.trim() || 'exports',
    settings: refs.workspaceSettingsDir.value.trim() || 'settings'
  },
  preferences: {
    autoMirrorProjectState: refs.workspaceMirrorState.checked,
    saveReferenceFilesToWorkspace: refs.workspaceSaveRefs.checked,
    saveExportsToWorkspace: refs.workspaceSaveExports.checked
  }
});

const saveWorkspaceSettings = () => {
  state.settings = {
    ...state.settings,
    localWorkspace: readWorkspaceSettingsFromUi()
  };
  state = store.save(state);
  renderWorkspaceSettings();
  setWorkspaceStatus('Configurações locais salvas.');
};

$('createProjectBtn').addEventListener('click', () => {
  const name = $('newProjectName').value.trim();
  const tone = $('newProjectTone').value.trim();
  const description = $('newProjectDescription').value.trim();
  if (!name) return;

  state.projects.push(createProject({ name, tone, description }));
  setValue('newProjectName', '');
  setValue('newProjectTone', '');
  setValue('newProjectDescription', '');
  persist();
});

$('saveProjectBtn').addEventListener('click', () => {
  const project = currentProject();
  if (!project) return;

  project.name = $('projectNameInput').value.trim() || project.name;
  project.tone = $('projectToneInput').value.trim();
  project.description = $('projectDescriptionInput').value.trim();
  project.updatedAt = new Date().toISOString();
  persist();
});

$('deleteProjectBtn').addEventListener('click', () => {
  const project = currentProject();
  if (!project || !window.confirm(`Excluir o projeto "${project.name}" e todos os dados relacionados?`)) return;

  state = deleteEntity(state, 'project', project.id);
  persist();
});

$('createBookBtn').addEventListener('click', () => {
  const title = $('newBookTitle').value.trim();
  const synopsis = $('newBookSynopsis').value.trim();
  if (!title || !selectedProjectId()) return;

  state.books.push(createBook({ projectId: selectedProjectId(), title, synopsis }));
  setValue('newBookTitle', '');
  setValue('newBookSynopsis', '');
  persist();
});

$('saveBookBtn').addEventListener('click', () => {
  const book = currentBook();
  if (!book) return;

  book.title = $('bookTitleInput').value.trim() || book.title;
  book.synopsis = $('bookSynopsisInput').value.trim();
  book.updatedAt = new Date().toISOString();
  persist();
});

$('deleteBookBtn').addEventListener('click', () => {
  const book = currentBook();
  if (!book || !window.confirm(`Excluir o livro "${book.title}" e seus capítulos/cenas?`)) return;

  state = deleteEntity(state, 'book', book.id);
  persist();
});

$('createChapterBtn').addEventListener('click', () => {
  const title = $('newChapterTitle').value.trim();
  const summary = $('newChapterSummary').value.trim();
  if (!title || !selectedProjectId() || !selectedBookId()) return;

  state.chapters.push(
    createChapter({
      projectId: selectedProjectId(),
      bookId: selectedBookId(),
      title,
      summary,
      content: ''
    })
  );
  setValue('newChapterTitle', '');
  setValue('newChapterSummary', '');
  persist();
});

$('saveChapterBtn').addEventListener('click', () => {
  const chapter = currentChapter();
  if (!chapter) return;

  chapter.title = $('chapterTitleInput').value.trim() || chapter.title;
  chapter.summary = $('chapterSummaryInput').value.trim();
  chapter.content = refs.chapterContent.value;
  chapter.updatedAt = new Date().toISOString();
  persist();
});

$('deleteChapterBtn').addEventListener('click', () => {
  const chapter = currentChapter();
  if (!chapter || !window.confirm(`Excluir o capítulo "${chapter.title}" e suas cenas?`)) return;

  state = deleteEntity(state, 'chapter', chapter.id);
  persist();
});

$('suggestTextBtn').addEventListener('click', () => {
  const chapter = currentChapter();
  if (!chapter) return;

  refs.writingSuggestion.textContent = suggestNextParagraph({
    chapterContent: chapter.content,
    chapterTitle: chapter.title,
    loreEntries: projectLore(),
    characters: projectCharacters()
  });
});

$('createCharacterBtn').addEventListener('click', () => {
  const name = $('newCharacterName').value.trim();
  if (!name || !selectedProjectId()) return;

  state.characters.push(
    createCharacter({
      projectId: selectedProjectId(),
      name,
      notes: $('newCharacterNotes').value.trim(),
      canonTraits: parseLines($('newCharacterCanon').value),
      masterPrompt: $('newCharacterPrompt').value.trim(),
      negativePrompt: $('newCharacterNegativePrompt').value.trim()
    })
  );

  setValue('newCharacterName', '');
  setValue('newCharacterNotes', '');
  setValue('newCharacterCanon', '');
  setValue('newCharacterPrompt', '');
  setValue('newCharacterNegativePrompt', '');
  persist();
});

$('saveCharacterBtn').addEventListener('click', () => {
  const character = currentCharacter();
  if (!character) return;

  character.name = $('characterNameInput').value.trim() || character.name;
  character.notes = $('characterNotesInput').value.trim();
  character.canonTraits = parseLines($('characterCanonInput').value);
  character.masterPrompt = $('characterPromptInput').value.trim();
  character.negativePrompt = $('characterNegativePromptInput').value.trim();
  character.updatedAt = new Date().toISOString();
  persist();
});

$('deleteCharacterBtn').addEventListener('click', () => {
  const character = currentCharacter();
  if (!character || !window.confirm(`Excluir o personagem "${character.name}"?`)) return;

  state = deleteEntity(state, 'character', character.id);
  persist();
});

$('createLoreBtn').addEventListener('click', () => {
  const title = $('newLoreTitle').value.trim();
  const content = $('newLoreContent').value.trim();
  if (!title || !content || !selectedProjectId()) return;

  state.loreEntries.push(
    createLoreEntry({
      projectId: selectedProjectId(),
      title,
      content,
      tags: parseTags($('newLoreTags').value)
    })
  );
  setValue('newLoreTitle', '');
  setValue('newLoreContent', '');
  setValue('newLoreTags', '');
  persist();
});

$('saveLoreBtn').addEventListener('click', () => {
  const entry = currentLoreEntry();
  if (!entry) return;

  entry.title = $('loreTitleInput').value.trim() || entry.title;
  entry.content = $('loreContentInput').value.trim();
  entry.tags = parseTags($('loreTagsInput').value);
  entry.updatedAt = new Date().toISOString();
  persist();
});

$('deleteLoreBtn').addEventListener('click', () => {
  const entry = currentLoreEntry();
  if (!entry || !window.confirm(`Excluir a entrada de lore "${entry.title}"?`)) return;

  state = deleteEntity(state, 'lore', entry.id);
  persist();
});

$('createSceneBtn').addEventListener('click', () => {
  const title = $('newSceneTitle').value.trim();
  const description = $('newSceneDescription').value.trim();
  if (!title || !description || !selectedProjectId()) return;

  state.scenes.push(
    createScene({
      projectId: selectedProjectId(),
      chapterId: selectedChapterId() || UNASSIGNED_CHAPTER_ID,
      title,
      description,
      location: $('newSceneLocation').value.trim()
    })
  );
  setValue('newSceneTitle', '');
  setValue('newSceneDescription', '');
  setValue('newSceneLocation', '');
  persist();
});

$('saveSceneBtn').addEventListener('click', () => {
  const scene = currentScene();
  if (!scene) return;

  scene.title = $('sceneTitleInput').value.trim() || scene.title;
  scene.description = $('sceneDescriptionInput').value.trim();
  scene.location = $('sceneLocationInput').value.trim();
  scene.updatedAt = new Date().toISOString();
  persist();
});

$('deleteSceneBtn').addEventListener('click', () => {
  const scene = currentScene();
  if (!scene || !window.confirm(`Excluir a cena "${scene.title}"?`)) return;

  state = deleteEntity(state, 'scene', scene.id);
  persist();
});

$('generateSceneSpecBtn').addEventListener('click', () => {
  const scene = currentScene();
  if (!scene) return;

  const spec = buildSceneSpec({
    projectTone: currentProject()?.tone,
    scene,
    characters: projectCharacters()
  });
  refs.sceneSpec.textContent = JSON.stringify(spec, null, 2);
});

$('saveAssetBtn').addEventListener('click', () => {
  const name = $('assetName').value.trim();
  const type = $('assetType').value.trim() || 'ref';
  const path = $('assetPath').value.trim();
  if (!name || !path || !selectedProjectId()) return;

  state.assets.push(createAsset({ projectId: selectedProjectId(), name, type, path }));
  setValue('assetName', '');
  setValue('assetType', '');
  setValue('assetPath', '');
  persist();
});

$('generateVideoSpecBtn').addEventListener('click', () => {
  const spec = buildVideoSpec({
    scene: currentScene(),
    imageAsset: projectAssets().find((asset) => asset.id === refs.videoImageAssetSelect.value),
    projectTone: currentProject()?.tone
  });
  refs.videoSpec.textContent = JSON.stringify(spec, null, 2);
});

$('exportDataBtn').addEventListener('click', async () => {
  const payload = JSON.stringify(state, null, 2);
  const filename = 'pixie-sunny-studio-backup.json';
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  try {
    const savedPath = await saveExportToWorkspace({ settings: state.settings, filename, content: payload });
    if (savedPath) setWorkspaceStatus(`Backup salvo em workspace local: ${savedPath}`);
  } catch (error) {
    console.warn('Falha ao salvar backup no workspace local:', error);
  }
});

$('importDataInput').addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  const content = await file.text();
  try {
    state = sanitizeState(JSON.parse(content));
    persist();
    event.target.value = '';
  } catch (error) {
    console.error('Falha ao importar JSON', error);
    alert(`Erro ao importar JSON: ${error?.message || 'o arquivo não contém dados válidos ou está corrompido'}`);
  }
});

$('saveWorkspaceSettingsBtn').addEventListener('click', saveWorkspaceSettings);

$('initWorkspaceBtn').addEventListener('click', async () => {
  saveWorkspaceSettings();
  const result = await initializeLocalWorkspace(state.settings);
  setWorkspaceStatus(result.message);
});

$('mirrorCurrentProjectBtn').addEventListener('click', async () => {
  const project = currentProject();
  if (!project) {
    setWorkspaceStatus('Selecione um projeto para espelhar no filesystem local.');
    return;
  }
  try {
    const path = await mirrorProjectStateToWorkspace(state.settings, project, state);
    setWorkspaceStatus(path ? `Projeto espelhado em ${path}` : 'Espelhamento desativado ou indisponível.');
  } catch (error) {
    setWorkspaceStatus(`Falha ao espelhar projeto: ${error?.message || 'erro desconhecido'}`);
  }
});

refs.projectSelect.addEventListener('change', render);
refs.bookSelect.addEventListener('change', render);
refs.chapterSelect.addEventListener('change', render);
refs.characterSelect.addEventListener('change', render);
refs.loreSelect.addEventListener('change', render);
refs.sceneSelect.addEventListener('change', render);
$('loreSearch').addEventListener('input', renderLore);

// =========== Writer Studio ===========

const AUTOSAVE_DELAY = 1500;
let autoSaveTimer = null;
let wsIsOpen = false;

const wsRefs = {
  overlay: $('writerStudio'),
  closeBtn: $('wsCloseBtn'),
  focusBtn: $('wsFocusBtn'),
  body: $('wsBody'),
  chapterTitle: $('wsChapterTitle'),
  autosaveIndicator: $('wsAutosaveIndicator'),
  statusSelect: $('wsStatusSelect'),
  projectSelect: $('wsProjectSelect'),
  bookSelect: $('wsBookSelect'),
  chapterSelect: $('wsChapterSelect'),
  summary: $('wsSummary'),
  goal: $('wsGoal'),
  conflict: $('wsConflict'),
  presentCharacters: $('wsPresentCharacters'),
  continuity: $('wsContinuity'),
  wordGoal: $('wsWordGoal'),
  notes: $('wsNotes'),
  metaSaveBtn: $('wsMetaSaveBtn'),
  content: $('wsContent'),
  wordCountDisplay: $('wsWordCountDisplay'),
  goalDisplay: $('wsGoalDisplay'),
  progressFill: $('wsProgressFill'),
  characterList: $('wsCharacterList'),
  loreSearch: $('wsLoreSearch'),
  loreList: $('wsLoreList'),
  sceneList: $('wsSceneList'),
  leftToggle: $('wsLeftToggle'),
  rightToggle: $('wsRightToggle'),
  sidebarLeft: $('wsSidebarLeft'),
  sidebarRight: $('wsSidebarRight')
};

const countWords = (text) => {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
};

const formatTime = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const wsSetAutosaveStatus = (status) => {
  wsRefs.autosaveIndicator.className = `ws-autosave ${status}`;
  wsRefs.autosaveIndicator.textContent =
    status === 'saving' ? 'Salvando...' : `✓ Salvo às ${formatTime()}`;
};

const wsUpdateWordCount = () => {
  const text = wsRefs.content.value;
  const words = countWords(text);
  const chars = text.length;
  wsRefs.wordCountDisplay.textContent = `${words.toLocaleString('pt-BR')} palavras · ${chars.toLocaleString('pt-BR')} caracteres`;
  const chapter = currentChapter();
  const goal = chapter?.wordGoal || 0;
  if (goal > 0) {
    const percent = Math.min(100, Math.round((words / goal) * 100));
    wsRefs.progressFill.style.width = `${percent}%`;
    wsRefs.goalDisplay.textContent = `${percent}% da meta (${goal.toLocaleString('pt-BR')} palavras)`;
  } else {
    wsRefs.progressFill.style.width = '0%';
    wsRefs.goalDisplay.textContent = '';
  }
};

const wsRenderLoreContext = () => {
  const query = wsRefs.loreSearch.value;
  const entries = searchLore(projectLore(), query);
  wsRefs.loreList.innerHTML = '';
  if (entries.length) {
    entries.forEach((entry) => {
      const li = document.createElement('li');
      const tags = entry.tags.length ? ` [${entry.tags.join(', ')}]` : '';
      const preview = entry.content.length > 100 ? `${entry.content.slice(0, 100)}…` : entry.content;
      li.innerHTML = `<strong>${entry.title}${tags}</strong>${preview}`;
      wsRefs.loreList.append(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'Nenhuma entrada encontrada.';
    wsRefs.loreList.append(li);
  }
};

const wsRenderContext = () => {
  const characters = projectCharacters();
  wsRefs.characterList.innerHTML = '';
  if (characters.length) {
    characters.forEach((char) => {
      const li = document.createElement('li');
      const note = char.notes ? (char.notes.length > 80 ? `${char.notes.slice(0, 80)}…` : char.notes) : '';
      li.innerHTML = `<strong>${char.name}</strong>${note}`;
      wsRefs.characterList.append(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'Nenhum personagem cadastrado.';
    wsRefs.characterList.append(li);
  }

  wsRenderLoreContext();

  const scenes = projectScenes();
  wsRefs.sceneList.innerHTML = '';
  if (scenes.length) {
    scenes.forEach((scene) => {
      const li = document.createElement('li');
      const loc = scene.location ? ` — ${scene.location}` : '';
      li.innerHTML = `<strong>${scene.title}</strong>${loc}`;
      wsRefs.sceneList.append(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'Nenhuma cena neste capítulo.';
    wsRefs.sceneList.append(li);
  }
};

const wsPopulateNavigation = () => {
  renderOptions(wsRefs.projectSelect, state.projects, selectedProjectId(), 'Nenhum projeto');
  renderOptions(wsRefs.bookSelect, projectBooks(), selectedBookId(), 'Nenhum livro');
  renderOptions(wsRefs.chapterSelect, projectChapters(), selectedChapterId(), 'Nenhum capítulo');
};

const wsRenderMeta = () => {
  const chapter = currentChapter();
  wsRefs.chapterTitle.textContent = chapter?.title || '—';
  wsRefs.summary.value = chapter?.summary || '';
  wsRefs.goal.value = chapter?.goal || '';
  wsRefs.conflict.value = chapter?.conflict || '';
  wsRefs.presentCharacters.value = Array.isArray(chapter?.presentCharacters)
    ? chapter.presentCharacters.join(', ')
    : '';
  wsRefs.continuity.value = chapter?.continuity || '';
  wsRefs.wordGoal.value = chapter?.wordGoal || '';
  wsRefs.notes.value = chapter?.notes || '';
  wsRefs.statusSelect.value = chapter?.status || 'rascunho';
  wsRefs.content.value = chapter?.content || '';
};

const wsAutoSave = () => {
  const chapter = currentChapter();
  if (!chapter) return;
  chapter.content = wsRefs.content.value;
  chapter.updatedAt = new Date().toISOString();
  state = store.save(state);
  wsSetAutosaveStatus('saved');
};

const wsScheduleAutoSave = () => {
  wsSetAutosaveStatus('saving');
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    wsAutoSave();
    autoSaveTimer = null;
  }, AUTOSAVE_DELAY);
};

const openWriterStudio = () => {
  const chapter = currentChapter();
  if (!chapter) return;
  wsIsOpen = true;
  wsPopulateNavigation();
  wsRenderMeta();
  wsUpdateWordCount();
  wsRenderContext();
  wsRefs.overlay.classList.remove('ws-hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => wsRefs.content.focus(), 50);
};

const closeWriterStudio = () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
    wsAutoSave();
  }
  wsIsOpen = false;
  wsRefs.overlay.classList.add('ws-hidden');
  document.body.style.overflow = '';
  render();
};

$('openWriterStudioBtn').addEventListener('click', openWriterStudio);

wsRefs.closeBtn.addEventListener('click', closeWriterStudio);

wsRefs.focusBtn.addEventListener('click', () => {
  wsRefs.body.classList.toggle('focus-mode');
  const isFocus = wsRefs.body.classList.contains('focus-mode');
  wsRefs.focusBtn.textContent = isFocus ? '⊞' : '⊡';
  wsRefs.focusBtn.title = isFocus ? 'Sair do modo foco' : 'Modo foco';
});

wsRefs.content.addEventListener('input', () => {
  wsUpdateWordCount();
  wsScheduleAutoSave();
});

wsRefs.statusSelect.addEventListener('change', () => {
  const chapter = currentChapter();
  if (!chapter) return;
  chapter.status = wsRefs.statusSelect.value;
  chapter.updatedAt = new Date().toISOString();
  state = store.save(state);
  wsSetAutosaveStatus('saved');
});

wsRefs.metaSaveBtn.addEventListener('click', () => {
  const chapter = currentChapter();
  if (!chapter) return;
  chapter.summary = wsRefs.summary.value.trim();
  chapter.goal = wsRefs.goal.value.trim();
  chapter.conflict = wsRefs.conflict.value.trim();
  chapter.presentCharacters = parseTags(wsRefs.presentCharacters.value);
  chapter.continuity = wsRefs.continuity.value.trim();
  chapter.wordGoal = Math.max(0, parseInt(wsRefs.wordGoal.value, 10) || 0);
  chapter.notes = wsRefs.notes.value.trim();
  chapter.updatedAt = new Date().toISOString();
  state = store.save(state);
  wsSetAutosaveStatus('saved');
  wsUpdateWordCount();
});

wsRefs.loreSearch.addEventListener('input', wsRenderLoreContext);

wsRefs.projectSelect.addEventListener('change', () => {
  refs.projectSelect.value = wsRefs.projectSelect.value;
  renderOptions(wsRefs.bookSelect, projectBooks(), '', 'Nenhum livro');
  refs.bookSelect.value = wsRefs.bookSelect.value;
  renderOptions(wsRefs.chapterSelect, projectChapters(), '', 'Nenhum capítulo');
  refs.chapterSelect.value = wsRefs.chapterSelect.value;
  wsRenderMeta();
  wsUpdateWordCount();
  wsRenderContext();
});

wsRefs.bookSelect.addEventListener('change', () => {
  refs.bookSelect.value = wsRefs.bookSelect.value;
  renderOptions(wsRefs.chapterSelect, projectChapters(), '', 'Nenhum capítulo');
  refs.chapterSelect.value = wsRefs.chapterSelect.value;
  wsRenderMeta();
  wsUpdateWordCount();
  wsRenderContext();
});

wsRefs.chapterSelect.addEventListener('change', () => {
  refs.chapterSelect.value = wsRefs.chapterSelect.value;
  wsRenderMeta();
  wsUpdateWordCount();
  wsRenderContext();
  wsSetAutosaveStatus('saved');
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !wsIsOpen) return;
  const active = document.activeElement;
  const isMetaInput =
    active &&
    active !== wsRefs.content &&
    (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.tagName === 'SELECT');
  if (isMetaInput) return;
  closeWriterStudio();
});

// =========== Character Canon Studio ===========

let csIsOpen = false;
let csSelectedRefId = null;
let csPendingFileDataUrl = null;
let csPendingFileBlob = null;
let csPendingFileName = '';

const csRefs = {
  overlay: $('canonStudio'),
  closeBtn: $('csCloseBtn'),
  characterSelect: $('csCharacterSelect'),
  saveCanonBtn: $('csSaveCanonBtn'),
  tabBtnVisual: $('csTabBtnVisual'),
  tabBtnRefs: $('csTabBtnRefs'),
  tabVisual: $('csTabVisual'),
  tabRefs: $('csTabRefs'),
  // Visual fields
  apparentAge: $('csApparentAge'),
  genderPresentation: $('csGenderPresentation'),
  skinTone: $('csSkinTone'),
  eyes: $('csEyes'),
  hair: $('csHair'),
  faceShape: $('csFaceShape'),
  bodyType: $('csBodyType'),
  marks: $('csMarks'),
  typicalClothing: $('csTypicalClothing'),
  accessories: $('csAccessories'),
  visualAesthetic: $('csVisualAesthetic'),
  colorPalette: $('csColorPalette'),
  periodStyle: $('csPeriodStyle'),
  dominantExpression: $('csDominantExpression'),
  presence: $('csPresence'),
  cinematicNotes: $('csCinematicNotes'),
  fixedTraits: $('csFixedTraits'),
  variableTraits: $('csVariableTraits'),
  consistencyRules: $('csConsistencyRules'),
  masterPrompt: $('csMasterPrompt'),
  negativePrompt: $('csNegativePrompt'),
  visualTags: $('csVisualTags'),
  // References
  refName: $('csRefName'),
  refType: $('csRefType'),
  refPreserve: $('csRefPreserve'),
  refMayVary: $('csRefMayVary'),
  refNotes: $('csRefNotes'),
  refIsCanonical: $('csRefIsCanonical'),
  refFileInput: $('csRefFileInput'),
  refPreview: $('csRefPreview'),
  addRefBtn: $('csAddRefBtn'),
  refGrid: $('csRefGrid'),
  refDetail: $('csRefDetail'),
  refDetailImg: $('csRefDetailImg'),
  refDetailName: $('csRefDetailName'),
  refDetailType: $('csRefDetailType'),
  refDetailPreserve: $('csRefDetailPreserve'),
  refDetailMayVary: $('csRefDetailMayVary'),
  refDetailNotes: $('csRefDetailNotes'),
  refDetailIsCanonical: $('csRefDetailIsCanonical'),
  refDetailSaveBtn: $('csRefDetailSaveBtn'),
  refDetailDeleteBtn: $('csRefDetailDeleteBtn')
};

const csCurrentCharacter = () =>
  state.characters.find((character) => character.id === csRefs.characterSelect.value);

const csProjectRefs = () =>
  state.referenceImages.filter(
    (ref) => ref.projectId === selectedProjectId() && ref.characterId === csRefs.characterSelect.value
  );

const csLoadVisualFields = () => {
  const character = csCurrentCharacter();
  if (!character) {
    csRefs.apparentAge.value = '';
    csRefs.genderPresentation.value = '';
    csRefs.skinTone.value = '';
    csRefs.eyes.value = '';
    csRefs.hair.value = '';
    csRefs.faceShape.value = '';
    csRefs.bodyType.value = '';
    csRefs.marks.value = '';
    csRefs.typicalClothing.value = '';
    csRefs.accessories.value = '';
    csRefs.visualAesthetic.value = '';
    csRefs.colorPalette.value = '';
    csRefs.periodStyle.value = '';
    csRefs.dominantExpression.value = '';
    csRefs.presence.value = '';
    csRefs.cinematicNotes.value = '';
    csRefs.fixedTraits.value = '';
    csRefs.variableTraits.value = '';
    csRefs.consistencyRules.value = '';
    csRefs.masterPrompt.value = '';
    csRefs.negativePrompt.value = '';
    csRefs.visualTags.value = '';
    return;
  }
  csRefs.apparentAge.value = character.apparentAge || '';
  csRefs.genderPresentation.value = character.genderPresentation || '';
  csRefs.skinTone.value = character.skinTone || '';
  csRefs.eyes.value = character.eyes || '';
  csRefs.hair.value = character.hair || '';
  csRefs.faceShape.value = character.faceShape || '';
  csRefs.bodyType.value = character.bodyType || '';
  csRefs.marks.value = character.marks || '';
  csRefs.typicalClothing.value = character.typicalClothing || '';
  csRefs.accessories.value = character.accessories || '';
  csRefs.visualAesthetic.value = character.visualAesthetic || '';
  csRefs.colorPalette.value = character.colorPalette || '';
  csRefs.periodStyle.value = character.periodStyle || '';
  csRefs.dominantExpression.value = character.dominantExpression || '';
  csRefs.presence.value = character.presence || '';
  csRefs.cinematicNotes.value = character.cinematicNotes || '';
  csRefs.fixedTraits.value = Array.isArray(character.fixedTraits) ? character.fixedTraits.join('\n') : '';
  csRefs.variableTraits.value = Array.isArray(character.variableTraits) ? character.variableTraits.join('\n') : '';
  csRefs.consistencyRules.value = Array.isArray(character.consistencyRules) ? character.consistencyRules.join('\n') : '';
  csRefs.masterPrompt.value = character.masterPrompt || '';
  csRefs.negativePrompt.value = character.negativePrompt || '';
  csRefs.visualTags.value = Array.isArray(character.visualTags) ? character.visualTags.join(', ') : '';
};

const csRenderRefGrid = () => {
  const refs = csProjectRefs();
  csRefs.refGrid.innerHTML = '';
  if (!refs.length) {
    const empty = document.createElement('p');
    empty.className = 'cs-ref-empty';
    empty.textContent = 'Nenhuma referência cadastrada para este personagem.';
    csRefs.refGrid.append(empty);
    return;
  }
  refs.forEach((ref) => {
    const thumb = document.createElement('div');
    thumb.className = `cs-ref-thumb${csSelectedRefId === ref.id ? ' selected' : ''}`;
    thumb.dataset.refId = ref.id;

    if (ref.dataUrl) {
      const img = document.createElement('img');
      img.src = ref.dataUrl;
      img.alt = ref.name;
      thumb.append(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--muted)';
      placeholder.textContent = '🖼';
      thumb.append(placeholder);
    }

    const info = document.createElement('span');
    info.className = 'cs-ref-thumb-info';
    info.textContent = ref.name;
    thumb.append(info);

    if (ref.isCanonical) {
      const badge = document.createElement('span');
      badge.className = 'cs-ref-thumb-canon';
      badge.textContent = 'Canon';
      thumb.append(badge);
    }

    thumb.addEventListener('click', () => csSelectRef(ref.id));
    csRefs.refGrid.append(thumb);
  });
};

const csSelectRef = (refId) => {
  csSelectedRefId = refId;
  const ref = state.referenceImages.find((r) => r.id === refId);
  if (!ref) {
    csRefs.refDetail.classList.add('cs-hidden');
    csRenderRefGrid();
    return;
  }
  csRefs.refDetailImg.src = ref.dataUrl || '';
  csRefs.refDetailImg.style.display = ref.dataUrl ? 'block' : 'none';
  csRefs.refDetailName.value = ref.name;
  csRefs.refDetailType.value = ref.type;
  csRefs.refDetailPreserve.value = ref.preserve;
  csRefs.refDetailMayVary.value = ref.mayVary;
  csRefs.refDetailNotes.value = ref.notes;
  csRefs.refDetailIsCanonical.checked = ref.isCanonical;
  csRefs.refDetail.classList.remove('cs-hidden');
  csRenderRefGrid();
};

const csResetRefForm = () => {
  csRefs.refName.value = '';
  csRefs.refType.value = REFERENCE_TYPES[0];
  csRefs.refPreserve.value = '';
  csRefs.refMayVary.value = '';
  csRefs.refNotes.value = '';
  csRefs.refIsCanonical.checked = false;
  csRefs.refFileInput.value = '';
  csRefs.refPreview.innerHTML = '';
  csPendingFileDataUrl = null;
  csPendingFileBlob = null;
  csPendingFileName = '';
};

const openCanonStudio = () => {
  const character = currentCharacter();
  if (!character) return;
  csIsOpen = true;
  renderOptions(csRefs.characterSelect, projectCharacters(), character.id, 'Nenhum personagem');
  csLoadVisualFields();
  csRenderRefGrid();
  csSelectedRefId = null;
  csRefs.refDetail.classList.add('cs-hidden');
  csRefs.overlay.classList.remove('cs-hidden');
  document.body.style.overflow = 'hidden';
};

const closeCanonStudio = () => {
  csIsOpen = false;
  csSelectedRefId = null;
  csRefs.overlay.classList.add('cs-hidden');
  document.body.style.overflow = '';
  render();
};

const csSwitchTab = (tab) => {
  const isVisual = tab === 'visual';
  csRefs.tabVisual.classList.toggle('cs-hidden', !isVisual);
  csRefs.tabRefs.classList.toggle('cs-hidden', isVisual);
  csRefs.tabBtnVisual.classList.toggle('cs-tab-active', isVisual);
  csRefs.tabBtnRefs.classList.toggle('cs-tab-active', !isVisual);
};

$('openCanonStudioBtn').addEventListener('click', openCanonStudio);

csRefs.closeBtn.addEventListener('click', closeCanonStudio);

csRefs.tabBtnVisual.addEventListener('click', () => csSwitchTab('visual'));
csRefs.tabBtnRefs.addEventListener('click', () => csSwitchTab('refs'));

csRefs.characterSelect.addEventListener('change', () => {
  refs.characterSelect.value = csRefs.characterSelect.value;
  csSelectedRefId = null;
  csLoadVisualFields();
  csRenderRefGrid();
  csRefs.refDetail.classList.add('cs-hidden');
});

csRefs.saveCanonBtn.addEventListener('click', () => {
  const character = csCurrentCharacter();
  if (!character) return;
  character.apparentAge = csRefs.apparentAge.value.trim();
  character.genderPresentation = csRefs.genderPresentation.value.trim();
  character.skinTone = csRefs.skinTone.value.trim();
  character.eyes = csRefs.eyes.value.trim();
  character.hair = csRefs.hair.value.trim();
  character.faceShape = csRefs.faceShape.value.trim();
  character.bodyType = csRefs.bodyType.value.trim();
  character.marks = csRefs.marks.value.trim();
  character.typicalClothing = csRefs.typicalClothing.value.trim();
  character.accessories = csRefs.accessories.value.trim();
  character.visualAesthetic = csRefs.visualAesthetic.value.trim();
  character.colorPalette = csRefs.colorPalette.value.trim();
  character.periodStyle = csRefs.periodStyle.value.trim();
  character.dominantExpression = csRefs.dominantExpression.value.trim();
  character.presence = csRefs.presence.value.trim();
  character.cinematicNotes = csRefs.cinematicNotes.value.trim();
  character.fixedTraits = parseLines(csRefs.fixedTraits.value);
  character.variableTraits = parseLines(csRefs.variableTraits.value);
  character.consistencyRules = parseLines(csRefs.consistencyRules.value);
  character.masterPrompt = csRefs.masterPrompt.value.trim();
  character.negativePrompt = csRefs.negativePrompt.value.trim();
  character.visualTags = parseTags(csRefs.visualTags.value);
  character.updatedAt = new Date().toISOString();
  state = store.save(state);
});

csRefs.refFileInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (!file) {
    csPendingFileDataUrl = null;
    csPendingFileBlob = null;
    csPendingFileName = '';
    csRefs.refPreview.innerHTML = '';
    return;
  }
  csPendingFileBlob = file;
  csPendingFileName = sanitizeFileName(file.name, 'reference');
  const reader = new FileReader();
  reader.onload = (e) => {
    csPendingFileDataUrl = e.target.result;
    csRefs.refPreview.innerHTML = `<img src="${csPendingFileDataUrl}" alt="preview" />`;
  };
  reader.readAsDataURL(file);
});

csRefs.addRefBtn.addEventListener('click', async () => {
  const name = csRefs.refName.value.trim();
  const character = csCurrentCharacter();
  if (!name || !character) return;
  const referenceDraft = createReferenceImage({
    projectId: selectedProjectId(),
    characterId: character.id,
    name,
    type: csRefs.refType.value,
    dataUrl: csPendingFileDataUrl || '',
    fileName: csPendingFileName,
    isCanonical: csRefs.refIsCanonical.checked,
    preserve: csRefs.refPreserve.value.trim(),
    mayVary: csRefs.refMayVary.value.trim(),
    notes: csRefs.refNotes.value.trim()
  });
  let localPath = '';
  if (csPendingFileBlob) {
    try {
      localPath = await saveReferenceFileToWorkspace({
        settings: state.settings,
        projectId: selectedProjectId(),
        referenceId: referenceDraft.id,
        blob: csPendingFileBlob,
        fileName: csPendingFileName
      });
    } catch (error) {
      console.warn('Falha ao salvar referência no workspace local:', error);
    }
  }
  const reference = { ...referenceDraft, localPath };

  state.referenceImages.push(reference);
  state = store.save(state);
  csResetRefForm();
  csRenderRefGrid();
});

csRefs.refDetailSaveBtn.addEventListener('click', () => {
  const ref = state.referenceImages.find((r) => r.id === csSelectedRefId);
  if (!ref) return;
  ref.name = csRefs.refDetailName.value.trim() || ref.name;
  ref.type = csRefs.refDetailType.value;
  ref.preserve = csRefs.refDetailPreserve.value.trim();
  ref.mayVary = csRefs.refDetailMayVary.value.trim();
  ref.notes = csRefs.refDetailNotes.value.trim();
  ref.isCanonical = csRefs.refDetailIsCanonical.checked;
  state = store.save(state);
  csRenderRefGrid();
});

csRefs.refDetailDeleteBtn.addEventListener('click', () => {
  const ref = state.referenceImages.find((r) => r.id === csSelectedRefId);
  if (!ref || !window.confirm(`Excluir a referência "${ref.name}"?`)) return;
  state = deleteEntity(state, 'referenceImage', csSelectedRefId);
  csSelectedRefId = null;
  csRefs.refDetail.classList.add('cs-hidden');
  csRenderRefGrid();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !csIsOpen) return;
  const active = document.activeElement;
  const isInput =
    active &&
    (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.tagName === 'SELECT');
  if (isInput) return;
  closeCanonStudio();
});

// =========== Prompt Builder ===========

let psIsOpen = false;

const psRefs = {
  overlay: $('promptStudio'),
  closeBtn: $('psCloseBtn'),
  promptSelect: $('psPromptSelect'),
  newPromptBtn: $('psNewPromptBtn'),
  duplicatePromptBtn: $('psDuplicatePromptBtn'),
  title: $('psTitle'),
  targetType: $('psTargetType'),
  promptMedium: $('psPromptMedium'),
  targetSelect: $('psTargetSelect'),
  stylePreset: $('psStylePreset'),
  cinematicPreset: $('psCinematicPreset'),
  lensLightingPreset: $('psLensLightingPreset'),
  emotionalTone: $('psEmotionalTone'),
  environment: $('psEnvironment'),
  lighting: $('psLighting'),
  composition: $('psComposition'),
  builderNotes: $('psBuilderNotes'),
  referenceList: $('psReferenceList'),
  preserve: $('psPreserve'),
  vary: $('psVary'),
  generateBtn: $('psGenerateBtn'),
  saveVersionBtn: $('psSaveVersionBtn'),
  favoriteBtn: $('psFavoriteBtn'),
  officialBtn: $('psOfficialBtn'),
  masterPrompt: $('psMasterPrompt'),
  negativePrompt: $('psNegativePrompt'),
  shortPrompt: $('psShortPrompt'),
  detailedPrompt: $('psDetailedPrompt'),
  scenePrompt: $('psScenePrompt'),
  cinematicPrompt: $('psCinematicPrompt'),
  variations: $('psVariations'),
  fixedChecklist: $('psFixedChecklist'),
  versionList: $('psVersionList'),
  exportTextBtn: $('psExportTextBtn'),
  exportJsonBtn: $('psExportJsonBtn'),
  exportPreview: $('psExportPreview')
};

const promptDocById = (id) => state.promptDocuments.find((promptDocument) => promptDocument.id === id);

const psCurrentDocument = () => promptDocById(psRefs.promptSelect.value || refs.promptDocumentSelect.value);

const psCurrentVersion = (promptDocument = psCurrentDocument()) =>
  promptDocument?.versions?.find((version) => version.id === promptDocument.activeVersionId) ||
  promptDocument?.versions?.[0] ||
  null;

const promptTargetLabel = (targetType, targetId) => {
  if (targetType === 'scene') {
    return state.scenes.find((scene) => scene.id === targetId)?.title || 'Cena';
  }
  return state.characters.find((character) => character.id === targetId)?.name || 'Personagem';
};

const promptTargetOptions = (targetType) => (targetType === 'scene' ? projectScenes() : projectCharacters());

const promptDefaultTitle = (targetType, targetId) => {
  const targetLabel = promptTargetLabel(targetType, targetId);
  return targetType === 'scene' ? `${targetLabel} · Prompt de cena` : `${targetLabel} · Prompt mestre`;
};

const promptReferenceCandidates = (targetType, targetId) => {
  const projectReferences = state.referenceImages.filter((reference) => reference.projectId === selectedProjectId());
  if (targetType === 'character') {
    return projectReferences.filter(
      (reference) => reference.characterId === targetId || (!reference.characterId && reference.type === 'character')
    );
  }

  const scene = state.scenes.find((entry) => entry.id === targetId);
  const chapter = state.chapters.find((entry) => entry.id === scene?.chapterId);
  const sceneCharacters = inferSceneCharactersFromContext(projectCharacters(), scene, chapter);
  const sceneCharacterIds = new Set(sceneCharacters.map((character) => character.id));
  return projectReferences.filter(
    (reference) =>
      sceneCharacterIds.has(reference.characterId) ||
      ['scene', 'place', 'aesthetic', 'lighting', 'object', 'pose', 'clothing'].includes(reference.type) ||
      reference.linkedEntityId === targetId
  );
};

const promptDefaultReferenceIds = (targetType, targetId) =>
  promptReferenceCandidates(targetType, targetId)
    .filter((reference) => reference.isCanonical || reference.characterId === targetId || reference.linkedEntityId === targetId)
    .map((reference) => reference.id);

const syncPromptSelectors = (promptId) => {
  refs.promptDocumentSelect.value = promptId || '';
  psRefs.promptSelect.value = promptId || '';
};

const createPromptFromContext = (preferredTargetType) => {
  const targetType =
    preferredTargetType ||
    (selectedSceneId() ? 'scene' : selectedCharacterId() ? 'character' : projectScenes().length ? 'scene' : 'character');
  const targetId =
    targetType === 'scene'
      ? selectedSceneId() || projectScenes()[0]?.id || ''
      : selectedCharacterId() || projectCharacters()[0]?.id || '';
  if (!selectedProjectId() || !targetId) return null;

  const promptDocument = createPromptDocument({
    projectId: selectedProjectId(),
    title: promptDefaultTitle(targetType, targetId),
    targetType,
    targetId,
    promptMedium: 'image',
    stylePreset: 'cinematic-realism',
    cinematicPreset: targetType === 'scene' ? 'wide-establishing' : 'portrait-intimate',
    lensLightingPreset: 'natural-soft',
    emotionalTone: currentProject()?.tone || '',
    environment:
      targetType === 'scene'
        ? state.scenes.find((scene) => scene.id === targetId)?.location || ''
        : '',
    referenceIds: promptDefaultReferenceIds(targetType, targetId)
  });
  state.promptDocuments.push(promptDocument);
  state = store.save(state);
  syncPromptSelectors(promptDocument.id);
  render();
  return promptDocument;
};

const psRenderPresetOptions = () => {
  renderOptions(
    psRefs.stylePreset,
    PROMPT_STYLE_PRESETS.map((preset) => ({ ...preset, name: preset.label })),
    psRefs.stylePreset.value || PROMPT_STYLE_PRESETS[0].id,
    'Nenhum preset'
  );
  renderOptions(
    psRefs.cinematicPreset,
    PROMPT_CINEMATIC_PRESETS.map((preset) => ({ ...preset, name: preset.label })),
    psRefs.cinematicPreset.value || PROMPT_CINEMATIC_PRESETS[0].id,
    'Nenhum preset'
  );
  renderOptions(
    psRefs.lensLightingPreset,
    PROMPT_LENS_LIGHT_PRESETS.map((preset) => ({ ...preset, name: preset.label })),
    psRefs.lensLightingPreset.value || PROMPT_LENS_LIGHT_PRESETS[0].id,
    'Nenhum preset'
  );
};

const psRenderDocumentOptions = (selectedId) => {
  renderOptions(
    psRefs.promptSelect,
    projectPromptDocuments().map((promptDocument) => ({
      ...promptDocument,
      name: `${promptDocument.isOfficial ? '✓ ' : ''}${promptDocument.isFavorite ? '★ ' : ''}${promptDocument.title}`
    })),
    selectedId || currentPromptDocument()?.id,
    'Nenhum prompt estruturado'
  );
};

const psRenderTargetOptions = (targetType, selectedId) => {
  renderOptions(
    psRefs.targetSelect,
    promptTargetOptions(targetType),
    selectedId,
    targetType === 'scene' ? 'Nenhuma cena' : 'Nenhum personagem'
  );
};

const psRenderReferenceOptions = (promptDocument) => {
  const targetType = psRefs.targetType.value;
  const targetId = psRefs.targetSelect.value;
  const selectedReferenceIds = new Set(promptDocument?.referenceIds || []);
  const candidates = promptReferenceCandidates(targetType, targetId);
  psRefs.referenceList.innerHTML = '';
  if (!candidates.length) {
    psRefs.referenceList.textContent = 'Nenhuma referência aplicável encontrada neste projeto.';
    return;
  }

  candidates.forEach((reference) => {
    const label = document.createElement('label');
    label.className = 'ps-reference-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = reference.id;
    checkbox.checked = selectedReferenceIds.has(reference.id);
    const text = document.createElement('span');
    const badges = [
      reference.isCanonical ? 'canon' : '',
      reference.type ? `tipo ${reference.type}` : ''
    ]
      .filter(Boolean)
      .join(' · ');
    const title = document.createElement('strong');
    title.textContent = reference.name || 'Referência sem nome';
    const meta = document.createElement('small');
    meta.textContent = badges || 'referência visual';
    const rules = document.createElement('small');
    rules.textContent = `Preservar: ${reference.preserve || '—'} | Variar: ${reference.mayVary || '—'}`;
    text.append(title, meta, rules);
    label.append(checkbox, text);
    psRefs.referenceList.append(label);
  });
};

const psRenderVersionList = (promptDocument) => {
  psRefs.versionList.innerHTML = '';
  const versions = promptDocument?.versions || [];
  if (!versions.length) {
    psRefs.versionList.textContent = 'Nenhuma versão salva.';
    return;
  }
  versions
    .slice()
    .reverse()
    .forEach((version) => {
      const button = document.createElement('button');
      button.className = `ps-version-btn${version.id === promptDocument.activeVersionId ? ' active' : ''}`;
      button.textContent = `${version.label} · ${new Date(version.createdAt).toLocaleString('pt-BR')}`;
      button.addEventListener('click', () => {
        const documentToUpdate = psCurrentDocument();
        if (!documentToUpdate) return;
        documentToUpdate.activeVersionId = version.id;
        documentToUpdate.updatedAt = new Date().toISOString();
        state = store.save(state);
        psLoadDocument(documentToUpdate.id);
      });
      psRefs.versionList.append(button);
    });
};

const psApplyVersionToFields = (version) => {
  psRefs.preserve.value = Array.isArray(version?.preserve) ? version.preserve.join('\n') : '';
  psRefs.vary.value = Array.isArray(version?.vary) ? version.vary.join('\n') : '';
  psRefs.masterPrompt.value = version?.masterPrompt || '';
  psRefs.negativePrompt.value = version?.negativePrompt || '';
  psRefs.shortPrompt.value = version?.shortPrompt || '';
  psRefs.detailedPrompt.value = version?.detailedPrompt || '';
  psRefs.scenePrompt.value = version?.scenePrompt || '';
  psRefs.cinematicPrompt.value = version?.cinematicPrompt || '';
  psRefs.variations.value = Array.isArray(version?.variations) ? version.variations.join('\n') : '';
  psRefs.fixedChecklist.value = Array.isArray(version?.fixedChecklist) ? version.fixedChecklist.join('\n') : '';
};

const psLoadDocument = (promptId) => {
  const promptDocument = promptDocById(promptId) || currentPromptDocument();
  if (!promptDocument) return;
  syncPromptSelectors(promptDocument.id);
  psRenderDocumentOptions(promptDocument.id);
  psRefs.title.value = promptDocument.title || '';
  psRefs.targetType.value = promptDocument.targetType || 'character';
  psRefs.promptMedium.value = promptDocument.promptMedium || 'image';
  psRenderTargetOptions(psRefs.targetType.value, promptDocument.targetId);
  psRenderPresetOptions();
  psRefs.stylePreset.value = promptDocument.stylePreset || PROMPT_STYLE_PRESETS[0].id;
  psRefs.cinematicPreset.value = promptDocument.cinematicPreset || PROMPT_CINEMATIC_PRESETS[0].id;
  psRefs.lensLightingPreset.value = promptDocument.lensLightingPreset || PROMPT_LENS_LIGHT_PRESETS[0].id;
  psRefs.emotionalTone.value = promptDocument.emotionalTone || '';
  psRefs.environment.value = promptDocument.environment || '';
  psRefs.lighting.value = promptDocument.lighting || '';
  psRefs.composition.value = promptDocument.composition || '';
  psRefs.builderNotes.value = promptDocument.notes || '';
  psRenderReferenceOptions(promptDocument);
  psRenderVersionList(promptDocument);
  psApplyVersionToFields(psCurrentVersion(promptDocument));
  psRefs.favoriteBtn.textContent = promptDocument.isFavorite ? '★ Favorito' : '☆ Favorito';
  psRefs.officialBtn.textContent = promptDocument.isOfficial ? '✓ Oficial' : 'Oficial';
  const previewText = psRefs.scenePrompt.value || psRefs.masterPrompt.value || 'Selecione ou gere um prompt para exportar.';
  psRefs.exportPreview.textContent = previewText;
};

const psSelectedReferenceIds = () =>
  Array.from(psRefs.referenceList.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);

const psSyncDocumentFields = (promptDocument) => {
  if (!promptDocument) return null;
  promptDocument.title = psRefs.title.value.trim() || promptDocument.title;
  promptDocument.targetType = psRefs.targetType.value;
  promptDocument.targetId = psRefs.targetSelect.value;
  promptDocument.promptMedium = psRefs.promptMedium.value;
  promptDocument.stylePreset = psRefs.stylePreset.value;
  promptDocument.cinematicPreset = psRefs.cinematicPreset.value;
  promptDocument.lensLightingPreset = psRefs.lensLightingPreset.value;
  promptDocument.emotionalTone = psRefs.emotionalTone.value.trim();
  promptDocument.environment = psRefs.environment.value.trim();
  promptDocument.lighting = psRefs.lighting.value.trim();
  promptDocument.composition = psRefs.composition.value.trim();
  promptDocument.notes = psRefs.builderNotes.value.trim();
  promptDocument.referenceIds = psSelectedReferenceIds();
  promptDocument.updatedAt = new Date().toISOString();
  return promptDocument;
};

const psSnapshotVersionFields = (label, source) => ({
  id: newClientId(),
  label,
  source,
  preserve: parseLines(psRefs.preserve.value),
  vary: parseLines(psRefs.vary.value),
  masterPrompt: psRefs.masterPrompt.value.trim(),
  negativePrompt: psRefs.negativePrompt.value.trim(),
  shortPrompt: psRefs.shortPrompt.value.trim(),
  detailedPrompt: psRefs.detailedPrompt.value.trim(),
  scenePrompt: psRefs.scenePrompt.value.trim(),
  cinematicPrompt: psRefs.cinematicPrompt.value.trim(),
  variations: parseLines(psRefs.variations.value),
  fixedChecklist: parseLines(psRefs.fixedChecklist.value),
  notes: psRefs.builderNotes.value.trim(),
  createdAt: new Date().toISOString()
});

const psBuildPackForDocument = (promptDocument) => {
  const references = state.referenceImages.filter((reference) => promptDocument.referenceIds.includes(reference.id));
  if (promptDocument.targetType === 'scene') {
    const scene = state.scenes.find((entry) => entry.id === promptDocument.targetId);
    const chapter = state.chapters.find((entry) => entry.id === scene?.chapterId);
    return buildScenePromptPack({
      projectTone: currentProject()?.tone,
      scene,
      chapter,
      characters: projectCharacters(),
      loreEntries: projectLore(),
      references,
      promptMedium: promptDocument.promptMedium,
      preserve: parseLines(psRefs.preserve.value),
      vary: parseLines(psRefs.vary.value),
      stylePreset: promptDocument.stylePreset,
      cinematicPreset: promptDocument.cinematicPreset,
      lensLightingPreset: promptDocument.lensLightingPreset,
      emotionalTone: promptDocument.emotionalTone,
      environment: promptDocument.environment,
      lighting: promptDocument.lighting,
      composition: promptDocument.composition
    });
  }

  const character = state.characters.find((entry) => entry.id === promptDocument.targetId);
  return buildCharacterPromptPack({
    character,
    projectTone: currentProject()?.tone,
    references,
    promptMedium: promptDocument.promptMedium,
    preserve: parseLines(psRefs.preserve.value),
    vary: parseLines(psRefs.vary.value),
    stylePreset: promptDocument.stylePreset,
    cinematicPreset: promptDocument.cinematicPreset,
    lensLightingPreset: promptDocument.lensLightingPreset
  });
};

const psApplyPackToFields = (pack) => {
  psRefs.masterPrompt.value = pack.masterPrompt || '';
  psRefs.negativePrompt.value = pack.negativePrompt || '';
  psRefs.shortPrompt.value = pack.shortPrompt || '';
  psRefs.detailedPrompt.value = pack.detailedPrompt || '';
  psRefs.scenePrompt.value = pack.scenePrompt || '';
  psRefs.cinematicPrompt.value = pack.cinematicPrompt || '';
  psRefs.variations.value = Array.isArray(pack.variations) ? pack.variations.join('\n') : '';
  psRefs.fixedChecklist.value = Array.isArray(pack.fixedChecklist) ? pack.fixedChecklist.join('\n') : '';
  psRefs.exportPreview.textContent = psRefs.scenePrompt.value || psRefs.masterPrompt.value || 'Selecione ou gere um prompt para exportar.';
};

const psOpenStudio = (preferredTargetType) => {
  if (!selectedProjectId()) return;
  psIsOpen = true;
  psRenderPresetOptions();
  let promptDocument = currentPromptDocument();
  if (!promptDocument) {
    promptDocument = createPromptFromContext(preferredTargetType);
  }
  psRefs.overlay.classList.remove('ps-hidden');
  document.body.style.overflow = 'hidden';
  if (promptDocument) {
    psLoadDocument(promptDocument.id);
  }
};

const psCloseStudio = () => {
  psIsOpen = false;
  psRefs.overlay.classList.add('ps-hidden');
  document.body.style.overflow = '';
  render();
};

const exportPromptPayload = () => {
  const promptDocument = psCurrentDocument();
  if (!promptDocument) return null;
  const syncedDocument = psSyncDocumentFields(promptDocument);
  const activeVersion = psSnapshotVersionFields(
    psCurrentVersion(promptDocument)?.label || `Versão ${promptDocument.versions.length}`,
    psCurrentVersion(promptDocument)?.source || 'manual'
  );
  return {
    ...syncedDocument,
    targetLabel: promptTargetLabel(syncedDocument.targetType, syncedDocument.targetId),
    activeVersion
  };
};

const downloadFile = (filename, content, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const exportPromptText = (payload) =>
  [
    `# ${payload.title}`,
    '',
    `tipo: ${payload.targetType}`,
    `alvo: ${payload.targetLabel}`,
    `saída: ${payload.promptMedium}`,
    `favorito: ${payload.isFavorite ? 'sim' : 'não'}`,
    `oficial: ${payload.isOfficial ? 'sim' : 'não'}`,
    '',
    '## preservar',
    ...(payload.activeVersion.preserve.length ? payload.activeVersion.preserve.map((entry) => `- ${entry}`) : ['- —']),
    '',
    '## variar',
    ...(payload.activeVersion.vary.length ? payload.activeVersion.vary.map((entry) => `- ${entry}`) : ['- —']),
    '',
    '## prompt mestre',
    payload.activeVersion.masterPrompt || '—',
    '',
    '## negative prompt',
    payload.activeVersion.negativePrompt || '—',
    '',
    '## versão curta',
    payload.activeVersion.shortPrompt || '—',
    '',
    '## versão detalhada',
    payload.activeVersion.detailedPrompt || '—',
    '',
    '## prompt visual da cena',
    payload.activeVersion.scenePrompt || '—',
    '',
    '## prompt cinematográfico',
    payload.activeVersion.cinematicPrompt || '—',
    '',
    '## variações',
    ...(payload.activeVersion.variations.length ? payload.activeVersion.variations.map((entry) => `- ${entry}`) : ['- —']),
    '',
    '## checklist fixo',
    ...(payload.activeVersion.fixedChecklist.length ? payload.activeVersion.fixedChecklist.map((entry) => `- ${entry}`) : ['- —'])
  ].join('\n');

$('openPromptStudioBtn').addEventListener('click', () => psOpenStudio());
$('openPromptStudioFromCharacterBtn').addEventListener('click', () => psOpenStudio('character'));
$('openPromptStudioFromSceneBtn').addEventListener('click', () => psOpenStudio('scene'));
$('createPromptDocumentBtn').addEventListener('click', () => {
  const promptDocument = createPromptFromContext();
  if (promptDocument) {
    psOpenStudio(promptDocument.targetType);
  }
});

refs.promptDocumentSelect.addEventListener('change', () => {
  syncPromptSelectors(refs.promptDocumentSelect.value);
  renderPromptEditor();
});

psRefs.closeBtn.addEventListener('click', psCloseStudio);

psRefs.promptSelect.addEventListener('change', () => {
  syncPromptSelectors(psRefs.promptSelect.value);
  psLoadDocument(psRefs.promptSelect.value);
});

psRefs.targetType.addEventListener('change', () => {
  const targetType = psRefs.targetType.value;
  const firstTargetId = promptTargetOptions(targetType)[0]?.id || '';
  psRenderTargetOptions(targetType, firstTargetId);
  const currentDocument = psCurrentDocument();
  if (currentDocument && !currentDocument.referenceIds.length) {
    currentDocument.referenceIds = promptDefaultReferenceIds(targetType, firstTargetId);
  }
  psRenderReferenceOptions(currentDocument);
  psRefs.title.value = promptDefaultTitle(targetType, firstTargetId);
});

psRefs.targetSelect.addEventListener('change', () => {
  const currentDocument = psCurrentDocument();
  if (currentDocument && !currentDocument.referenceIds.length) {
    currentDocument.referenceIds = promptDefaultReferenceIds(psRefs.targetType.value, psRefs.targetSelect.value);
  }
  psRenderReferenceOptions(currentDocument);
  if (!psRefs.title.value.trim()) {
    psRefs.title.value = promptDefaultTitle(psRefs.targetType.value, psRefs.targetSelect.value);
  }
});

psRefs.newPromptBtn.addEventListener('click', () => {
  const promptDocument = createPromptFromContext(psRefs.targetType.value);
  if (promptDocument) {
    psLoadDocument(promptDocument.id);
  }
});

psRefs.duplicatePromptBtn.addEventListener('click', () => {
  const promptDocument = psCurrentDocument();
  const version = psCurrentVersion(promptDocument);
  if (!promptDocument || !version) return;
  const duplicate = createPromptDocument({
    projectId: promptDocument.projectId,
    title: `${promptDocument.title} (cópia)`,
    targetType: promptDocument.targetType,
    targetId: promptDocument.targetId,
    promptMedium: promptDocument.promptMedium,
    stylePreset: promptDocument.stylePreset,
    cinematicPreset: promptDocument.cinematicPreset,
    lensLightingPreset: promptDocument.lensLightingPreset,
    emotionalTone: promptDocument.emotionalTone,
    environment: promptDocument.environment,
    lighting: promptDocument.lighting,
    composition: promptDocument.composition,
    notes: promptDocument.notes,
    referenceIds: [...promptDocument.referenceIds],
    versions: [
      {
        ...version,
        id: newClientId(),
        label: 'Versão inicial (duplicada)',
        createdAt: new Date().toISOString()
      }
    ]
  });
  state.promptDocuments.push(duplicate);
  state = store.save(state);
  syncPromptSelectors(duplicate.id);
  psLoadDocument(duplicate.id);
  render();
});

psRefs.generateBtn.addEventListener('click', () => {
  const promptDocument = psSyncDocumentFields(psCurrentDocument());
  if (!promptDocument) return;
  const pack = psBuildPackForDocument(promptDocument);
  psApplyPackToFields(pack);
  const version = psSnapshotVersionFields(`Versão ${promptDocument.versions.length + 1} · gerada`, 'generated');
  promptDocument.versions.push(version);
  promptDocument.activeVersionId = version.id;
  promptDocument.updatedAt = new Date().toISOString();
  state = store.save(state);
  psLoadDocument(promptDocument.id);
  render();
});

psRefs.saveVersionBtn.addEventListener('click', () => {
  const promptDocument = psSyncDocumentFields(psCurrentDocument());
  if (!promptDocument) return;
  const version = psSnapshotVersionFields(`Versão ${promptDocument.versions.length + 1} · manual`, 'manual');
  promptDocument.versions.push(version);
  promptDocument.activeVersionId = version.id;
  promptDocument.updatedAt = new Date().toISOString();
  state = store.save(state);
  psLoadDocument(promptDocument.id);
  render();
});

psRefs.favoriteBtn.addEventListener('click', () => {
  const promptDocument = psSyncDocumentFields(psCurrentDocument());
  if (!promptDocument) return;
  promptDocument.isFavorite = !promptDocument.isFavorite;
  promptDocument.updatedAt = new Date().toISOString();
  state = store.save(state);
  psLoadDocument(promptDocument.id);
  render();
});

psRefs.officialBtn.addEventListener('click', () => {
  const promptDocument = psSyncDocumentFields(psCurrentDocument());
  if (!promptDocument) return;
  promptDocument.isOfficial = !promptDocument.isOfficial;
  promptDocument.updatedAt = new Date().toISOString();
  state = store.save(state);
  psLoadDocument(promptDocument.id);
  render();
});

psRefs.exportTextBtn.addEventListener('click', () => {
  const payload = exportPromptPayload();
  if (!payload) return;
  const filename = `${sanitizeFilename(payload.title)}.txt`;
  const content = exportPromptText(payload);
  downloadFile(filename, content, 'text/plain');
  saveExportToWorkspace({ settings: state.settings, filename, content })
    .then((savedPath) => {
      if (savedPath) setWorkspaceStatus(`Exportação salva em workspace local: ${savedPath}`);
    })
    .catch((error) => {
      console.warn('Falha ao salvar exportação de prompt no workspace local:', error);
    });
});

psRefs.exportJsonBtn.addEventListener('click', () => {
  const payload = exportPromptPayload();
  if (!payload) return;
  const filename = `${sanitizeFilename(payload.title)}.json`;
  const content = JSON.stringify(payload, null, 2);
  downloadFile(filename, content, 'application/json');
  saveExportToWorkspace({ settings: state.settings, filename, content })
    .then((savedPath) => {
      if (savedPath) setWorkspaceStatus(`Exportação salva em workspace local: ${savedPath}`);
    })
    .catch((error) => {
      console.warn('Falha ao salvar exportação JSON no workspace local:', error);
    });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !psIsOpen) return;
  const active = document.activeElement;
  const isInput =
    active &&
    (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.tagName === 'SELECT');
  if (isInput) return;
  psCloseStudio();
});

render();

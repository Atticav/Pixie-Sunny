import {
  createAsset,
  createBook,
  createChapter,
  createCharacter,
  createLoreEntry,
  createProject,
  createReferenceImage,
  createScene,
  deleteEntity,
  REFERENCE_TYPES,
  UNASSIGNED_CHAPTER_ID
} from './models.js';
import { createStore, sanitizeState } from './store.js';
import { buildSceneSpec, buildVideoSpec, searchLore, suggestNextParagraph } from './assistant.js';

const store = createStore();
let state = store.load();

const $ = (id) => document.getElementById(id);

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
  videoSpec: $('videoSpec')
};

const parseTextList = (value, separator) =>
  (typeof value === 'string' ? value : '')
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseLines = (value) => parseTextList(value, '\n');

const parseTags = (value) => parseTextList(value, ',');

const selectedProjectId = () => refs.projectSelect.value;

const selectedBookId = () => refs.bookSelect.value;

const selectedChapterId = () => refs.chapterSelect.value;

const selectedCharacterId = () => refs.characterSelect.value;

const selectedLoreId = () => refs.loreSelect.value;

const selectedSceneId = () => refs.sceneSelect.value;

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

  renderProjectEditor();
  renderBookEditor();
  renderChapterEditor();
  renderCharacterEditor();
  renderLoreEditor();
  renderSceneEditor();
  renderLore();
  renderAssets();

  setDisabled(['createBookBtn', 'createCharacterBtn', 'createLoreBtn', 'createSceneBtn', 'saveAssetBtn'], !selectedProjectId());
  setDisabled(['openCanonStudioBtn'], !selectedCharacterId() || !selectedProjectId());
};

const persist = () => {
  state = store.save(state);
  render();
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

$('exportDataBtn').addEventListener('click', () => {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pixie-sunny-studio-backup.json';
  a.click();
  URL.revokeObjectURL(url);
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
    csRefs.refPreview.innerHTML = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    csPendingFileDataUrl = e.target.result;
    csRefs.refPreview.innerHTML = `<img src="${csPendingFileDataUrl}" alt="preview" />`;
  };
  reader.readAsDataURL(file);
});

csRefs.addRefBtn.addEventListener('click', () => {
  const name = csRefs.refName.value.trim();
  const character = csCurrentCharacter();
  if (!name || !character) return;

  state.referenceImages.push(
    createReferenceImage({
      projectId: selectedProjectId(),
      characterId: character.id,
      name,
      type: csRefs.refType.value,
      dataUrl: csPendingFileDataUrl || '',
      isCanonical: csRefs.refIsCanonical.checked,
      preserve: csRefs.refPreserve.value.trim(),
      mayVary: csRefs.refMayVary.value.trim(),
      notes: csRefs.refNotes.value.trim()
    })
  );
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

render();

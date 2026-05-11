import {
  createAsset,
  createBook,
  createChapter,
  createCharacter,
  createLoreEntry,
  createProject,
  createScene
} from './models.js';
import { createStore } from './store.js';
import { buildSceneSpec, buildVideoSpec, searchLore, suggestNextParagraph } from './assistant.js';

const store = createStore();
let state = store.load();

const $ = (id) => document.getElementById(id);

const refs = {
  projectSelect: $('projectSelect'),
  bookSelect: $('bookSelect'),
  chapterSelect: $('chapterSelect'),
  characterSelect: $('characterSelect'),
  sceneSelect: $('sceneSelect'),
  loreList: $('loreList'),
  assetList: $('assetList')
};

const selectedProjectId = () => refs.projectSelect.value;

const selectedBookId = () => refs.bookSelect.value;

const selectedChapterId = () => refs.chapterSelect.value;

const renderOptions = (select, options, selectedId) => {
  select.innerHTML = '';
  options.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name || item.title;
    if (selectedId && selectedId === item.id) option.selected = true;
    select.append(option);
  });
};

const currentProject = () => state.projects.find((project) => project.id === selectedProjectId());

const projectBooks = () => state.books.filter((book) => book.projectId === selectedProjectId());

const projectChapters = () =>
  state.chapters.filter(
    (chapter) => chapter.projectId === selectedProjectId() && chapter.bookId === selectedBookId()
  );

const projectCharacters = () => state.characters.filter((character) => character.projectId === selectedProjectId());

const projectLore = () => state.loreEntries.filter((entry) => entry.projectId === selectedProjectId());

const projectScenes = () => state.scenes.filter((scene) => scene.projectId === selectedProjectId());

const projectAssets = () => state.assets.filter((asset) => asset.projectId === selectedProjectId());

const renderLore = () => {
  const query = $('loreSearch').value;
  const entries = searchLore(projectLore(), query);
  refs.loreList.innerHTML = '';
  entries.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = `${entry.title}: ${entry.content}`;
    refs.loreList.append(li);
  });
};

const renderAssets = () => {
  refs.assetList.innerHTML = '';
  projectAssets().forEach((asset) => {
    const li = document.createElement('li');
    li.textContent = `${asset.type} · ${asset.name} · ${asset.path}`;
    refs.assetList.append(li);
  });
};

const render = () => {
  if (!state.projects.length) {
    const seedProject = createProject({
      name: 'Meu Universo',
      tone: 'fantasia sombria cinematográfica, tons frios e textura realista'
    });
    state.projects.push(seedProject);
    store.save(state);
  }

  renderOptions(refs.projectSelect, state.projects, selectedProjectId() || state.projects[0].id);

  const books = projectBooks();
  renderOptions(refs.bookSelect, books, selectedBookId() || books[0]?.id);

  const chapters = projectChapters();
  renderOptions(refs.chapterSelect, chapters, selectedChapterId() || chapters[0]?.id);

  const chars = projectCharacters();
  renderOptions(refs.characterSelect, chars, refs.characterSelect.value || chars[0]?.id);

  const scenes = projectScenes();
  renderOptions(refs.sceneSelect, scenes, refs.sceneSelect.value || scenes[0]?.id);

  const chapter = state.chapters.find((item) => item.id === selectedChapterId());
  $('chapterContent').value = chapter?.content || '';

  const selectedCharacter = chars.find((item) => item.id === refs.characterSelect.value);
  $('characterPreview').textContent = selectedCharacter
    ? JSON.stringify(selectedCharacter, null, 2)
    : 'Sem personagem selecionado.';

  renderLore();
  renderAssets();
};

const persist = () => {
  store.save(state);
  render();
};

$('createProjectBtn').addEventListener('click', () => {
  const name = $('newProjectName').value.trim();
  const tone = $('newProjectTone').value.trim();
  if (!name) return;
  state.projects.push(createProject({ name, tone }));
  $('newProjectName').value = '';
  $('newProjectTone').value = '';
  persist();
});

$('projectSelect').addEventListener('change', render);
$('bookSelect').addEventListener('change', render);
$('chapterSelect').addEventListener('change', render);
$('characterSelect').addEventListener('change', render);
$('sceneSelect').addEventListener('change', render);
$('loreSearch').addEventListener('input', renderLore);

$('createBookBtn').addEventListener('click', () => {
  const title = $('newBookTitle').value.trim();
  if (!title || !selectedProjectId()) return;
  state.books.push(createBook({ projectId: selectedProjectId(), title }));
  $('newBookTitle').value = '';
  persist();
});

$('createChapterBtn').addEventListener('click', () => {
  const title = $('newChapterTitle').value.trim();
  if (!title || !selectedProjectId() || !selectedBookId()) return;
  state.chapters.push(
    createChapter({
      projectId: selectedProjectId(),
      bookId: selectedBookId(),
      title,
      content: ''
    })
  );
  $('newChapterTitle').value = '';
  persist();
});

$('saveChapterBtn').addEventListener('click', () => {
  const chapterId = selectedChapterId();
  const chapter = state.chapters.find((entry) => entry.id === chapterId);
  if (!chapter) return;
  chapter.content = $('chapterContent').value;
  chapter.updatedAt = new Date().toISOString();
  persist();
});

$('suggestTextBtn').addEventListener('click', () => {
  const chapter = state.chapters.find((entry) => entry.id === selectedChapterId());
  if (!chapter) return;
  $('writingSuggestion').textContent = suggestNextParagraph({
    chapterContent: chapter.content,
    chapterTitle: chapter.title,
    loreEntries: projectLore(),
    characters: projectCharacters()
  });
});

$('createCharacterBtn').addEventListener('click', () => {
  const name = $('newCharacterName').value.trim();
  if (!name || !selectedProjectId()) return;
  const canonTraits = $('newCharacterCanon').value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  state.characters.push(
    createCharacter({
      projectId: selectedProjectId(),
      name,
      canonTraits,
      masterPrompt: $('newCharacterPrompt').value.trim(),
      negativePrompt: $('newCharacterNegativePrompt').value.trim()
    })
  );
  $('newCharacterName').value = '';
  $('newCharacterCanon').value = '';
  $('newCharacterPrompt').value = '';
  $('newCharacterNegativePrompt').value = '';
  persist();
});

$('createLoreBtn').addEventListener('click', () => {
  const title = $('newLoreTitle').value.trim();
  const content = $('newLoreContent').value.trim();
  if (!title || !content || !selectedProjectId()) return;
  state.loreEntries.push(createLoreEntry({ projectId: selectedProjectId(), title, content }));
  $('newLoreTitle').value = '';
  $('newLoreContent').value = '';
  persist();
});

$('createSceneBtn').addEventListener('click', () => {
  const title = $('newSceneTitle').value.trim();
  const description = $('newSceneDescription').value.trim();
  if (!title || !description || !selectedProjectId()) return;
  state.scenes.push(
    createScene({
      projectId: selectedProjectId(),
      chapterId: selectedChapterId(),
      title,
      description
    })
  );
  $('newSceneTitle').value = '';
  $('newSceneDescription').value = '';
  persist();
});

$('generateSceneSpecBtn').addEventListener('click', () => {
  const scene = projectScenes().find((item) => item.id === refs.sceneSelect.value);
  if (!scene) return;
  const spec = buildSceneSpec({
    projectTone: currentProject()?.tone,
    scene,
    characters: projectCharacters()
  });
  $('sceneSpec').textContent = JSON.stringify(spec, null, 2);
});

$('saveAssetBtn').addEventListener('click', () => {
  const name = $('assetName').value.trim();
  const type = $('assetType').value.trim() || 'ref';
  const path = $('assetPath').value.trim();
  if (!name || !path || !selectedProjectId()) return;
  state.assets.push(createAsset({ projectId: selectedProjectId(), name, type, path }));
  $('assetName').value = '';
  $('assetType').value = '';
  $('assetPath').value = '';
  persist();
});

$('generateVideoSpecBtn').addEventListener('click', () => {
  const scene = projectScenes().find((item) => item.id === refs.sceneSelect.value);
  const imageAsset = projectAssets().find((asset) => asset.type.toLowerCase() === 'image');
  const spec = buildVideoSpec({
    scene,
    imageAsset,
    projectTone: currentProject()?.tone
  });
  $('videoSpec').textContent = JSON.stringify(spec, null, 2);
});

$('exportDataBtn').addEventListener('click', () => {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pixie-sunny-local-backup.json';
  a.click();
  URL.revokeObjectURL(url);
});

$('importDataInput').addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const content = await file.text();
  try {
    const imported = JSON.parse(content);
    state = { ...state, ...imported };
    persist();
  } catch {
    alert('JSON inválido.');
  }
});

render();

import {
  createAsset,
  createBeat,
  createBook,
  createCanonPromotion,
  createDecisionEvent,
  createChapter,
  createCharacter,
  createGenerationJob,
  createGenerationOutput,
  createLoreEntry,
  createPromptDocument,
  createProject,
  createReferenceImage,
  createScene,
  createShot,
  deleteEntity,
  CANON_PROMOTION_TYPES,
  DECISION_RESULT_STATUSES,
  DECISION_SCOPE_TYPES,
  DECISION_TYPES,
  IMAGE_GEN_PROVIDER_TYPES,
  IMAGE_GEN_TYPES,
  OUTPUT_REVIEW_STATUSES,
  REFERENCE_TYPES,
  SHOT_STATUSES,
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
import { buildAssistivePlanningBundle } from './assistive-planning.js';
import {
  initializeLocalWorkspace,
  localWorkspaceSupported,
  localWorkspaceSummary,
  mirrorProjectStateToWorkspace,
  saveExportToWorkspace,
  saveReferenceFileToWorkspace
} from './local-workspace.js';
import { runImageGeneration } from './pipelines.js';

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
  shotFilterChapter: $('shotFilterChapter'),
  shotFilterScene: $('shotFilterScene'),
  shotFilterCharacter: $('shotFilterCharacter'),
  shotFilterStatus: $('shotFilterStatus'),
  shotFilterType: $('shotFilterType'),
  shotBeatSelect: $('shotBeatSelect'),
  beatTitleInput: $('beatTitleInput'),
  beatSummaryInput: $('beatSummaryInput'),
  shotTemplateSelect: $('shotTemplateSelect'),
  shotLanguagePresetSelect: $('shotLanguagePresetSelect'),
  shotSelect: $('shotSelect'),
  shotTimeline: $('shotTimeline'),
  shotTitleInput: $('shotTitleInput'),
  shotStatusSelect: $('shotStatusSelect'),
  shotTypeInput: $('shotTypeInput'),
  shotAngleInput: $('shotAngleInput'),
  shotCameraMovementInput: $('shotCameraMovementInput'),
  shotFocusCharacterSelect: $('shotFocusCharacterSelect'),
  shotDominantEmotionInput: $('shotDominantEmotionInput'),
  shotEnvironmentInput: $('shotEnvironmentInput'),
  shotNarrativeObjectiveInput: $('shotNarrativeObjectiveInput'),
  shotPacingIntensityInput: $('shotPacingIntensityInput'),
  shotVisualProgressionInput: $('shotVisualProgressionInput'),
  shotNarrativeProgressionInput: $('shotNarrativeProgressionInput'),
  shotDirectorNotes: $('shotDirectorNotes'),
  shotPromptLinks: $('shotPromptLinks'),
  shotOutputLinks: $('shotOutputLinks'),
  shotVideoLinks: $('shotVideoLinks'),
  shotReferenceLinks: $('shotReferenceLinks'),
  shotCharacterLinks: $('shotCharacterLinks'),
  shotContinuityReferenceLinks: $('shotContinuityReferenceLinks'),
  shotContinuityKeep: $('shotContinuityKeep'),
  shotContinuityVary: $('shotContinuityVary'),
  shotContinuityRisks: $('shotContinuityRisks'),
  shotContinuityPreview: $('shotContinuityPreview'),
  shotProgressionPreview: $('shotProgressionPreview'),
  shotComparisonPreview: $('shotComparisonPreview'),
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
  workspaceStatus: $('workspaceStatus'),
  assistiveScopeType: $('assistiveScopeType'),
  assistiveScopeValue: $('assistiveScopeValue'),
  assistiveSummary: $('assistiveSummary'),
  assistiveRecommendationList: $('assistiveRecommendationList')
};

const SHOT_TEMPLATES = [
  {
    id: 'wide-establishing',
    label: 'Abertura / establishing',
    defaults: {
      shotType: 'plano geral',
      angle: 'altura dos olhos com abertura espacial',
      cameraMovement: 'estático ou drift lento',
      narrativeObjective: 'estabelecer geografia, clima e escala da cena',
      pacingIntensity: 'ritmo contemplativo',
      visualProgression: 'abrir a sequência e situar o espectador',
      narrativeProgression: 'introduzir contexto antes do conflito'
    }
  },
  {
    id: 'dialogue-intimate',
    label: 'Diálogo íntimo',
    defaults: {
      shotType: 'plano médio / close',
      angle: 'eye level íntimo',
      cameraMovement: 'push-in suave',
      narrativeObjective: 'capturar reação emocional e subtexto',
      pacingIntensity: 'ritmo moderado com foco emocional',
      visualProgression: 'aproximar a câmera do conflito interno',
      narrativeProgression: 'aprofundar a decisão do personagem'
    }
  },
  {
    id: 'kinetic-transition',
    label: 'Transição cinética',
    defaults: {
      shotType: 'plano sequência',
      angle: 'ângulo dinâmico com deslocamento lateral',
      cameraMovement: 'tracking lateral / pan contínuo',
      narrativeObjective: 'ligar beats com energia e direção',
      pacingIntensity: 'ritmo acelerando',
      visualProgression: 'levar a sequência do estático ao movimento',
      narrativeProgression: 'empurrar a cena para a próxima ação'
    }
  }
];

const SHOT_LANGUAGE_PRESETS = [
  {
    id: 'classical-continuity',
    label: 'Continuidade clássica',
    defaults: {
      cameraMovement: 'movimentos discretos e motivados pela ação',
      pacingIntensity: 'cadência limpa e legível',
      directorNotes: 'Priorizar eixo claro, continuidade espacial e leitura editorial objetiva.'
    }
  },
  {
    id: 'heightened-emotion',
    label: 'Emoção progressiva',
    defaults: {
      angle: 'aproximações graduais e eixo íntimo',
      cameraMovement: 'push-in ou handheld controlado',
      pacingIntensity: 'crescimento emocional progressivo',
      directorNotes: 'Escalar emoção shot a shot sem perder fidelidade visual dos personagens.'
    }
  },
  {
    id: 'dynamic-action',
    label: 'Ação controlada',
    defaults: {
      angle: 'ângulos energizados com contraste de escala',
      cameraMovement: 'tracking com aceleração ou whip pan leve',
      pacingIntensity: 'intensidade alta com leitura espacial preservada',
      directorNotes: 'Manter clareza de direção e continuidade de eixo mesmo com energia alta.'
    }
  }
];

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
const assistiveScopeType = () => refs.assistiveScopeType?.value || 'project';

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

const currentBeat = () => (state.beats || []).find((beat) => beat.id === refs.shotBeatSelect.value);

const currentShot = () => (state.shots || []).find((shot) => shot.id === refs.shotSelect.value);

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

const projectScenesAll = () => state.scenes.filter((scene) => scene.projectId === selectedProjectId());

const projectAssets = () => state.assets.filter((asset) => asset.projectId === selectedProjectId());

const projectBeats = () => (state.beats || []).filter((beat) => beat.projectId === selectedProjectId());

const projectShots = () => (state.shots || []).filter((shot) => shot.projectId === selectedProjectId());

const projectGenerationOutputs = () =>
  (state.generationJobs || [])
    .filter((job) => job.projectId === selectedProjectId())
    .flatMap((job) => (job.outputs || []).map((output) => ({ job, output })));

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

const renderOptionsWithBlank = (select, options, selectedId, blankLabel = 'Nenhum vínculo') => {
  if (!select) return;
  select.innerHTML = '';
  const blankOption = document.createElement('option');
  blankOption.value = '';
  blankOption.textContent = blankLabel;
  select.append(blankOption);
  options.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name || item.title;
    if (selectedId && selectedId === item.id) option.selected = true;
    select.append(option);
  });
  if (selectedId && options.some((item) => item.id === selectedId)) {
    select.value = selectedId;
  } else {
    select.value = '';
  }
};

const shotTemplateById = (id) => SHOT_TEMPLATES.find((template) => template.id === id) || null;

const shotLanguagePresetById = (id) => SHOT_LANGUAGE_PRESETS.find((preset) => preset.id === id) || null;

const applyShotTemplate = (shot, templateId) => {
  const template = shotTemplateById(templateId);
  if (!template) return shot;
  return {
    ...shot,
    templateId: template.id,
    shotType: template.defaults.shotType || shot.shotType,
    angle: template.defaults.angle || shot.angle,
    cameraMovement: template.defaults.cameraMovement || shot.cameraMovement,
    narrativeObjective: template.defaults.narrativeObjective || shot.narrativeObjective,
    pacingIntensity: template.defaults.pacingIntensity || shot.pacingIntensity,
    visualProgression: template.defaults.visualProgression || shot.visualProgression,
    narrativeProgression: template.defaults.narrativeProgression || shot.narrativeProgression
  };
};

const applyShotLanguagePreset = (shot, presetId) => {
  const preset = shotLanguagePresetById(presetId);
  if (!preset) return shot;
  return {
    ...shot,
    languagePresetId: preset.id,
    angle: preset.defaults.angle || shot.angle,
    cameraMovement: preset.defaults.cameraMovement || shot.cameraMovement,
    pacingIntensity: preset.defaults.pacingIntensity || shot.pacingIntensity,
    directorNotes: preset.defaults.directorNotes || shot.directorNotes
  };
};

const timestampOrEnd = (value) => (value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER);

const shotOrderSorter = (a, b) =>
  (a.order || 0) - (b.order || 0) || timestampOrEnd(a.createdAt) - timestampOrEnd(b.createdAt);

const plannerVisibleScenes = () => {
  const chapterId = refs.shotFilterChapter.value || '';
  return projectScenesAll()
    .filter((scene) => !chapterId || scene.chapterId === chapterId)
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
};

const plannerCurrentSceneId = () => refs.shotFilterScene.value || plannerVisibleScenes()[0]?.id || '';

const plannerSceneBeats = (sceneId = plannerCurrentSceneId()) =>
  projectBeats()
    .filter((beat) => beat.sceneId === sceneId)
    .sort(shotOrderSorter);

const plannerSceneShots = (sceneId) =>
  projectShots()
    .filter((shot) => shot.sceneId === sceneId)
    .sort(shotOrderSorter);

const plannerFilteredShots = () => {
  let result = projectShots();
  const chapterId = refs.shotFilterChapter.value || '';
  const sceneId = refs.shotFilterScene.value || '';
  const characterId = refs.shotFilterCharacter.value || '';
  const status = refs.shotFilterStatus.value || '';
  const shotType = refs.shotFilterType.value || '';

  if (chapterId) result = result.filter((shot) => shot.chapterId === chapterId);
  if (sceneId) result = result.filter((shot) => shot.sceneId === sceneId);
  if (characterId) {
    result = result.filter(
      (shot) => shot.focusCharacterId === characterId || (shot.linkedCharacterIds || []).includes(characterId)
    );
  }
  if (status) result = result.filter((shot) => shot.status === status);
  if (shotType) result = result.filter((shot) => shot.shotType === shotType);

  return result.sort((a, b) => {
    if (a.sceneId !== b.sceneId) {
      const sceneA = state.scenes.find((scene) => scene.id === a.sceneId)?.title || '';
      const sceneB = state.scenes.find((scene) => scene.id === b.sceneId)?.title || '';
      return sceneA.localeCompare(sceneB, 'pt-BR');
    }
    return shotOrderSorter(a, b);
  });
};

const plannerShotContext = (shot) => {
  const scene = state.scenes.find((entry) => entry.id === shot.sceneId);
  const chapter = state.chapters.find((entry) => entry.id === shot.chapterId);
  const beat = (state.beats || []).find((entry) => entry.id === shot.beatId);
  const focus = state.characters.find((entry) => entry.id === shot.focusCharacterId);
  return {
    scene,
    chapter,
    beat,
    focus
  };
};

const plannerSequenceReferenceNames = (ids) =>
  (ids || [])
    .map((id) => state.referenceImages.find((reference) => reference.id === id)?.name)
    .filter(Boolean);

const renderChecklist = (container, items, selectedIds, emptyText) => {
  if (!container) return;
  container.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'sp-empty';
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  const selected = new Set(selectedIds || []);
  items.forEach((item) => {
    const label = document.createElement('label');
    label.className = 'sp-checkbox-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = item.id;
    checkbox.checked = selected.has(item.id);
    const text = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = item.title;
    text.append(title);
    if (item.meta) {
      const meta = document.createElement('small');
      meta.textContent = item.meta;
      text.append(meta);
    }
    if (item.detail) {
      const detail = document.createElement('small');
      detail.textContent = item.detail;
      text.append(detail);
    }
    label.append(checkbox, text);
    container.append(label);
  });
};

const checkedValues = (container) =>
  Array.from(container?.querySelectorAll('input[type="checkbox"]:checked') || []).map((input) => input.value);

const findMissingContinuityRules = (previousShot, currentShot) => {
  if (!previousShot) return [];
  const currentKeep = new Set(currentShot?.continuityMustKeep || []);
  const currentVary = new Set(currentShot?.continuityMayVary || []);
  return (previousShot.continuityMustKeep || []).filter(
    (rule) => !currentKeep.has(rule) && !currentVary.has(rule)
  );
};

const formatShotTransition = (previousShot, currentShot) =>
  previousShot
    ? `transição: ${previousShot.shotType || 'plano'} / ${previousShot.dominantEmotion || 'emoção'} → ${currentShot.shotType || 'plano'} / ${currentShot.dominantEmotion || 'emoção'}`
    : 'transição: abertura da sequência';

const renderShotPlanner = () => {
  const chapterOptions = state.chapters
    .filter((chapter) => chapter.projectId === selectedProjectId())
    .map((chapter) => ({ ...chapter, name: chapter.title }));
  renderOptionsWithBlank(refs.shotFilterChapter, chapterOptions, refs.shotFilterChapter.value, 'Todos os capítulos');

  const visibleScenes = plannerVisibleScenes();
  const selectedSceneId = visibleScenes.some((scene) => scene.id === refs.shotFilterScene.value)
    ? refs.shotFilterScene.value
    : '';
  renderOptionsWithBlank(
    refs.shotFilterScene,
    visibleScenes.map((scene) => ({ ...scene, name: scene.title })),
    selectedSceneId,
    'Todas as cenas'
  );

  renderOptionsWithBlank(
    refs.shotFilterCharacter,
    projectCharacters().map((character) => ({ ...character, name: character.name })),
    refs.shotFilterCharacter.value,
    'Todos os personagens'
  );
  renderOptionsWithBlank(
    refs.shotFilterStatus,
    SHOT_STATUSES.map((status) => ({ id: status, name: status })),
    refs.shotFilterStatus.value,
    'Todos os status'
  );
  const shotTypes = Array.from(
    new Set(
      projectShots()
        .map((shot) => shot.shotType)
        .concat(SHOT_TEMPLATES.map((template) => template.defaults.shotType))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  renderOptionsWithBlank(
    refs.shotFilterType,
    shotTypes.map((type) => ({ id: type, name: type })),
    refs.shotFilterType.value,
    'Todos os planos'
  );

  renderOptions(
    refs.shotTemplateSelect,
    SHOT_TEMPLATES.map((template) => ({ id: template.id, name: template.label })),
    refs.shotTemplateSelect.value || SHOT_TEMPLATES[0]?.id,
    'Nenhum template'
  );
  renderOptions(
    refs.shotLanguagePresetSelect,
    SHOT_LANGUAGE_PRESETS.map((preset) => ({ id: preset.id, name: preset.label })),
    refs.shotLanguagePresetSelect.value || SHOT_LANGUAGE_PRESETS[0]?.id,
    'Nenhum preset'
  );

  const filteredShots = plannerFilteredShots();
  renderOptions(
    refs.shotSelect,
    filteredShots.map((shot) => {
      const context = plannerShotContext(shot);
      const sceneLabel = context.scene?.title || 'Cena';
      return {
        id: shot.id,
        name: `${sceneLabel} · ${shot.order + 1}. ${shot.title}`
      };
    }),
    filteredShots.some((shot) => shot.id === refs.shotSelect.value) ? refs.shotSelect.value : filteredShots[0]?.id,
    'Nenhum shot planejado'
  );

  const shot = currentShot();
  const sceneIdForBeats = shot?.sceneId || plannerCurrentSceneId();
  const beats = plannerSceneBeats(sceneIdForBeats);
  renderOptionsWithBlank(
    refs.shotBeatSelect,
    beats.map((beat) => ({ id: beat.id, name: `${beat.order + 1}. ${beat.title}` })),
    shot?.beatId && beats.some((beat) => beat.id === shot.beatId) ? shot.beatId : refs.shotBeatSelect.value,
    'Sem beat'
  );

  const beat = currentBeat();
  refs.beatTitleInput.value = beat?.title || '';
  refs.beatSummaryInput.value = beat?.summary || '';
  setDisabled(['saveBeatBtn', 'deleteBeatBtn'], !beat);

  renderOptionsWithBlank(
    refs.shotFocusCharacterSelect,
    projectCharacters().map((character) => ({ ...character, name: character.name })),
    shot?.focusCharacterId,
    'Sem personagem focal'
  );
  renderOptions(
    refs.shotStatusSelect,
    SHOT_STATUSES.map((status) => ({ id: status, name: status })),
    shot?.status || SHOT_STATUSES[0],
    'Status'
  );

  refs.shotTitleInput.value = shot?.title || '';
  refs.shotTypeInput.value = shot?.shotType || '';
  refs.shotAngleInput.value = shot?.angle || '';
  refs.shotCameraMovementInput.value = shot?.cameraMovement || '';
  refs.shotDominantEmotionInput.value = shot?.dominantEmotion || '';
  refs.shotEnvironmentInput.value = shot?.environment || '';
  refs.shotNarrativeObjectiveInput.value = shot?.narrativeObjective || '';
  refs.shotPacingIntensityInput.value = shot?.pacingIntensity || '';
  refs.shotVisualProgressionInput.value = shot?.visualProgression || '';
  refs.shotNarrativeProgressionInput.value = shot?.narrativeProgression || '';
  refs.shotDirectorNotes.value = shot?.directorNotes || '';
  refs.shotContinuityKeep.value = Array.isArray(shot?.continuityMustKeep) ? shot.continuityMustKeep.join('\n') : '';
  refs.shotContinuityVary.value = Array.isArray(shot?.continuityMayVary) ? shot.continuityMayVary.join('\n') : '';
  refs.shotContinuityRisks.value = Array.isArray(shot?.continuityRisks) ? shot.continuityRisks.join('\n') : '';

  const promptItems = projectPromptDocuments().map((promptDocument) => ({
    id: promptDocument.id,
    title: promptDocument.title,
    meta: `${promptDocument.promptMedium} · alvo ${promptDocument.targetType}`,
    detail: `${promptDocument.isOfficial ? 'oficial' : 'em progresso'}${promptDocument.isFavorite ? ' · favorito' : ''}`
  }));
  const outputItems = projectGenerationOutputs()
    .filter(({ output }) => output.reviewStatus !== 'rejected' && output.reviewStatus !== 'archived')
    .map(({ output, job }) => ({
      id: output.id,
      title: output.fileName || `Output ${output.seed >= 0 ? `seed ${output.seed}` : output.id.slice(0, 8)}`,
      meta: [
        output.isCanonical ? 'canônico' : '',
        output.isFavorite ? 'favorito' : '',
        output.reviewStatus || '',
        output.generationType || ''
      ]
        .filter(Boolean)
        .join(' · '),
      detail: `${job.promptDocumentId ? 'prompt conectado' : 'sem prompt'}${output.sceneId ? ' · ligado a cena' : ''}`
    }));
  const videoItems = projectAssets()
    .filter((asset) => asset.type.toLowerCase().includes('video'))
    .map((asset) => ({
      id: asset.id,
      title: asset.name,
      meta: asset.type,
      detail: asset.path
    }));
  const referenceItems = state.referenceImages
    .filter((reference) => reference.projectId === selectedProjectId())
    .map((reference) => ({
      id: reference.id,
      title: reference.name,
      meta: `${reference.isCanonical ? 'canônica' : 'referência'} · ${reference.type}`,
      detail: `Preservar: ${reference.preserve || '—'} | Variar: ${reference.mayVary || '—'}`
    }));
  const characterItems = projectCharacters().map((character) => ({
    id: character.id,
    title: character.name,
    meta: character.visualAesthetic || character.presence || 'personagem canônico',
    detail: character.cinematicNotes || character.notes || 'sem notas adicionais'
  }));
  const continuityReferenceItems = referenceItems.filter((item) =>
    state.referenceImages.find((reference) => reference.id === item.id)?.isCanonical
  );

  renderChecklist(refs.shotPromptLinks, promptItems, shot?.promptDocumentIds, 'Nenhum prompt estruturado disponível.');
  renderChecklist(refs.shotOutputLinks, outputItems, shot?.generationOutputIds, 'Nenhuma imagem revisada disponível.');
  renderChecklist(refs.shotVideoLinks, videoItems, shot?.videoAssetIds, 'Nenhum vídeo local vinculado ao projeto.');
  renderChecklist(refs.shotReferenceLinks, referenceItems, shot?.referenceImageIds, 'Nenhuma referência visual encontrada.');
  renderChecklist(refs.shotCharacterLinks, characterItems, shot?.linkedCharacterIds, 'Nenhum personagem disponível.');
  renderChecklist(
    refs.shotContinuityReferenceLinks,
    continuityReferenceItems,
    shot?.continuityReferenceIds,
    'Nenhuma referência canônica marcada.'
  );

  refs.shotTimeline.innerHTML = '';
  if (!filteredShots.length) {
    refs.shotTimeline.innerHTML = '<div class="sp-empty">Nenhum shot corresponde ao filtro atual.</div>';
  } else {
    filteredShots.forEach((entry) => {
      const context = plannerShotContext(entry);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `sp-shot-item${entry.id === refs.shotSelect.value ? ' active' : ''}`;
      const previous = plannerSceneShots(entry.sceneId).find((shotItem) => shotItem.order === entry.order - 1);
      const missingContinuity = findMissingContinuityRules(previous, entry);
      item.innerHTML = `
        <strong>${entry.order + 1}. ${entry.title}</strong>
        <span class="sp-shot-meta">${context.chapter?.title || 'Sem capítulo'} · ${context.scene?.title || 'Sem cena'}${context.beat ? ` · ${context.beat.title}` : ''}</span>
        <span class="sp-shot-detail">[${entry.status}] ${entry.shotType || 'plano livre'} · foco ${context.focus?.name || 'aberto'} · ${entry.dominantEmotion || 'emoção livre'}</span>
        <span class="sp-shot-detail">${missingContinuity.length ? `⚠ revisar continuidade: ${missingContinuity.join(', ')}` : entry.narrativeObjective || 'Sem objetivo narrativo registrado.'}</span>
      `;
      item.addEventListener('click', () => {
        refs.shotFilterScene.value = entry.sceneId;
        refs.shotSelect.value = entry.id;
        refs.shotBeatSelect.value = entry.beatId || '';
        renderShotPlanner();
      });
      refs.shotTimeline.append(item);
    });
  }

  if (!shot) {
    refs.shotContinuityPreview.textContent = 'Nenhum shot selecionado.';
    refs.shotProgressionPreview.textContent = 'Nenhum shot planejado.';
    refs.shotComparisonPreview.textContent = 'Selecione um shot para comparar com o anterior e o próximo.';
    setDisabled(
      ['saveShotBtn', 'deleteShotBtn', 'moveShotUpBtn', 'moveShotDownBtn', 'applyShotTemplateBtn', 'applyShotLanguagePresetBtn'],
      true
    );
    return;
  }

  const sceneShots = plannerSceneShots(shot.sceneId);
  const shotIndex = sceneShots.findIndex((entry) => entry.id === shot.id);
  const previous = shotIndex > 0 ? sceneShots[shotIndex - 1] : null;
  const next = shotIndex >= 0 && shotIndex < sceneShots.length - 1 ? sceneShots[shotIndex + 1] : null;
  const context = plannerShotContext(shot);
  const continuityReferences = plannerSequenceReferenceNames(shot.continuityReferenceIds);
  const missingContinuity = findMissingContinuityRules(previous, shot);
  refs.shotContinuityPreview.textContent = JSON.stringify(
    {
      shot: shot.title,
      status: shot.status,
      keep: shot.continuityMustKeep,
      mayVary: shot.continuityMayVary,
      risks: shot.continuityRisks,
      canonicalReferences: continuityReferences,
      continuityIndicator: missingContinuity.length
        ? `Atenção: herdar de ${previous?.title || 'shot anterior'} -> ${missingContinuity.join(', ')}`
        : 'Continuidade básica preservada para a sequência atual.'
    },
    null,
    2
  );
  refs.shotComparisonPreview.textContent = JSON.stringify(
    {
      previous: previous
        ? {
            title: previous.title,
            shotType: previous.shotType,
            emotion: previous.dominantEmotion,
            objective: previous.narrativeObjective
          }
        : null,
      current: {
        title: shot.title,
        beat: context.beat?.title || '',
        shotType: shot.shotType,
        emotion: shot.dominantEmotion,
        objective: shot.narrativeObjective,
        visualProgression: shot.visualProgression,
        narrativeProgression: shot.narrativeProgression
      },
      next: next
        ? {
            title: next.title,
            shotType: next.shotType,
            emotion: next.dominantEmotion,
            objective: next.narrativeObjective
          }
        : null
    },
    null,
    2
  );
  refs.shotProgressionPreview.textContent = [
    `${context.chapter?.title || 'Sem capítulo'} → ${context.scene?.title || 'Sem cena'} (${sceneShots.length} shots)`,
    ...sceneShots.map((entry, index) => {
      const entryContext = plannerShotContext(entry);
      const prev = index > 0 ? sceneShots[index - 1] : null;
      const transition = formatShotTransition(prev, entry);
      return `${index + 1}. [${entry.status}] ${entry.title}${entryContext.beat ? ` · beat ${entryContext.beat.title}` : ''}\n   ${entry.shotType || 'plano livre'} · ${entry.cameraMovement || 'movimento livre'} · foco ${entryContext.focus?.name || 'aberto'}\n   objetivo: ${entry.narrativeObjective || '—'}\n   progressão: ${entry.visualProgression || entry.narrativeProgression || transition}`;
    })
  ].join('\n\n');

  setDisabled(
    ['saveShotBtn', 'deleteShotBtn', 'applyShotTemplateBtn', 'applyShotLanguagePresetBtn'],
    false
  );
  setDisabled(['moveShotUpBtn'], shotIndex <= 0);
  setDisabled(['moveShotDownBtn'], shotIndex < 0 || shotIndex >= sceneShots.length - 1);
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

const renderAssistivePlanning = () => {
  if (!refs.assistiveRecommendationList || !refs.assistiveSummary || !refs.assistiveScopeValue) return;

  const projectId = selectedProjectId();
  const scopeType = assistiveScopeType();
  const chapterOptions = state.chapters
    .filter((chapter) => chapter.projectId === projectId)
    .map((chapter) => ({ id: chapter.id, name: chapter.title }));
  const sequenceOptions = (state.beats || [])
    .filter((beat) => beat.projectId === projectId)
    .map((beat) => {
      const sceneLabel = state.scenes.find((scene) => scene.id === beat.sceneId)?.title || 'Cena';
      return { id: beat.id, name: `${sceneLabel} · ${beat.title}` };
    });
  const sceneOptions = state.scenes
    .filter((scene) => scene.projectId === projectId)
    .map((scene) => ({ id: scene.id, name: scene.title }));
  const optionsByScope = {
    chapter: chapterOptions,
    sequence: sequenceOptions,
    scene: sceneOptions
  };

  renderOptionsWithBlank(
    refs.assistiveScopeValue,
    optionsByScope[scopeType] || [],
    refs.assistiveScopeValue.value,
    scopeType === 'project' ? 'Projeto inteiro' : 'Todos'
  );
  if (scopeType === 'project') refs.assistiveScopeValue.value = '';

  const bundle = buildAssistivePlanningBundle({
    state,
    projectId,
    scopeType,
    scopeValue: refs.assistiveScopeValue.value
  });

  refs.assistiveSummary.textContent = JSON.stringify(
    {
      escopo: scopeType,
      total: bundle.summary.total,
      blocked: bundle.summary.blocked,
      readyToGenerate: bundle.summary.readyToGenerate,
      readyToReview: bundle.summary.readyToReview
    },
    null,
    2
  );

  refs.assistiveRecommendationList.innerHTML = '';
  if (!bundle.recommendations.length) {
    refs.assistiveRecommendationList.innerHTML =
      '<div class="ap-empty">Nenhuma recomendação para o escopo atual. Continue com o pipeline local no MacBook.</div>';
    return;
  }

  bundle.recommendations.forEach((entry) => {
    const card = document.createElement('article');
    card.className = `ap-card ap-status-${entry.status}`;
    card.dataset.sceneId = entry.sceneId || '';
    card.dataset.chapterId = entry.chapterId || '';
    card.dataset.sequenceId = entry.sequenceId || '';

    const header = document.createElement('header');
    header.className = 'ap-card-header';
    const type = document.createElement('strong');
    type.textContent = `${entry.rank}. ${entry.type}`;
    const priority = document.createElement('span');
    priority.className = 'ap-priority';
    priority.textContent = `prioridade ${entry.priorityLabel} (${entry.priorityScore})`;
    header.append(type, priority);

    const title = document.createElement('p');
    title.className = 'ap-card-title';
    title.textContent = entry.title;

    const description = document.createElement('p');
    description.className = 'ap-card-description';
    description.textContent = entry.description;

    const footer = document.createElement('div');
    footer.className = 'ap-card-footer';
    const status = document.createElement('span');
    status.className = 'ap-status-pill';
    status.textContent = entry.status;
    footer.append(status);
    if (entry.quickAction) {
      const actionBtn = document.createElement('button');
      actionBtn.dataset.action = entry.quickAction.id;
      actionBtn.textContent = entry.quickAction.label;
      footer.append(actionBtn);
    }
    card.append(header, title, description, footer);
    refs.assistiveRecommendationList.append(card);
  });
};

const runAssistiveQuickAction = (action, card) => {
  const sceneId = card.dataset.sceneId || '';
  const chapterId = card.dataset.chapterId || '';
  const sequenceId = card.dataset.sequenceId || '';

  if (chapterId) refs.chapterSelect.value = chapterId;
  if (sceneId) refs.sceneSelect.value = sceneId;

  if (action === 'open-shot-planner') {
    refs.shotFilterChapter.value = chapterId;
    refs.shotFilterScene.value = sceneId;
    refs.shotBeatSelect.value = sequenceId;
    render();
    document.querySelector('.sp-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (action === 'open-prompt-builder') {
    render();
    psOpenStudio('scene');
    return;
  }
  if (action === 'open-image-gen') {
    render();
    openImageGenStudio();
    return;
  }
  if (action === 'open-image-review') {
    render();
    openImageReviewStudio();
  }
};

if (refs.assistiveRecommendationList) {
  refs.assistiveRecommendationList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const card = button.closest('.ap-card');
    if (!card) return;
    runAssistiveQuickAction(button.dataset.action, card);
  });
}

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
  renderShotPlanner();
  renderWorkspaceSettings();
  renderAssistivePlanning();
  renderLore();
  renderAssets();

  setDisabled(['createBookBtn', 'createCharacterBtn', 'createLoreBtn', 'createSceneBtn', 'saveAssetBtn'], !selectedProjectId());
  setDisabled(['createBeatBtn', 'createShotBtn'], !selectedProjectId() || !plannerCurrentSceneId());
  setDisabled(['openCanonStudioBtn'], !selectedCharacterId() || !selectedProjectId());
  setDisabled(
    ['openPromptStudioBtn', 'createPromptDocumentBtn', 'openPromptStudioFromCharacterBtn', 'openPromptStudioFromSceneBtn'],
    !selectedProjectId()
  );
  setDisabled(['openImageGenStudioBtn'], !selectedProjectId());
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

const plannerReindexSceneShots = (sceneId) => {
  plannerSceneShots(sceneId).forEach((shot, index) => {
    shot.order = index;
    shot.updatedAt = new Date().toISOString();
  });
};

$('createBeatBtn').addEventListener('click', () => {
  const title = $('newBeatTitle').value.trim();
  const sceneId = plannerCurrentSceneId();
  const scene = state.scenes.find((entry) => entry.id === sceneId);
  if (!title || !selectedProjectId() || !scene) return;

  const beat = createBeat({
    projectId: selectedProjectId(),
    chapterId: scene.chapterId || UNASSIGNED_CHAPTER_ID,
    sceneId: scene.id,
    title,
    summary: $('newBeatSummary').value.trim(),
    order: plannerSceneBeats(scene.id).length
  });
  if (!state.beats) state.beats = [];
  state.beats.push(beat);
  setValue('newBeatTitle', '');
  setValue('newBeatSummary', '');
  persist();
  refs.shotFilterScene.value = scene.id;
  refs.shotBeatSelect.value = beat.id;
  renderShotPlanner();
});

$('saveBeatBtn').addEventListener('click', () => {
  const beat = currentBeat();
  if (!beat) return;
  beat.title = refs.beatTitleInput.value.trim() || beat.title;
  beat.summary = refs.beatSummaryInput.value.trim();
  beat.updatedAt = new Date().toISOString();
  persist();
});

$('deleteBeatBtn').addEventListener('click', () => {
  const beat = currentBeat();
  if (!beat || !window.confirm(`Excluir o beat "${beat.title}" e soltar os shots ligados a ele?`)) return;
  state = deleteEntity(state, 'beat', beat.id);
  persist();
});

$('createShotBtn').addEventListener('click', () => {
  const title = $('newShotTitle').value.trim();
  const beat = currentBeat();
  const sceneId = beat?.sceneId || plannerCurrentSceneId();
  const scene = state.scenes.find((entry) => entry.id === sceneId);
  if (!title || !selectedProjectId() || !scene) return;

  let shot = createShot({
    projectId: selectedProjectId(),
    chapterId: scene.chapterId || UNASSIGNED_CHAPTER_ID,
    sceneId: scene.id,
    beatId: beat?.id || '',
    title,
    order: plannerSceneShots(scene.id).length,
    status: 'idea'
  });
  shot = applyShotTemplate(shot, refs.shotTemplateSelect.value);
  shot = applyShotLanguagePreset(shot, refs.shotLanguagePresetSelect.value);
  if (!state.shots) state.shots = [];
  state.shots.push(shot);
  setValue('newShotTitle', '');
  persist();
  refs.shotFilterScene.value = scene.id;
  refs.shotSelect.value = shot.id;
  refs.shotBeatSelect.value = shot.beatId || '';
  renderShotPlanner();
});

$('applyShotTemplateBtn').addEventListener('click', () => {
  const shot = currentShot();
  if (!shot) return;
  Object.assign(shot, applyShotTemplate(shot, refs.shotTemplateSelect.value), {
    updatedAt: new Date().toISOString()
  });
  persist();
});

$('applyShotLanguagePresetBtn').addEventListener('click', () => {
  const shot = currentShot();
  if (!shot) return;
  Object.assign(shot, applyShotLanguagePreset(shot, refs.shotLanguagePresetSelect.value), {
    updatedAt: new Date().toISOString()
  });
  persist();
});

$('saveShotBtn').addEventListener('click', () => {
  const shot = currentShot();
  if (!shot) return;
  const scene = state.scenes.find((entry) => entry.id === shot.sceneId);
  shot.beatId = refs.shotBeatSelect.value || '';
  shot.chapterId = scene?.chapterId || shot.chapterId || UNASSIGNED_CHAPTER_ID;
  shot.title = refs.shotTitleInput.value.trim() || shot.title;
  shot.status = refs.shotStatusSelect.value;
  shot.shotType = refs.shotTypeInput.value.trim();
  shot.angle = refs.shotAngleInput.value.trim();
  shot.cameraMovement = refs.shotCameraMovementInput.value.trim();
  shot.focusCharacterId = refs.shotFocusCharacterSelect.value || '';
  shot.dominantEmotion = refs.shotDominantEmotionInput.value.trim();
  shot.environment = refs.shotEnvironmentInput.value.trim();
  shot.narrativeObjective = refs.shotNarrativeObjectiveInput.value.trim();
  shot.pacingIntensity = refs.shotPacingIntensityInput.value.trim();
  shot.visualProgression = refs.shotVisualProgressionInput.value.trim();
  shot.narrativeProgression = refs.shotNarrativeProgressionInput.value.trim();
  shot.directorNotes = refs.shotDirectorNotes.value.trim();
  shot.promptDocumentIds = checkedValues(refs.shotPromptLinks);
  shot.generationOutputIds = checkedValues(refs.shotOutputLinks);
  shot.videoAssetIds = checkedValues(refs.shotVideoLinks);
  shot.referenceImageIds = checkedValues(refs.shotReferenceLinks);
  shot.linkedCharacterIds = checkedValues(refs.shotCharacterLinks);
  shot.continuityReferenceIds = checkedValues(refs.shotContinuityReferenceLinks);
  shot.continuityMustKeep = parseLines(refs.shotContinuityKeep.value);
  shot.continuityMayVary = parseLines(refs.shotContinuityVary.value);
  shot.continuityRisks = parseLines(refs.shotContinuityRisks.value);
  shot.updatedAt = new Date().toISOString();
  persist();
});

$('deleteShotBtn').addEventListener('click', () => {
  const shot = currentShot();
  if (!shot || !window.confirm(`Excluir o shot "${shot.title}"?`)) return;
  const sceneId = shot.sceneId;
  state = deleteEntity(state, 'shot', shot.id);
  plannerReindexSceneShots(sceneId);
  persist();
});

$('moveShotUpBtn').addEventListener('click', () => {
  const shot = currentShot();
  if (!shot) return;
  const sceneShots = plannerSceneShots(shot.sceneId);
  const index = sceneShots.findIndex((entry) => entry.id === shot.id);
  if (index <= 0) return;
  const previous = sceneShots[index - 1];
  const currentOrder = shot.order;
  shot.order = previous.order;
  previous.order = currentOrder;
  plannerReindexSceneShots(shot.sceneId);
  persist();
  refs.shotSelect.value = shot.id;
  renderShotPlanner();
});

$('moveShotDownBtn').addEventListener('click', () => {
  const shot = currentShot();
  if (!shot) return;
  const sceneShots = plannerSceneShots(shot.sceneId);
  const index = sceneShots.findIndex((entry) => entry.id === shot.id);
  if (index < 0 || index >= sceneShots.length - 1) return;
  const next = sceneShots[index + 1];
  const currentOrder = shot.order;
  shot.order = next.order;
  next.order = currentOrder;
  plannerReindexSceneShots(shot.sceneId);
  persist();
  refs.shotSelect.value = shot.id;
  renderShotPlanner();
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
refs.shotFilterChapter.addEventListener('change', () => {
  refs.shotFilterScene.value = '';
  refs.shotBeatSelect.value = '';
  renderShotPlanner();
});
refs.shotFilterScene.addEventListener('change', () => {
  refs.shotBeatSelect.value = '';
  renderShotPlanner();
});
refs.shotFilterCharacter.addEventListener('change', renderShotPlanner);
refs.shotFilterStatus.addEventListener('change', renderShotPlanner);
refs.shotFilterType.addEventListener('change', renderShotPlanner);
refs.shotBeatSelect.addEventListener('change', renderShotPlanner);
refs.shotSelect.addEventListener('change', renderShotPlanner);
$('loreSearch').addEventListener('input', renderLore);
refs.assistiveScopeType.addEventListener('change', render);
refs.assistiveScopeValue.addEventListener('change', render);

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

// =========== Image Generation Studio ===========

let igsIsOpen = false;
let igsSelectedOutputId = null;
let igsCompareIds = [];
let igsSelectedJobId = null;
let igsIsRunning = false;

const igsRefs = {
  overlay: $('imageGenStudio'),
  closeBtn: $('igsCloseBtn'),
  runBtn: $('igsRunBtn'),
  tabBtnStudio: $('igsTabBtnStudio'),
  tabBtnHistory: $('igsTabBtnHistory'),
  tabBtnConfig: $('igsTabBtnConfig'),
  tabStudio: $('igsTabStudio'),
  tabHistory: $('igsTabHistory'),
  tabConfig: $('igsTabConfig'),
  // Studio
  genType: $('igsGenType'),
  characterSelect: $('igsCharacterSelect'),
  sceneSelect: $('igsSceneSelect'),
  promptDocSelect: $('igsPromptDocSelect'),
  loadPromptBtn: $('igsLoadPromptBtn'),
  referenceList: $('igsReferenceList'),
  prompt: $('igsPrompt'),
  negativePrompt: $('igsNegativePrompt'),
  resolution: $('igsResolution'),
  steps: $('igsSteps'),
  cfgScale: $('igsCfgScale'),
  sampler: $('igsSampler'),
  seed: $('igsSeed'),
  numImages: $('igsNumImages'),
  seedLock: $('igsSeedLock'),
  runBtnMain: $('igsRunBtnMain'),
  status: $('igsStatus'),
  outputGallery: $('igsOutputGallery'),
  outputDetail: $('igsOutputDetail'),
  detailImg: $('igsDetailImg'),
  detailMeta: $('igsDetailMeta'),
  detailFavoriteBtn: $('igsDetailFavoriteBtn'),
  detailCanonBtn: $('igsDetailCanonBtn'),
  detailUseAsRefBtn: $('igsDetailUseAsRefBtn'),
  detailReviewBtn: $('igsDetailReviewBtn'),
  detailVariationBtn: $('igsDetailVariationBtn'),
  detailRegenerateBtn: $('igsDetailRegenerateBtn'),
  detailDeleteBtn: $('igsDetailDeleteBtn'),
  compareArea: $('igsCompareArea'),
  // History
  jobList: $('igsJobList'),
  jobDetail: $('igsJobDetail'),
  jobDetailPre: $('igsJobDetailPre'),
  jobDetailGallery: $('igsJobDetailGallery'),
  // Config
  configType: $('igsConfigType'),
  configEndpoint: $('igsConfigEndpoint'),
  configResolution: $('igsConfigResolution'),
  configSteps: $('igsConfigSteps'),
  configCfgScale: $('igsConfigCfgScale'),
  configSampler: $('igsConfigSampler'),
  configSeed: $('igsConfigSeed'),
  configNumImages: $('igsConfigNumImages'),
  configSeedLock: $('igsConfigSeedLock'),
  configSaveBtn: $('igsConfigSaveBtn'),
  configStatus: $('igsConfigStatus')
};

const igsProviderSettings = () => state.settings?.imageGenProvider || {};

const igsProjectJobs = () =>
  (state.generationJobs || []).filter((job) => job.projectId === selectedProjectId());

const igsCurrentJob = () =>
  (state.generationJobs || []).find((job) => job.id === igsSelectedJobId);

const igsAllOutputsForCurrentJob = () => {
  const job = igsCurrentJob();
  return job ? job.outputs || [] : [];
};

const igsFindOutput = (outputId) => {
  for (const job of (state.generationJobs || [])) {
    const output = (job.outputs || []).find((o) => o.id === outputId);
    if (output) return { job, output };
  }
  return null;
};

const igsSetStatus = (text, type = '') => {
  igsRefs.status.textContent = text;
  igsRefs.status.className = `igs-status${type ? ` ${type}` : ''}`;
};

const igsSetRunning = (running) => {
  igsIsRunning = running;
  igsRefs.runBtn.disabled = running;
  igsRefs.runBtnMain.disabled = running;
};

const igsSwitchTab = (tab) => {
  const tabs = ['studio', 'history', 'config'];
  tabs.forEach((t) => {
    const panel = igsRefs[`tab${t.charAt(0).toUpperCase() + t.slice(1)}`];
    const btn = igsRefs[`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`];
    if (panel) panel.classList.toggle('igs-hidden', t !== tab);
    if (btn) btn.classList.toggle('igs-tab-active', t === tab);
  });
};

const igsRenderReferenceList = () => {
  const projectReferences = state.referenceImages.filter(
    (ref) => ref.projectId === selectedProjectId()
  );
  igsRefs.referenceList.innerHTML = '';
  if (!projectReferences.length) {
    igsRefs.referenceList.innerHTML = '<p class="igs-hint">Nenhuma referência cadastrada neste projeto.</p>';
    return;
  }
  projectReferences.forEach((ref) => {
    const label = document.createElement('label');
    label.className = 'igs-reference-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = ref.id;
    const info = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = ref.name || 'Referência sem nome';
    const meta = document.createElement('small');
    const badges = [ref.isCanonical ? 'canon' : '', ref.type ? `tipo: ${ref.type}` : ''].filter(Boolean).join(' · ');
    meta.textContent = badges || 'referência visual';
    info.append(name, meta);
    label.append(checkbox, info);
    igsRefs.referenceList.append(label);
  });
};

const igsSelectedReferenceIds = () =>
  Array.from(igsRefs.referenceList.querySelectorAll('input[type="checkbox"]:checked')).map(
    (input) => input.value
  );

const igsRenderOutputGallery = (outputs, galleryEl, currentSelectedId = null) => {
  galleryEl.innerHTML = '';
  if (!outputs || !outputs.length) {
    galleryEl.innerHTML = '<p class="igs-hint">Nenhum output neste job.</p>';
    return;
  }
  outputs.forEach((output) => {
    const thumb = document.createElement('div');
    const isSelected = currentSelectedId === output.id;
    const isCompareA = igsCompareIds[0] === output.id;
    const isCompareB = igsCompareIds[1] === output.id;
    let cls = 'igs-output-thumb';
    if (isSelected) cls += ' selected';
    if (isCompareA) cls += ' compare-a';
    if (isCompareB) cls += ' compare-b';
    thumb.className = cls;
    thumb.dataset.outputId = output.id;

    if (output.dataUrl) {
      const img = document.createElement('img');
      img.src = output.dataUrl;
      img.alt = 'Output gerado';
      thumb.append(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:var(--muted)';
      placeholder.textContent = '🖼';
      thumb.append(placeholder);
    }

    const badgesEl = document.createElement('div');
    badgesEl.className = 'igs-output-thumb-badges';
    if (output.isFavorite) {
      const b = document.createElement('span');
      b.className = 'igs-badge igs-badge-fav';
      b.textContent = '★';
      badgesEl.append(b);
    }
    if (output.isCanonical) {
      const b = document.createElement('span');
      b.className = 'igs-badge igs-badge-canon';
      b.textContent = 'C';
      badgesEl.append(b);
    }
    if (badgesEl.children.length) thumb.append(badgesEl);

    thumb.addEventListener('click', (event) => {
      if (event.shiftKey) {
        igsHandleCompareClick(output.id);
      } else {
        igsSelectOutput(output.id);
      }
    });
    galleryEl.append(thumb);
  });
};

const igsRenderCurrentJobGallery = () => {
  const outputs = igsAllOutputsForCurrentJob();
  igsRenderOutputGallery(outputs, igsRefs.outputGallery, igsSelectedOutputId);
};

const igsHandleCompareClick = (outputId) => {
  if (igsCompareIds.includes(outputId)) {
    igsCompareIds = igsCompareIds.filter((id) => id !== outputId);
  } else if (igsCompareIds.length < 2) {
    igsCompareIds = [...igsCompareIds, outputId];
  } else {
    igsCompareIds = [igsCompareIds[1], outputId];
  }
  igsRenderCurrentJobGallery();
  igsRenderCompare();
};

const igsRenderCompare = () => {
  igsRefs.compareArea.innerHTML = '';
  if (!igsCompareIds.length) {
    igsRefs.compareArea.innerHTML = '<p class="igs-hint">Selecione dois outputs para comparar. Use Shift+clique na galeria.</p>';
    return;
  }
  igsCompareIds.forEach((id, idx) => {
    const found = igsFindOutput(id);
    if (!found) return;
    const { output } = found;
    if (output.dataUrl) {
      const img = document.createElement('img');
      img.src = output.dataUrl;
      img.alt = `Output ${idx + 1}`;
      img.title = `seed: ${output.seed}`;
      igsRefs.compareArea.append(img);
    }
  });
  if (!igsRefs.compareArea.children.length) {
    igsRefs.compareArea.innerHTML = '<p class="igs-hint">Outputs não encontrados para comparação.</p>';
  }
};

const igsSelectOutput = (outputId) => {
  igsSelectedOutputId = outputId;
  igsRenderCurrentJobGallery();
  const found = igsFindOutput(outputId);
  if (!found) {
    igsRefs.outputDetail.classList.add('igs-hidden');
    return;
  }
  const { output } = found;
  igsRefs.detailImg.src = output.dataUrl || '';
  igsRefs.detailImg.style.display = output.dataUrl ? 'block' : 'none';
  igsRefs.detailMeta.textContent = [
    `Tipo: ${output.generationType}`,
    `Seed: ${output.seed >= 0 ? output.seed : 'aleatório'}`,
    output.fileName ? `Arquivo: ${output.fileName}` : '',
    output.isCanonical ? '✓ Canônico' : '',
    output.isFavorite ? '★ Favorito' : ''
  ]
    .filter(Boolean)
    .join(' · ');
  igsRefs.detailFavoriteBtn.textContent = output.isFavorite ? '★ Favorito' : '☆ Favorito';
  igsRefs.detailCanonBtn.textContent = output.isCanonical ? '✓ Canônico' : '◇ Canônico';
  igsRefs.outputDetail.classList.remove('igs-hidden');
};

const igsReadParams = () => ({
  resolution: igsRefs.resolution.value.trim() || '512x768',
  steps: parseInt(igsRefs.steps.value, 10) || 28,
  cfgScale: parseFloat(igsRefs.cfgScale.value) || 7,
  sampler: igsRefs.sampler.value.trim() || 'DPM++ 2M Karras',
  seed: parseInt(igsRefs.seed.value, 10) ?? -1,
  numImages: parseInt(igsRefs.numImages.value, 10) || 1
});

const igsLoadParamsFromConfig = () => {
  const config = igsProviderSettings();
  igsRefs.resolution.value = config.resolution || '512x768';
  igsRefs.steps.value = config.steps ?? 28;
  igsRefs.cfgScale.value = config.cfgScale ?? 7;
  igsRefs.sampler.value = config.sampler || 'DPM++ 2M Karras';
  igsRefs.seed.value = config.seed ?? -1;
  igsRefs.numImages.value = config.numImages ?? 1;
  igsRefs.seedLock.checked = Boolean(config.seedLocked);
};

const igsLoadConfigTab = () => {
  const config = igsProviderSettings();
  igsRefs.configType.value = config.type || 'mock';
  igsRefs.configEndpoint.value = config.endpoint || 'http://127.0.0.1:7860';
  igsRefs.configResolution.value = config.resolution || '512x768';
  igsRefs.configSteps.value = config.steps ?? 28;
  igsRefs.configCfgScale.value = config.cfgScale ?? 7;
  igsRefs.configSampler.value = config.sampler || 'DPM++ 2M Karras';
  igsRefs.configSeed.value = config.seed ?? -1;
  igsRefs.configNumImages.value = config.numImages ?? 1;
  igsRefs.configSeedLock.checked = Boolean(config.seedLocked);
};

const igsRenderJobList = () => {
  const jobs = igsProjectJobs().slice().reverse();
  igsRefs.jobList.innerHTML = '';
  if (!jobs.length) {
    igsRefs.jobList.innerHTML = '<p class="igs-hint">Nenhum job registrado ainda.</p>';
    return;
  }
  jobs.forEach((job) => {
    const item = document.createElement('div');
    item.className = `igs-job-item${job.id === igsSelectedJobId ? ' selected' : ''}`;
    item.dataset.jobId = job.id;
    const titleEl = document.createElement('div');
    titleEl.className = 'igs-job-item-title';
    const typeLabel = IMAGE_GEN_TYPES.includes(job.generationType) ? job.generationType : 'imagem';
    const statusBadge = document.createElement('span');
    statusBadge.className = `igs-job-status igs-job-status-${job.status}`;
    statusBadge.textContent = job.status;
    titleEl.textContent = `${typeLabel} · ${job.outputs.length} output(s)`;
    titleEl.append(statusBadge);
    const metaEl = document.createElement('div');
    metaEl.className = 'igs-job-item-meta';
    metaEl.textContent = `${new Date(job.createdAt).toLocaleString('pt-BR')} · ${job.providerLabel}`;
    item.append(titleEl, metaEl);
    item.addEventListener('click', () => {
      igsSelectedJobId = job.id;
      igsSelectedOutputId = null;
      igsRenderJobList();
      igsRenderJobDetail(job);
    });
    igsRefs.jobList.append(item);
  });
};

const igsRenderJobDetail = (job) => {
  if (!job) {
    igsRefs.jobDetail.classList.add('igs-hidden');
    return;
  }
  igsRefs.jobDetail.classList.remove('igs-hidden');
  igsRefs.jobDetailPre.textContent = JSON.stringify(
    {
      id: job.id,
      status: job.status,
      generationType: job.generationType,
      provider: job.providerLabel,
      prompt: job.prompt ? job.prompt.substring(0, 120) + (job.prompt.length > 120 ? '…' : '') : '',
      params: job.params,
      outputs: job.outputs.length,
      createdAt: job.createdAt,
      errorMessage: job.errorMessage || undefined
    },
    null,
    2
  );
  igsRenderOutputGallery(job.outputs, igsRefs.jobDetailGallery, igsSelectedOutputId);
  igsRefs.jobDetailGallery.querySelectorAll('.igs-output-thumb').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      igsSelectedJobId = job.id;
      igsSelectedOutputId = thumb.dataset.outputId;
      igsSwitchTab('studio');
      igsRenderCurrentJobGallery();
      igsSelectOutput(igsSelectedOutputId);
    });
  });
};

const igsPopulateSelectors = () => {
  renderOptions(igsRefs.characterSelect, projectCharacters(), selectedCharacterId(), 'Nenhum personagem');
  renderOptions(igsRefs.sceneSelect, projectScenes(), selectedSceneId(), 'Nenhuma cena');
  renderOptions(
    igsRefs.promptDocSelect,
    projectPromptDocuments().map((pd) => ({
      ...pd,
      name: `${pd.isOfficial ? '✓ ' : ''}${pd.isFavorite ? '★ ' : ''}${pd.title}`
    })),
    currentPromptDocument()?.id,
    'Nenhum prompt estruturado'
  );
};

const igsRunGeneration = async () => {
  if (igsIsRunning || !selectedProjectId()) return;
  const prompt = igsRefs.prompt.value.trim();
  if (!prompt) {
    igsSetStatus('Preencha o prompt antes de gerar.', 'error');
    return;
  }
  const config = igsProviderSettings();
  const params = igsReadParams();
  const providerLabels = { mock: 'Mock', 'local-api': 'API Local' };
  const job = createGenerationJob({
    projectId: selectedProjectId(),
    generationType: igsRefs.genType.value || 'character',
    characterId: igsRefs.characterSelect.value || '',
    sceneId: igsRefs.sceneSelect.value || '',
    promptDocumentId: igsRefs.promptDocSelect.value || '',
    prompt,
    negativePrompt: igsRefs.negativePrompt.value.trim(),
    referenceIds: igsSelectedReferenceIds(),
    params,
    providerType: config.type || 'mock',
    providerLabel: providerLabels[config.type] || config.type || 'Mock'
  });
  job.status = 'running';
  if (!state.generationJobs) state.generationJobs = [];
  state.generationJobs.push(job);
  igsSelectedJobId = job.id;
  state = store.save(state);
  igsSetRunning(true);
  igsSetStatus('Gerando…', 'running');

  let result;
  try {
    result = await runImageGeneration(
      { prompt, negativePrompt: igsRefs.negativePrompt.value.trim(), params },
      { ...config, ...params }
    );
  } catch (error) {
    result = { status: 'error', provider: config.type, error: error.message };
  }

  const savedJob = state.generationJobs.find((j) => j.id === job.id);
  if (!savedJob) {
    igsSetRunning(false);
    igsSetStatus('Job não encontrado após geração.', 'error');
    return;
  }

  if (result.status === 'done') {
    const outputs = (result.outputs || []).map((out) =>
      createGenerationOutput({
        projectId: selectedProjectId(),
        jobId: job.id,
        characterId: igsRefs.characterSelect.value || '',
        sceneId: igsRefs.sceneSelect.value || '',
        prompt,
        params,
        dataUrl: out.dataUrl || '',
        fileName: out.fileName || '',
        generationType: igsRefs.genType.value || 'character',
        seed: typeof out.seed === 'number' ? out.seed : -1
      })
    );
    savedJob.outputs = outputs;
    savedJob.status = 'done';
    savedJob.updatedAt = new Date().toISOString();

    if (igsRefs.seedLock.checked && outputs.length > 0) {
      const firstSeed = outputs[0].seed;
      if (firstSeed >= 0) igsRefs.seed.value = firstSeed;
    }

    igsSetStatus(`✓ ${outputs.length} imagem(ns) gerada(s).`, 'done');
    if (outputs.length) igsSelectedOutputId = outputs[0].id;
  } else {
    savedJob.status = 'error';
    savedJob.errorMessage = result.error || 'Erro desconhecido';
    savedJob.updatedAt = new Date().toISOString();
    igsSetStatus(`Erro: ${savedJob.errorMessage}`, 'error');
  }

  state = store.save(state);
  igsSetRunning(false);
  igsRenderCurrentJobGallery();
  if (igsSelectedOutputId) igsSelectOutput(igsSelectedOutputId);
};

const openImageGenStudio = () => {
  if (!selectedProjectId()) return;
  igsIsOpen = true;
  igsSelectedOutputId = null;
  igsCompareIds = [];
  igsSelectedJobId = null;
  igsPopulateSelectors();
  igsRenderReferenceList();
  igsLoadParamsFromConfig();
  igsLoadConfigTab();
  igsSwitchTab('studio');
  igsRefs.outputGallery.innerHTML = '<p class="igs-hint">Os outputs gerados aparecerão aqui.</p>';
  igsRefs.outputDetail.classList.add('igs-hidden');
  igsRefs.compareArea.innerHTML = '<p class="igs-hint">Selecione dois outputs para comparar. Use Shift+clique na galeria.</p>';
  igsSetStatus('');
  igsRenderJobList();
  igsRefs.overlay.classList.remove('igs-hidden');
  document.body.style.overflow = 'hidden';
};

const closeImageGenStudio = () => {
  igsIsOpen = false;
  igsRefs.overlay.classList.add('igs-hidden');
  document.body.style.overflow = '';
  render();
};

// Detail action handlers
igsRefs.detailFavoriteBtn.addEventListener('click', () => {
  const found = igsFindOutput(igsSelectedOutputId);
  if (!found) return;
  found.output.isFavorite = !found.output.isFavorite;
  state = store.save(state);
  igsSelectOutput(igsSelectedOutputId);
  igsRenderCurrentJobGallery();
});

igsRefs.detailCanonBtn.addEventListener('click', () => {
  const found = igsFindOutput(igsSelectedOutputId);
  if (!found) return;
  found.output.isCanonical = !found.output.isCanonical;
  state = store.save(state);
  igsSelectOutput(igsSelectedOutputId);
  igsRenderCurrentJobGallery();
});

igsRefs.detailUseAsRefBtn.addEventListener('click', () => {
  const found = igsFindOutput(igsSelectedOutputId);
  if (!found || !found.output.dataUrl) {
    alert('Output sem imagem disponível para usar como referência.');
    return;
  }
  const { output, job } = found;
  const characterId = output.characterId || igsRefs.characterSelect.value || '';
  const ref = createReferenceImage({
    projectId: selectedProjectId(),
    characterId,
    name: `Gerado · ${output.generationType} · seed ${output.seed >= 0 ? output.seed : 'rand'}`,
    type: output.generationType === 'character' || output.generationType === 'portrait' ? 'character' : 'scene',
    dataUrl: output.dataUrl,
    fileName: output.fileName || 'generated.png',
    isCanonical: output.isCanonical,
    linkedEntityId: characterId || output.sceneId || job.id,
    linkedEntityType: characterId ? 'character' : output.sceneId ? 'scene' : 'job',
    notes: `Criado pelo Estúdio de Geração · job ${job.id.substring(0, 8)}`
  });
  if (!state.referenceImages) state.referenceImages = [];
  state.referenceImages.push(ref);
  state = store.save(state);
  igsRenderReferenceList();
  alert(`Referência "${ref.name}" criada com sucesso.`);
});

igsRefs.detailVariationBtn.addEventListener('click', () => {
  const found = igsFindOutput(igsSelectedOutputId);
  if (!found) return;
  const { output } = found;
  igsRefs.prompt.value = output.prompt || igsRefs.prompt.value;
  const params = output.params || {};
  if (params.resolution) igsRefs.resolution.value = params.resolution;
  if (params.steps) igsRefs.steps.value = params.steps;
  if (params.cfgScale) igsRefs.cfgScale.value = params.cfgScale;
  if (params.sampler) igsRefs.sampler.value = params.sampler;
  igsRefs.seed.value = -1;
  igsRefs.seedLock.checked = false;
  igsSetStatus('Parâmetros carregados para variação. Ajuste e clique em Gerar.', '');
});

igsRefs.detailRegenerateBtn.addEventListener('click', () => {
  const found = igsFindOutput(igsSelectedOutputId);
  if (!found) return;
  const { output } = found;
  igsRefs.prompt.value = output.prompt || igsRefs.prompt.value;
  const params = output.params || {};
  if (params.resolution) igsRefs.resolution.value = params.resolution;
  if (params.steps) igsRefs.steps.value = params.steps;
  if (params.cfgScale) igsRefs.cfgScale.value = params.cfgScale;
  if (params.sampler) igsRefs.sampler.value = params.sampler;
  if (typeof output.seed === 'number' && output.seed >= 0) {
    igsRefs.seed.value = output.seed;
    igsRefs.seedLock.checked = true;
  }
  igsRunGeneration();
});

igsRefs.detailDeleteBtn.addEventListener('click', () => {
  const found = igsFindOutput(igsSelectedOutputId);
  if (!found || !window.confirm('Remover este output?')) return;
  state = deleteEntity(state, 'generationOutput', igsSelectedOutputId);
  state = store.save(state);
  igsSelectedOutputId = null;
  igsRefs.outputDetail.classList.add('igs-hidden');
  igsRenderCurrentJobGallery();
});

igsRefs.detailReviewBtn.addEventListener('click', () => {
  const outputId = igsSelectedOutputId;
  closeImageGenStudio();
  openImageReviewStudio();
  if (outputId) irsSelectOutput(outputId);
});

igsRefs.loadPromptBtn.addEventListener('click', () => {
  const promptDocument = state.promptDocuments.find(
    (pd) => pd.id === igsRefs.promptDocSelect.value
  );
  if (!promptDocument) return;
  const version =
    promptDocument.versions.find((v) => v.id === promptDocument.activeVersionId) ||
    promptDocument.versions[0];
  if (!version) return;
  const text =
    version.cinematicPrompt ||
    version.scenePrompt ||
    version.masterPrompt ||
    version.detailedPrompt ||
    version.shortPrompt ||
    '';
  igsRefs.prompt.value = text;
  if (version.negativePrompt) igsRefs.negativePrompt.value = version.negativePrompt;
  igsSetStatus('Prompt carregado.', 'done');
});

igsRefs.runBtn.addEventListener('click', igsRunGeneration);
igsRefs.runBtnMain.addEventListener('click', igsRunGeneration);

igsRefs.tabBtnStudio.addEventListener('click', () => igsSwitchTab('studio'));
igsRefs.tabBtnHistory.addEventListener('click', () => {
  igsRenderJobList();
  igsSwitchTab('history');
});
igsRefs.tabBtnConfig.addEventListener('click', () => {
  igsLoadConfigTab();
  igsSwitchTab('config');
});

igsRefs.closeBtn.addEventListener('click', closeImageGenStudio);

$('openImageGenStudioBtn').addEventListener('click', openImageGenStudio);

igsRefs.configSaveBtn.addEventListener('click', () => {
  const type = igsRefs.configType.value;
  const config = {
    type: IMAGE_GEN_PROVIDER_TYPES.includes(type) ? type : 'mock',
    endpoint: igsRefs.configEndpoint.value.trim() || 'http://127.0.0.1:7860',
    outputDir: igsProviderSettings().outputDir || 'outputs',
    resolution: igsRefs.configResolution.value.trim() || '512x768',
    steps: parseInt(igsRefs.configSteps.value, 10) || 28,
    cfgScale: parseFloat(igsRefs.configCfgScale.value) || 7,
    sampler: igsRefs.configSampler.value.trim() || 'DPM++ 2M Karras',
    numImages: parseInt(igsRefs.configNumImages.value, 10) || 1,
    seed: parseInt(igsRefs.configSeed.value, 10) ?? -1,
    seedLocked: igsRefs.configSeedLock.checked
  };
  state.settings = { ...state.settings, imageGenProvider: config };
  state = store.save(state);
  igsLoadParamsFromConfig();
  igsRefs.configStatus.textContent = 'Configuração salva.';
  igsRefs.configStatus.className = 'igs-status done';
  setTimeout(() => {
    igsRefs.configStatus.textContent = '';
    igsRefs.configStatus.className = 'igs-status';
  }, 2500);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !igsIsOpen) return;
  const active = document.activeElement;
  const isInput =
    active &&
    (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.tagName === 'SELECT');
  if (isInput) return;
  closeImageGenStudio();
});

// =========== Image Review Studio ===========

let irsIsOpen = false;
let irsSelectedOutputId = null;
let irsCompareIds = [];
let irsCanonModalOutputId = null;

const irsRefs = {
  overlay: $('imageReviewStudio'),
  closeBtn: $('irsCloseBtn'),
  openGenStudioBtn: $('irsOpenGenStudioBtn'),
  tabBtnReview: $('irsTabBtnReview'),
  tabBtnPromotions: $('irsTabBtnPromotions'),
  tabBtnDecisions: $('irsTabBtnDecisions'),
  tabReview: $('irsTabReview'),
  tabPromotions: $('irsTabPromotions'),
  tabDecisions: $('irsTabDecisions'),
  // Filters
  filterCharacter: $('irsFilterCharacter'),
  filterScene: $('irsFilterScene'),
  filterType: $('irsFilterType'),
  filterStatus: $('irsFilterStatus'),
  filterFavorite: $('irsFilterFavorite'),
  filterCanon: $('irsFilterCanon'),
  filterBestRef: $('irsFilterBestRef'),
  filterWithImage: $('irsFilterWithImage'),
  sortBy: $('irsSortBy'),
  applyFiltersBtn: $('irsApplyFiltersBtn'),
  filterCount: $('irsFilterCount'),
  // Gallery
  gallery: $('irsGallery'),
  compareArea: $('irsCompareArea'),
  clearCompareBtn: $('irsClearCompareBtn'),
  compareHint: $('irsCompareHint'),
  // Detail panel
  detailPanel: $('irsDetailPanel'),
  detailEmpty: $('irsDetailEmpty'),
  detailImg: $('irsDetailImg'),
  detailMeta: $('irsDetailMeta'),
  btnCandidate: $('irsBtnCandidate'),
  btnFavorite: $('irsBtnFavorite'),
  btnReject: $('irsBtnReject'),
  btnArchive: $('irsBtnArchive'),
  scoreStars: $('irsScoreStars'),
  scoreLabel: $('irsScoreLabel'),
  notesInput: $('irsNotesInput'),
  saveNotesBtn: $('irsSaveNotesBtn'),
  btnMarkCanon: $('irsBtnMarkCanon'),
  btnBestRef: $('irsBtnBestRef'),
  btnPromoteCanon: $('irsBtnPromoteCanon'),
  btnUseAsRef: $('irsBtnUseAsRef'),
  btnOpenInIGS: $('irsBtnOpenInIGS'),
  deleteOutputBtn: $('irsDeleteOutputBtn'),
  // Promotions
  promotionList: $('irsPromotionList'),
  promotionsCount: $('irsPromotionsCount'),
  // Decisions
  decisionScopeFilter: $('irsDecisionScopeFilter'),
  decisionStatusFilter: $('irsDecisionStatusFilter'),
  decisionOnlyLatestApproved: $('irsDecisionOnlyLatestApproved'),
  decisionItemFilter: $('irsDecisionItemFilter'),
  decisionApplyBtn: $('irsDecisionApplyBtn'),
  decisionCount: $('irsDecisionCount'),
  decisionList: $('irsDecisionList'),
  // Canon modal
  canonModal: $('irsCanonModal'),
  modalImg: $('irsModalImg'),
  canonType: $('irsCanonType'),
  canonTargetRow: $('irsCanonTargetRow'),
  canonTarget: $('irsCanonTarget'),
  canonReason: $('irsCanonReason'),
  canonNotes: $('irsCanonNotes'),
  canonCreateRef: $('irsCanonCreateRef'),
  canonConfirmBtn: $('irsCanonConfirmBtn'),
  canonCancelBtn: $('irsCanonCancelBtn'),
  btnSendRevision: $('irsBtnSendRevision'),
  supersedeTarget: $('irsSupersedeTarget'),
  btnSupersede: $('irsBtnSupersede')
};

// Helper: collect all outputs across all jobs for a project
const irsAllOutputs = () => {
  const projectId = selectedProjectId();
  const outputs = [];
  for (const job of (state.generationJobs || [])) {
    if (job.projectId !== projectId) continue;
    for (const output of (job.outputs || [])) {
      outputs.push({ output, job });
    }
  }
  return outputs;
};

const irsDecisionTypeLabels = {
  approve: 'Approve',
  reject: 'Reject',
  promote_to_canon: 'Promote to canon',
  supersede: 'Supersede',
  send_back_for_revision: 'Send back for revision',
  archive_deprecate: 'Archive / deprecate'
};

const irsDecisionScopeLabels = {
  asset: 'Asset',
  shot: 'Shot',
  scene: 'Scene',
  sequence: 'Sequence',
  briefing: 'Briefing',
  canon_entry: 'Canon entry',
  reference_visual: 'Visual reference'
};

const irsDecisionStatusLabels = {
  pending_review: 'Pending review',
  approved: 'Latest Approved',
  rejected: 'Rejected',
  current_official: 'Current official',
  superseded: 'Superseded',
  needs_revision: 'Needs revision',
  archived_deprecated: 'Archived/deprecated'
};

const irsDecisionStatusClass = (status) => {
  if (status === 'approved') return 'irs-decision-status-approved';
  if (status === 'current_official') return 'irs-decision-status-official';
  if (status === 'rejected') return 'irs-decision-status-rejected';
  if (status === 'superseded') return 'irs-decision-status-superseded';
  if (status === 'needs_revision') return 'irs-decision-status-needs-revision';
  if (status === 'pending_review') return 'irs-decision-status-pending';
  return 'irs-decision-status-archived';
};

const irsAllDecisionEvents = () => {
  const projectId = selectedProjectId();
  return (state.decisionHistory || []).filter((event) => event.projectId === projectId);
};

const irsFindPrimaryShotForOutput = (outputId) =>
  (state.shots || []).find((shot) => shot.projectId === selectedProjectId() && (shot.generationOutputIds || []).includes(outputId)) || null;

const irsBuildScopeTargetsForOutput = ({ output, job }) => {
  const targets = [{ scopeType: 'asset', scopeId: output.id }];
  if (output.sceneId) targets.push({ scopeType: 'scene', scopeId: output.sceneId });
  const shot = irsFindPrimaryShotForOutput(output.id);
  if (shot) {
    targets.push({ scopeType: 'shot', scopeId: shot.id });
    if (shot.beatId) targets.push({ scopeType: 'sequence', scopeId: shot.beatId });
  }
  const briefingId = job.promptDocumentId || '';
  if (briefingId) targets.push({ scopeType: 'briefing', scopeId: briefingId });
  const unique = new Map();
  targets.forEach((target) => {
    if (!target.scopeType || !target.scopeId) return;
    unique.set(`${target.scopeType}:${target.scopeId}`, target);
  });
  return [...unique.values()];
};

const irsRecordDecision = ({
  output,
  job,
  decisionType,
  resultingStatus,
  rationale = '',
  notes = '',
  relatedItemType = '',
  relatedItemId = '',
  extraScopes = []
}) => {
  if (!output || !job || !DECISION_TYPES.includes(decisionType) || !DECISION_RESULT_STATUSES.includes(resultingStatus)) return;
  if (!state.decisionHistory) state.decisionHistory = [];
  const baseScopes = irsBuildScopeTargetsForOutput({ output, job });
  const fullScopes = [...baseScopes, ...(Array.isArray(extraScopes) ? extraScopes : [])].filter(
    ({ scopeType, scopeId }) => DECISION_SCOPE_TYPES.includes(scopeType) && scopeId
  );
  const dedupedScopes = new Map();
  fullScopes.forEach((scope) => dedupedScopes.set(`${scope.scopeType}:${scope.scopeId}`, scope));
  dedupedScopes.forEach(({ scopeType, scopeId }) => {
    state.decisionHistory.push(
      createDecisionEvent({
        projectId: selectedProjectId(),
        decisionType,
        scopeType,
        scopeId,
        targetType: 'generationOutput',
        targetId: output.id,
        relatedItemType,
        relatedItemId,
        rationale,
        notes,
        resultingStatus
      })
    );
  });
  state = store.save(state);
};

const irsGetFilters = () => ({
  characterId: irsRefs.filterCharacter.value,
  sceneId: irsRefs.filterScene.value,
  type: irsRefs.filterType.value,
  status: irsRefs.filterStatus.value,
  onlyFavorite: irsRefs.filterFavorite.checked,
  onlyCanon: irsRefs.filterCanon.checked,
  onlyBestRef: irsRefs.filterBestRef.checked,
  onlyWithImage: irsRefs.filterWithImage.checked,
  sortBy: irsRefs.sortBy.value
});

const irsApplyFiltersAndSort = (entries, filters) => {
  let result = entries;
  if (filters.characterId) result = result.filter(({ output }) => output.characterId === filters.characterId);
  if (filters.sceneId) result = result.filter(({ output }) => output.sceneId === filters.sceneId);
  if (filters.type) result = result.filter(({ output }) => output.generationType === filters.type);
  if (filters.status) result = result.filter(({ output }) => output.reviewStatus === filters.status);
  if (filters.onlyFavorite) result = result.filter(({ output }) => output.isFavorite);
  if (filters.onlyCanon) result = result.filter(({ output }) => output.isCanonical);
  if (filters.onlyBestRef) result = result.filter(({ output }) => output.isBestReference);
  if (filters.onlyWithImage) result = result.filter(({ output }) => Boolean(output.dataUrl));

  result = result.slice();
  if (filters.sortBy === 'oldest') {
    result.sort((a, b) => a.output.createdAt.localeCompare(b.output.createdAt));
  } else if (filters.sortBy === 'score-desc') {
    result.sort((a, b) => b.output.score - a.output.score);
  } else if (filters.sortBy === 'score-asc') {
    result.sort((a, b) => a.output.score - b.output.score);
  } else if (filters.sortBy === 'type') {
    result.sort((a, b) => a.output.generationType.localeCompare(b.output.generationType));
  } else {
    result.sort((a, b) => b.output.createdAt.localeCompare(a.output.createdAt));
  }
  return result;
};

const irsPopulateFilterSelectors = () => {
  const projectId = selectedProjectId();
  const characters = (state.characters || []).filter((c) => c.projectId === projectId);
  const scenes = (state.scenes || []).filter((s) => s.projectId === projectId);

  const prevChar = irsRefs.filterCharacter.value;
  const prevScene = irsRefs.filterScene.value;

  irsRefs.filterCharacter.innerHTML = '<option value="">Todos</option>';
  characters.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === prevChar) opt.selected = true;
    irsRefs.filterCharacter.append(opt);
  });

  irsRefs.filterScene.innerHTML = '<option value="">Todas</option>';
  scenes.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.title;
    if (s.id === prevScene) opt.selected = true;
    irsRefs.filterScene.append(opt);
  });
};

const irsStatusBadgeText = (output) => {
  const badges = [];
  if (output.isFavorite) badges.push('★');
  if (output.isCanonical) badges.push('C');
  if (output.isBestReference) badges.push('⭐');
  if (output.reviewStatus === 'rejected') badges.push('✕');
  if (output.reviewStatus === 'archived') badges.push('📦');
  if (output.reviewStatus === 'candidate') badges.push('📋');
  return badges;
};

const irsRenderGallery = () => {
  const filters = irsGetFilters();
  const all = irsAllOutputs();
  const filtered = irsApplyFiltersAndSort(all, filters);

  irsRefs.filterCount.textContent = `${filtered.length} / ${all.length} outputs`;
  irsRefs.gallery.innerHTML = '';

  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'irs-gallery-empty';
    empty.textContent = all.length
      ? 'Nenhum output corresponde aos filtros aplicados.'
      : 'Nenhum output encontrado. Gere imagens no Estúdio de Geração.';
    irsRefs.gallery.append(empty);
    return;
  }

  filtered.forEach(({ output }) => {
    const thumb = document.createElement('div');
    const isSelected = irsSelectedOutputId === output.id;
    const isCompareA = irsCompareIds[0] === output.id;
    const isCompareB = irsCompareIds[1] === output.id;
    let cls = 'irs-output-thumb';
    if (isSelected) cls += ' irs-selected';
    if (isCompareA) cls += ' irs-compare-a';
    if (isCompareB) cls += ' irs-compare-b';
    thumb.className = cls;
    thumb.dataset.outputId = output.id;

    if (output.dataUrl) {
      const img = document.createElement('img');
      img.src = output.dataUrl;
      img.alt = 'Output';
      thumb.append(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'irs-output-thumb-placeholder';
      ph.textContent = '🖼';
      thumb.append(ph);
    }

    // badges
    const badges = irsStatusBadgeText(output);
    if (badges.length) {
      const badgesEl = document.createElement('div');
      badgesEl.className = 'irs-thumb-badges';
      if (output.isFavorite) {
        const b = document.createElement('span');
        b.className = 'irs-badge irs-badge-fav';
        b.textContent = '★';
        badgesEl.append(b);
      }
      if (output.isCanonical) {
        const b = document.createElement('span');
        b.className = 'irs-badge irs-badge-canon';
        b.textContent = 'C';
        badgesEl.append(b);
      }
      if (output.isBestReference) {
        const b = document.createElement('span');
        b.className = 'irs-badge irs-badge-best';
        b.textContent = '⭐';
        badgesEl.append(b);
      }
      if (output.reviewStatus === 'rejected') {
        const b = document.createElement('span');
        b.className = 'irs-badge irs-badge-rejected';
        b.textContent = '✕';
        badgesEl.append(b);
      } else if (output.reviewStatus === 'archived') {
        const b = document.createElement('span');
        b.className = 'irs-badge irs-badge-archived';
        b.textContent = '📦';
        badgesEl.append(b);
      } else if (output.reviewStatus === 'candidate') {
        const b = document.createElement('span');
        b.className = 'irs-badge irs-badge-candidate';
        b.textContent = '📋';
        badgesEl.append(b);
      }
      thumb.append(badgesEl);
    }

    if (output.score > 0) {
      const scoreEl = document.createElement('div');
      scoreEl.className = 'irs-thumb-score';
      scoreEl.textContent = '★'.repeat(output.score);
      thumb.append(scoreEl);
    }

    thumb.addEventListener('click', (event) => {
      if (event.shiftKey) {
        irsHandleCompareClick(output.id);
      } else {
        irsSelectOutput(output.id);
      }
    });

    irsRefs.gallery.append(thumb);
  });
};

const irsHandleCompareClick = (outputId) => {
  if (irsCompareIds.includes(outputId)) {
    irsCompareIds = irsCompareIds.filter((id) => id !== outputId);
  } else if (irsCompareIds.length < 2) {
    irsCompareIds = [...irsCompareIds, outputId];
  } else {
    irsCompareIds = [irsCompareIds[1], outputId];
  }
  irsRenderGallery();
  irsRenderCompare();
};

const irsRenderCompare = () => {
  if (!irsCompareIds.length) {
    irsRefs.compareArea.style.display = 'none';
    irsRefs.clearCompareBtn.style.display = 'none';
    return;
  }
  irsRefs.compareArea.style.display = 'flex';
  irsRefs.clearCompareBtn.style.display = '';
  irsRefs.compareArea.innerHTML = '';
  irsCompareIds.forEach((id, idx) => {
    const found = irsFindOutput(id);
    if (!found) return;
    const { output } = found;
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:4px;min-width:0';
    const label = document.createElement('div');
    label.style.cssText = 'font-size:0.7rem;color:var(--muted);font-weight:700;text-transform:uppercase';
    label.textContent = idx === 0 ? 'A' : 'B';
    wrapper.append(label);
    if (output.dataUrl) {
      const img = document.createElement('img');
      img.src = output.dataUrl;
      img.alt = `Output ${idx + 1}`;
      img.title = `seed: ${output.seed}`;
      img.style.cssText = 'width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:6px;border:1px solid var(--line);background:#111722';
      wrapper.append(img);
    }
    const meta = document.createElement('div');
    meta.style.cssText = 'font-size:0.68rem;color:var(--muted)';
    meta.textContent = [
      output.generationType,
      output.score > 0 ? '★'.repeat(output.score) : '',
      output.isFavorite ? 'fav' : '',
      output.isCanonical ? 'canon' : ''
    ].filter(Boolean).join(' · ');
    wrapper.append(meta);
    irsRefs.compareArea.append(wrapper);
  });
  if (!irsRefs.compareArea.children.length) {
    irsRefs.compareArea.innerHTML = '<p class="irs-hint">Outputs não encontrados para comparação.</p>';
  }
};

const irsFindOutput = (outputId) => {
  for (const job of (state.generationJobs || [])) {
    const output = (job.outputs || []).find((o) => o.id === outputId);
    if (output) return { job, output };
  }
  return null;
};

const irsScopeItemLabel = (scopeType, scopeId) => {
  if (!scopeId) return '—';
  if (scopeType === 'asset') {
    const found = irsFindOutput(scopeId);
    const output = found?.output;
    if (!output) return `Output ${scopeId.substring(0, 8)}`;
    return output.fileName || `Output ${output.seed >= 0 ? `seed ${output.seed}` : scopeId.substring(0, 8)}`;
  }
  if (scopeType === 'shot') {
    return (state.shots || []).find((shot) => shot.id === scopeId)?.title || `Shot ${scopeId.substring(0, 8)}`;
  }
  if (scopeType === 'scene') {
    return (state.scenes || []).find((scene) => scene.id === scopeId)?.title || `Scene ${scopeId.substring(0, 8)}`;
  }
  if (scopeType === 'sequence') {
    return (state.beats || []).find((beat) => beat.id === scopeId)?.title || `Sequence ${scopeId.substring(0, 8)}`;
  }
  if (scopeType === 'briefing') {
    return (state.promptDocuments || []).find((doc) => doc.id === scopeId)?.title || `Briefing ${scopeId.substring(0, 8)}`;
  }
  if (scopeType === 'canon_entry') {
    const characterName = (state.characters || []).find((character) => character.id === scopeId)?.name;
    if (characterName) return `Character canon · ${characterName}`;
    const sceneTitle = (state.scenes || []).find((scene) => scene.id === scopeId)?.title;
    if (sceneTitle) return `Scene canon · ${sceneTitle}`;
    const loreTitle = (state.loreEntries || []).find((entry) => entry.id === scopeId)?.title;
    if (loreTitle) return `Universe canon · ${loreTitle}`;
    return `Canon entry ${scopeId.substring(0, 8)}`;
  }
  if (scopeType === 'reference_visual') {
    return (state.referenceImages || []).find((reference) => reference.id === scopeId)?.name || `Ref ${scopeId.substring(0, 8)}`;
  }
  return scopeId;
};

const irsOutputDisplayName = (output) => output.fileName || `Output ${output.id.substring(0, 8)}`;

const irsPopulateSupersedeTargets = () => {
  const currentId = irsSelectedOutputId || '';
  const all = irsAllOutputs().map(({ output }) => output).filter((output) => output.id !== currentId);
  irsRefs.supersedeTarget.innerHTML = '<option value="">- escolher substituto -</option>';
  all.forEach((output) => {
    const option = document.createElement('option');
    option.value = output.id;
    option.textContent = `${irsOutputDisplayName(output)} · ${output.generationType} · ${new Date(output.createdAt).toLocaleDateString('pt-BR')}`;
    irsRefs.supersedeTarget.append(option);
  });
};

const irsRenderStars = (score) => {
  const stars = irsRefs.scoreStars.querySelectorAll('.irs-star-btn');
  stars.forEach((btn) => {
    const val = parseInt(btn.dataset.star, 10);
    btn.classList.toggle('filled', val <= score);
  });
  irsRefs.scoreLabel.textContent = score > 0 ? `${score}/5` : 'Sem pontuação';
};

const irsUpdateStatusButtonStates = (output) => {
  irsRefs.btnCandidate.classList.toggle('irs-status-btn-active', output.reviewStatus === 'candidate');
  irsRefs.btnFavorite.classList.toggle('active', output.isFavorite);
  irsRefs.btnFavorite.classList.toggle('irs-status-btn-fav', true);
  irsRefs.btnReject.classList.toggle('active', output.reviewStatus === 'rejected');
  irsRefs.btnReject.classList.toggle('irs-status-btn-reject', true);
  irsRefs.btnArchive.classList.toggle('active', output.reviewStatus === 'archived');
  irsRefs.btnArchive.classList.toggle('irs-status-btn-archive', true);
  irsRefs.btnMarkCanon.classList.toggle('active', output.isCanonical);
  irsRefs.btnMarkCanon.classList.toggle('irs-status-btn-canon', true);
  irsRefs.btnBestRef.classList.toggle('active', output.isBestReference);
  irsRefs.btnBestRef.classList.toggle('irs-status-btn-best', true);
  irsRefs.btnMarkCanon.textContent = output.isCanonical ? '✓ Canônico' : '◇ Canônico';
  irsRefs.btnBestRef.textContent = output.isBestReference ? '⭐ Melhor ref.' : '⭐ Melhor ref.?';
};

const irsSelectOutput = (outputId) => {
  irsSelectedOutputId = outputId;
  irsRenderGallery();

  const found = irsFindOutput(outputId);
  if (!found) {
    irsRefs.detailPanel.classList.add('irs-hidden');
    irsRefs.detailEmpty.style.display = '';
    return;
  }

  const { output, job } = found;
  irsRefs.detailEmpty.style.display = 'none';
  irsRefs.detailPanel.classList.remove('irs-hidden');

  irsRefs.detailImg.src = output.dataUrl || '';
  irsRefs.detailImg.style.display = output.dataUrl ? 'block' : 'none';

  const characterName = output.characterId
    ? (state.characters || []).find((c) => c.id === output.characterId)?.name || output.characterId
    : '';
  const sceneName = output.sceneId
    ? (state.scenes || []).find((s) => s.id === output.sceneId)?.title || output.sceneId
    : '';

  irsRefs.detailMeta.textContent = [
    `Tipo: ${output.generationType}`,
    characterName ? `Personagem: ${characterName}` : '',
    sceneName ? `Cena: ${sceneName}` : '',
    `Seed: ${output.seed >= 0 ? output.seed : 'aleatório'}`,
    output.fileName ? `Arquivo: ${output.fileName}` : '',
    `Job: ${job.id.substring(0, 8)}`,
    `${new Date(output.createdAt).toLocaleString('pt-BR')}`
  ].filter(Boolean).join('\n');

  irsUpdateStatusButtonStates(output);
  irsRenderStars(output.score || 0);
  irsRefs.notesInput.value = output.notes || '';
  irsPopulateSupersedeTargets();
};

const irsUpdateOutput = (outputId, updater) => {
  for (const job of (state.generationJobs || [])) {
    const output = (job.outputs || []).find((o) => o.id === outputId);
    if (output) {
      updater(output);
      break;
    }
  }
  state = store.save(state);
};

const irsRefreshDetail = () => {
  if (irsSelectedOutputId) irsSelectOutput(irsSelectedOutputId);
  irsRenderGallery();
};

// Status action handlers
irsRefs.btnCandidate.addEventListener('click', () => {
  const found = irsFindOutput(irsSelectedOutputId);
  if (!found) return;
  const newStatus = found.output.reviewStatus === 'candidate' ? 'unreviewed' : 'candidate';
  irsUpdateOutput(irsSelectedOutputId, (o) => { o.reviewStatus = newStatus; });
  irsRecordDecision({
    output: found.output,
    job: found.job,
    decisionType: 'send_back_for_revision',
    resultingStatus: newStatus === 'candidate' ? 'needs_revision' : 'pending_review',
    rationale: newStatus === 'candidate' ? 'Output enviado de volta para revisão.' : 'Output voltou para fila de revisão.',
    notes: found.output.notes || ''
  });
  irsRefreshDetail();
});

irsRefs.btnFavorite.addEventListener('click', () => {
  const found = irsFindOutput(irsSelectedOutputId);
  if (!found) return;
  let approved = false;
  irsUpdateOutput(irsSelectedOutputId, (o) => {
    o.isFavorite = !o.isFavorite;
    if (o.isFavorite) o.reviewStatus = 'favorite';
    else if (o.reviewStatus === 'favorite') o.reviewStatus = 'unreviewed';
    approved = o.isFavorite;
  });
  irsRecordDecision({
    output: found.output,
    job: found.job,
    decisionType: approved ? 'approve' : 'send_back_for_revision',
    resultingStatus: approved ? 'approved' : 'pending_review',
    rationale: approved ? 'Output aprovado como favorito editorial.' : 'Output removido dos favoritos e voltou para revisão.',
    notes: found.output.notes || ''
  });
  irsRefreshDetail();
});

irsRefs.btnReject.addEventListener('click', () => {
  const found = irsFindOutput(irsSelectedOutputId);
  if (!found) return;
  const newStatus = found.output.reviewStatus === 'rejected' ? 'unreviewed' : 'rejected';
  irsUpdateOutput(irsSelectedOutputId, (o) => {
    o.reviewStatus = newStatus;
    if (newStatus === 'rejected') o.isFavorite = false;
  });
  irsRecordDecision({
    output: found.output,
    job: found.job,
    decisionType: 'reject',
    resultingStatus: newStatus === 'rejected' ? 'rejected' : 'pending_review',
    rationale: newStatus === 'rejected' ? 'Output rejeitado na curadoria editorial.' : 'Rejeição removida; output voltou para revisão.',
    notes: found.output.notes || ''
  });
  irsRefreshDetail();
});

irsRefs.btnArchive.addEventListener('click', () => {
  const found = irsFindOutput(irsSelectedOutputId);
  if (!found) return;
  const newStatus = found.output.reviewStatus === 'archived' ? 'unreviewed' : 'archived';
  irsUpdateOutput(irsSelectedOutputId, (o) => { o.reviewStatus = newStatus; });
  irsRecordDecision({
    output: found.output,
    job: found.job,
    decisionType: 'archive_deprecate',
    resultingStatus: newStatus === 'archived' ? 'archived_deprecated' : 'pending_review',
    rationale: newStatus === 'archived' ? 'Output arquivado/depreciado.' : 'Output desarquivado para revisão.',
    notes: found.output.notes || ''
  });
  irsRefreshDetail();
});

// Star scoring
irsRefs.scoreStars.querySelectorAll('.irs-star-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const val = parseInt(btn.dataset.star, 10);
    const found = irsFindOutput(irsSelectedOutputId);
    if (!found) return;
    const newScore = found.output.score === val ? 0 : val;
    irsUpdateOutput(irsSelectedOutputId, (o) => { o.score = newScore; });
    irsRenderStars(newScore);
    irsRenderGallery();
  });
  btn.addEventListener('mouseenter', () => {
    const val = parseInt(btn.dataset.star, 10);
    irsRefs.scoreStars.querySelectorAll('.irs-star-btn').forEach((s) => {
      s.classList.toggle('filled', parseInt(s.dataset.star, 10) <= val);
    });
  });
  btn.addEventListener('mouseleave', () => {
    const found = irsFindOutput(irsSelectedOutputId);
    irsRenderStars(found ? found.output.score || 0 : 0);
  });
});

irsRefs.saveNotesBtn.addEventListener('click', () => {
  if (!irsSelectedOutputId) return;
  irsUpdateOutput(irsSelectedOutputId, (o) => { o.notes = irsRefs.notesInput.value.trim(); });
  irsRefs.saveNotesBtn.textContent = '✓ Salvo';
  setTimeout(() => { irsRefs.saveNotesBtn.textContent = 'Salvar notas'; }, 1800);
});

irsRefs.btnMarkCanon.addEventListener('click', () => {
  const found = irsFindOutput(irsSelectedOutputId);
  if (!found) return;
  let nowCanonical = false;
  irsUpdateOutput(irsSelectedOutputId, (o) => {
    o.isCanonical = !o.isCanonical;
    nowCanonical = o.isCanonical;
  });
  const canonScopeId = found.output.sceneId || found.output.characterId;
  irsRecordDecision({
    output: found.output,
    job: found.job,
    decisionType: nowCanonical ? 'promote_to_canon' : 'send_back_for_revision',
    resultingStatus: nowCanonical ? 'current_official' : 'pending_review',
    rationale: nowCanonical ? 'Output marcado como canônico.' : 'Output removido do estado canônico.',
    notes: found.output.notes || '',
    extraScopes: nowCanonical && canonScopeId ? [{ scopeType: 'canon_entry', scopeId: canonScopeId }] : []
  });
  irsRefreshDetail();
});

irsRefs.btnBestRef.addEventListener('click', () => {
  const found = irsFindOutput(irsSelectedOutputId);
  if (!found) return;
  irsUpdateOutput(irsSelectedOutputId, (o) => { o.isBestReference = !o.isBestReference; });
  irsRecordDecision({
    output: found.output,
    job: found.job,
    decisionType: found.output.isBestReference ? 'approve' : 'send_back_for_revision',
    resultingStatus: found.output.isBestReference ? 'approved' : 'pending_review',
    rationale: found.output.isBestReference
      ? 'Output marcado como melhor referência visual.'
      : 'Output removido da seleção de melhor referência.',
    notes: found.output.notes || ''
  });
  irsRefreshDetail();
});

irsRefs.btnSendRevision.addEventListener('click', () => {
  const found = irsFindOutput(irsSelectedOutputId);
  if (!found) return;
  irsUpdateOutput(irsSelectedOutputId, (o) => {
    o.reviewStatus = 'candidate';
    o.isFavorite = false;
  });
  irsRecordDecision({
    output: found.output,
    job: found.job,
    decisionType: 'send_back_for_revision',
    resultingStatus: 'needs_revision',
    rationale: 'Output devolvido para revisão editorial.',
    notes: found.output.notes || ''
  });
  irsRefreshDetail();
});

irsRefs.btnSupersede.addEventListener('click', () => {
  const found = irsFindOutput(irsSelectedOutputId);
  if (!found) return;
  const replacementId = irsRefs.supersedeTarget.value;
  if (!replacementId) {
    alert('Selecione um output substituto para registrar supersessão.');
    return;
  }
  const replacementFound = irsFindOutput(replacementId);
  if (!replacementFound) {
    alert('Output substituto não encontrado.');
    return;
  }
  irsUpdateOutput(irsSelectedOutputId, (o) => {
    o.reviewStatus = 'archived';
    o.isCanonical = false;
  });
  irsUpdateOutput(replacementId, (o) => {
    o.reviewStatus = o.reviewStatus === 'rejected' ? 'candidate' : o.reviewStatus;
    o.isCanonical = true;
  });
  irsRecordDecision({
    output: found.output,
    job: found.job,
    decisionType: 'supersede',
    resultingStatus: 'superseded',
    relatedItemType: 'generationOutput',
    relatedItemId: replacementId,
    rationale: 'Output supersedido por substituto definido na revisão.',
    notes: found.output.notes || '',
    extraScopes: [{ scopeType: 'asset', scopeId: replacementId }]
  });
  irsRecordDecision({
    output: replacementFound.output,
    job: replacementFound.job,
    decisionType: 'promote_to_canon',
    resultingStatus: 'current_official',
    relatedItemType: 'generationOutput',
    relatedItemId: irsSelectedOutputId,
    rationale: 'Output promovido como substituto oficial.',
    notes: replacementFound.output.notes || ''
  });
  irsRefreshDetail();
});

// Canon promotion flow
const irsOpenCanonModal = (outputId) => {
  const found = irsFindOutput(outputId);
  if (!found) return;
  const { output } = found;
  irsCanonModalOutputId = outputId;
  irsRefs.modalImg.src = output.dataUrl || '';
  irsRefs.modalImg.style.display = output.dataUrl ? 'block' : 'none';
  irsRefs.canonReason.value = '';
  irsRefs.canonNotes.value = output.notes || '';
  irsRefs.canonCreateRef.checked = true;
  irsPopulateCanonTargetSelect(irsRefs.canonType.value);
  irsRefs.canonModal.classList.remove('irs-hidden');
};

const irsPopulateCanonTargetSelect = (canonType) => {
  const projectId = selectedProjectId();
  irsRefs.canonTarget.innerHTML = '<option value="">— nenhuma —</option>';
  if (canonType === 'character') {
    (state.characters || []).filter((c) => c.projectId === projectId).forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      irsRefs.canonTarget.append(opt);
    });
    irsRefs.canonTargetRow.style.display = '';
  } else if (canonType === 'scene') {
    (state.scenes || []).filter((s) => s.projectId === projectId).forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.title;
      irsRefs.canonTarget.append(opt);
    });
    irsRefs.canonTargetRow.style.display = '';
  } else if (canonType === 'place') {
    (state.loreEntries || []).filter((e) => e.projectId === projectId).forEach((e) => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.title;
      irsRefs.canonTarget.append(opt);
    });
    irsRefs.canonTargetRow.style.display = '';
  } else {
    irsRefs.canonTargetRow.style.display = 'none';
  }

  // Pre-select based on output's linked entity
  const found = irsFindOutput(irsCanonModalOutputId);
  if (found) {
    const { output } = found;
    if (canonType === 'character' && output.characterId) {
      irsRefs.canonTarget.value = output.characterId;
    } else if (canonType === 'scene' && output.sceneId) {
      irsRefs.canonTarget.value = output.sceneId;
    }
  }
};

irsRefs.canonType.addEventListener('change', () => {
  irsPopulateCanonTargetSelect(irsRefs.canonType.value);
});

irsRefs.btnPromoteCanon.addEventListener('click', () => {
  if (!irsSelectedOutputId) return;
  irsOpenCanonModal(irsSelectedOutputId);
});

irsRefs.canonCancelBtn.addEventListener('click', () => {
  irsRefs.canonModal.classList.add('irs-hidden');
  irsCanonModalOutputId = null;
});

irsRefs.canonConfirmBtn.addEventListener('click', () => {
  if (!irsCanonModalOutputId) return;
  const found = irsFindOutput(irsCanonModalOutputId);
  if (!found) return;
  const { output, job } = found;

  const canonType = irsRefs.canonType.value;
  const targetId = irsRefs.canonTarget.value;
  const targetType = canonType === 'character' ? 'character' : canonType === 'scene' ? 'scene' : canonType === 'place' ? 'lore' : '';
  const reason = irsRefs.canonReason.value.trim();
  const notes = irsRefs.canonNotes.value.trim();

  if (!reason) {
    alert('Por favor, preencha o motivo da promoção.');
    return;
  }

  // Mark output as canonical
  irsUpdateOutput(irsCanonModalOutputId, (o) => {
    o.isCanonical = true;
    o.reviewStatus = OUTPUT_REVIEW_STATUSES.includes(o.reviewStatus) ? o.reviewStatus : 'unreviewed';
  });

  // Create canon promotion record
  const promotion = createCanonPromotion({
    projectId: selectedProjectId(),
    outputId: irsCanonModalOutputId,
    jobId: job.id,
    canonType,
    targetId,
    targetType,
    reason,
    notes
  });
  if (!state.canonPromotions) state.canonPromotions = [];
  state.canonPromotions.push(promotion);
  const promotionScopes = [{ scopeType: 'canon_entry', scopeId: targetId || promotion.id }];

  // Optionally create reference image
  if (irsRefs.canonCreateRef.checked && output.dataUrl) {
    const targetName = (() => {
      if (canonType === 'character') {
        return (state.characters || []).find((c) => c.id === targetId)?.name || '';
      } else if (canonType === 'scene') {
        return (state.scenes || []).find((s) => s.id === targetId)?.title || '';
      } else if (canonType === 'place') {
        return (state.loreEntries || []).find((e) => e.id === targetId)?.title || '';
      }
      return '';
    })();
    const refName = `Canon ${canonType}${targetName ? ` · ${targetName}` : ''} · ${new Date().toLocaleDateString('pt-BR')}`;
    const ref = createReferenceImage({
      projectId: selectedProjectId(),
      characterId: canonType === 'character' ? targetId : '',
      name: refName,
      type: canonType === 'aesthetic' ? 'aesthetic' : canonType,
      dataUrl: output.dataUrl,
      fileName: output.fileName || 'canon.png',
      isCanonical: true,
      linkedEntityId: targetId || job.id,
      linkedEntityType: targetType || 'job',
      preserve: `Promovido ao canon: ${reason}`,
      notes: notes || `Canon promotion via Image Review Studio · job ${job.id.substring(0, 8)}`
    });
    if (!state.referenceImages) state.referenceImages = [];
    state.referenceImages.push(ref);
    promotionScopes.push({ scopeType: 'reference_visual', scopeId: ref.id });
  }

  state = store.save(state);
  irsRecordDecision({
    output: found.output,
    job: found.job,
    decisionType: 'promote_to_canon',
    resultingStatus: 'current_official',
    rationale: reason,
    notes,
    extraScopes: promotionScopes
  });
  irsRefs.canonModal.classList.add('irs-hidden');
  irsCanonModalOutputId = null;
  irsRefreshDetail();
  irsRenderPromotionsList();

  // Switch to promotions tab to show result
  irsSwitchTab('promotions');
});

// Use as reference
irsRefs.btnUseAsRef.addEventListener('click', () => {
  const found = irsFindOutput(irsSelectedOutputId);
  if (!found || !found.output.dataUrl) {
    alert('Output sem imagem disponível para usar como referência.');
    return;
  }
  const { output, job } = found;
  const characterId = output.characterId || '';
  const ref = createReferenceImage({
    projectId: selectedProjectId(),
    characterId,
    name: `Ref · ${output.generationType} · seed ${output.seed >= 0 ? output.seed : 'rand'}`,
    type: output.generationType === 'character' || output.generationType === 'portrait' ? 'character' : 'scene',
    dataUrl: output.dataUrl,
    fileName: output.fileName || 'generated.png',
    isCanonical: output.isCanonical,
    linkedEntityId: characterId || output.sceneId || job.id,
    linkedEntityType: characterId ? 'character' : output.sceneId ? 'scene' : 'job',
    notes: `Criado pelo Estúdio de Revisão · job ${job.id.substring(0, 8)}`
  });
  if (!state.referenceImages) state.referenceImages = [];
  state.referenceImages.push(ref);
  state = store.save(state);
  irsRecordDecision({
    output: found.output,
    job: found.job,
    decisionType: 'approve',
    resultingStatus: found.output.isCanonical ? 'current_official' : 'approved',
    rationale: 'Output reutilizado como referência visual.',
    notes: found.output.notes || '',
    extraScopes: [{ scopeType: 'reference_visual', scopeId: ref.id }]
  });
  alert(`Referência "${ref.name}" criada com sucesso.`);
});

// Open in generation studio
irsRefs.btnOpenInIGS.addEventListener('click', () => {
  const found = irsFindOutput(irsSelectedOutputId);
  if (!found) return;
  const { output } = found;
  closeImageReviewStudio();
  openImageGenStudio();
  igsRefs.prompt.value = output.prompt || '';
  if (output.params) {
    if (output.params.resolution) igsRefs.resolution.value = output.params.resolution;
    if (output.params.steps) igsRefs.steps.value = output.params.steps;
    if (output.params.cfgScale) igsRefs.cfgScale.value = output.params.cfgScale;
    if (output.params.sampler) igsRefs.sampler.value = output.params.sampler;
  }
  igsRefs.seed.value = (typeof output.seed === 'number' && output.seed >= 0) ? output.seed : -1;
});

irsRefs.deleteOutputBtn.addEventListener('click', () => {
  if (!irsSelectedOutputId || !window.confirm('Remover este output permanentemente?')) return;
  state = deleteEntity(state, 'generationOutput', irsSelectedOutputId);
  state = store.save(state);
  irsSelectedOutputId = null;
  irsRefs.detailPanel.classList.add('irs-hidden');
  irsRefs.detailEmpty.style.display = '';
  irsRenderGallery();
});

// Promotions list rendering
const irsRenderPromotionsList = () => {
  const projectId = selectedProjectId();
  const promotions = ((state.canonPromotions || []).filter((p) => p.projectId === projectId))
    .slice().reverse();

  irsRefs.promotionsCount.textContent = `${promotions.length} promoção(ões)`;
  irsRefs.promotionList.innerHTML = '';

  if (!promotions.length) {
    irsRefs.promotionList.innerHTML = '<p class="irs-hint">Nenhuma promoção canônica registrada ainda. Promova uma imagem clicando em "⬆ Promover ao canon" na aba Revisão.</p>';
    return;
  }

  promotions.forEach((promotion) => {
    const found = irsFindOutput(promotion.outputId);
    const output = found ? found.output : null;

    const item = document.createElement('div');
    item.className = 'irs-promotion-item';

    // Thumbnail
    const thumbEl = document.createElement('div');
    thumbEl.className = 'irs-promotion-thumb';
    if (output && output.dataUrl) {
      const img = document.createElement('img');
      img.src = output.dataUrl;
      img.alt = 'Canon';
      thumbEl.append(img);
    } else {
      thumbEl.style.cssText += ';display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:var(--muted)';
      thumbEl.textContent = '🖼';
    }

    // Info
    const info = document.createElement('div');
    info.className = 'irs-promotion-info';

    const canonTypeEl = document.createElement('span');
    canonTypeEl.className = `irs-promotion-canon-type irs-canon-type-${promotion.canonType}`;
    const typeLabels = { character: 'Personagem', place: 'Lugar', scene: 'Cena', aesthetic: 'Estética' };
    canonTypeEl.textContent = typeLabels[promotion.canonType] || promotion.canonType;

    const targetEl = document.createElement('div');
    targetEl.className = 'irs-promotion-target';
    let targetName = '';
    if (promotion.canonType === 'character' && promotion.targetId) {
      targetName = (state.characters || []).find((c) => c.id === promotion.targetId)?.name || promotion.targetId;
    } else if (promotion.canonType === 'scene' && promotion.targetId) {
      targetName = (state.scenes || []).find((s) => s.id === promotion.targetId)?.title || promotion.targetId;
    } else if (promotion.canonType === 'place' && promotion.targetId) {
      targetName = (state.loreEntries || []).find((e) => e.id === promotion.targetId)?.title || promotion.targetId;
    }
    targetEl.textContent = targetName || '—';

    const reasonEl = document.createElement('div');
    reasonEl.className = 'irs-promotion-reason';
    reasonEl.textContent = promotion.reason || 'Sem motivo registrado.';

    const dateEl = document.createElement('div');
    dateEl.className = 'irs-promotion-date';
    dateEl.textContent = new Date(promotion.promotedAt).toLocaleString('pt-BR');

    if (promotion.notes) {
      const notesEl = document.createElement('div');
      notesEl.style.cssText = 'font-size:0.73rem;color:var(--muted);font-style:italic';
      notesEl.textContent = promotion.notes;
      info.append(canonTypeEl, targetEl, reasonEl, notesEl, dateEl);
    } else {
      info.append(canonTypeEl, targetEl, reasonEl, dateEl);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'irs-promotion-actions';

    if (output) {
      const viewBtn = document.createElement('button');
      viewBtn.textContent = '👁 Ver';
      viewBtn.addEventListener('click', () => {
        irsSwitchTab('review');
        irsSelectOutput(promotion.outputId);
      });
      actions.append(viewBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'irs-danger-btn';
    delBtn.textContent = '🗑';
    delBtn.title = 'Remover promoção';
    delBtn.addEventListener('click', () => {
      if (!window.confirm('Remover este registro de promoção canônica?')) return;
      state = deleteEntity(state, 'canonPromotion', promotion.id);
      state = store.save(state);
      irsRenderPromotionsList();
    });
    actions.append(delBtn);

    item.append(thumbEl, info, actions);
    irsRefs.promotionList.append(item);
  });
};

const irsPopulateDecisionItemFilter = () => {
  const previous = irsRefs.decisionItemFilter.value;
  const catalog = new Map();
  (irsAllDecisionEvents() || []).forEach((event) => {
    const key = `${event.scopeType}:${event.scopeId}`;
    if (!catalog.has(key)) {
      catalog.set(key, {
        key,
        scopeType: event.scopeType,
        scopeId: event.scopeId,
        label: `${irsDecisionScopeLabels[event.scopeType] || event.scopeType} · ${irsScopeItemLabel(event.scopeType, event.scopeId)}`
      });
    }
  });
  irsRefs.decisionItemFilter.innerHTML = '<option value="">Todos os itens</option>';
  [...catalog.values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
    .forEach((entry) => {
      const option = document.createElement('option');
      option.value = entry.key;
      option.textContent = entry.label;
      if (entry.key === previous) option.selected = true;
      irsRefs.decisionItemFilter.append(option);
    });
};

const irsFilteredDecisionEvents = () => {
  const scopeFilter = irsRefs.decisionScopeFilter.value;
  const statusFilter = irsRefs.decisionStatusFilter.value;
  const itemFilter = irsRefs.decisionItemFilter.value;
  const onlyLatestApproved = irsRefs.decisionOnlyLatestApproved.checked;
  const all = irsAllDecisionEvents().slice().sort((a, b) => b.happenedAt.localeCompare(a.happenedAt));
  const latestApprovedByScope = new Map();
  all.forEach((event) => {
    if (event.resultingStatus !== 'approved' && event.resultingStatus !== 'current_official') return;
    const key = `${event.scopeType}:${event.scopeId}`;
    if (!latestApprovedByScope.has(key)) latestApprovedByScope.set(key, event.id);
  });

  let filtered = all;
  if (scopeFilter) filtered = filtered.filter((event) => event.scopeType === scopeFilter);
  if (statusFilter) filtered = filtered.filter((event) => event.resultingStatus === statusFilter);
  if (itemFilter) filtered = filtered.filter((event) => `${event.scopeType}:${event.scopeId}` === itemFilter);
  if (onlyLatestApproved) {
    filtered = filtered.filter((event) => latestApprovedByScope.get(`${event.scopeType}:${event.scopeId}`) === event.id);
  }
  return { filtered, allCount: all.length, latestApprovedByScope };
};

const irsRenderDecisionHistory = () => {
  irsPopulateDecisionItemFilter();
  const { filtered, allCount, latestApprovedByScope } = irsFilteredDecisionEvents();
  irsRefs.decisionCount.textContent = `${filtered.length} / ${allCount} decisão(ões)`;
  irsRefs.decisionList.innerHTML = '';
  if (!filtered.length) {
    irsRefs.decisionList.innerHTML = '<p class="irs-hint">Nenhum evento de decisão encontrado para os filtros atuais.</p>';
    return;
  }

  filtered.forEach((event) => {
    const row = document.createElement('article');
    row.className = 'irs-decision-item';

    const header = document.createElement('div');
    header.className = 'irs-decision-header';

    const type = document.createElement('span');
    type.className = 'irs-decision-type';
    type.textContent = irsDecisionTypeLabels[event.decisionType] || event.decisionType;

    const status = document.createElement('span');
    status.className = `irs-decision-status ${irsDecisionStatusClass(event.resultingStatus)}`;
    status.textContent = irsDecisionStatusLabels[event.resultingStatus] || event.resultingStatus;

    header.append(type, status);

    const meta = document.createElement('p');
    meta.className = 'irs-decision-meta';
    const scopeLabel = irsDecisionScopeLabels[event.scopeType] || event.scopeType;
    const itemLabel = irsScopeItemLabel(event.scopeType, event.scopeId);
    const isLatestApproved = latestApprovedByScope.get(`${event.scopeType}:${event.scopeId}`) === event.id;
    const latestApprovedTag = isLatestApproved ? 'Latest Approved' : '';
    meta.textContent = `${scopeLabel} · ${itemLabel}${latestApprovedTag ? ` · ${latestApprovedTag}` : ''}`;

    const rationale = document.createElement('p');
    rationale.className = 'irs-decision-rationale';
    rationale.textContent = event.rationale || 'Sem rationale registrado.';

    const relation = document.createElement('p');
    relation.className = 'irs-decision-related';
    relation.textContent = event.relatedItemId
      ? `Relacionado/substituto: ${event.relatedItemType || 'item'} · ${event.relatedItemId}`
      : '';

    const timestamp = document.createElement('div');
    timestamp.className = 'irs-decision-time';
    timestamp.textContent = new Date(event.happenedAt).toLocaleString('pt-BR');

    row.append(header, meta, rationale);
    if (relation.textContent) row.append(relation);
    row.append(timestamp);
    irsRefs.decisionList.append(row);
  });
};

// Tab switching
const irsSwitchTab = (tab) => {
  const isReview = tab === 'review';
  const isPromotions = tab === 'promotions';
  irsRefs.tabReview.classList.toggle('irs-hidden', !isReview);
  irsRefs.tabPromotions.classList.toggle('irs-hidden', !isPromotions);
  irsRefs.tabDecisions.classList.toggle('irs-hidden', tab !== 'decisions');
  irsRefs.tabBtnReview.classList.toggle('irs-tab-active', isReview);
  irsRefs.tabBtnPromotions.classList.toggle('irs-tab-active', isPromotions);
  irsRefs.tabBtnDecisions.classList.toggle('irs-tab-active', tab === 'decisions');

  if (isPromotions) irsRenderPromotionsList();
  if (tab === 'decisions') irsRenderDecisionHistory();
};

irsRefs.tabBtnReview.addEventListener('click', () => irsSwitchTab('review'));
irsRefs.tabBtnPromotions.addEventListener('click', () => irsSwitchTab('promotions'));
irsRefs.tabBtnDecisions.addEventListener('click', () => irsSwitchTab('decisions'));

irsRefs.applyFiltersBtn.addEventListener('click', () => {
  irsRenderGallery();
});

irsRefs.decisionApplyBtn.addEventListener('click', () => {
  irsRenderDecisionHistory();
});

irsRefs.clearCompareBtn.addEventListener('click', () => {
  irsCompareIds = [];
  irsRenderGallery();
  irsRenderCompare();
});

const irsPopulateDecisionFilters = () => {
  const previousScope = irsRefs.decisionScopeFilter.value;
  const previousStatus = irsRefs.decisionStatusFilter.value;

  irsRefs.decisionScopeFilter.innerHTML = '<option value="">Todos os escopos</option>';
  DECISION_SCOPE_TYPES.forEach((scopeType) => {
    const option = document.createElement('option');
    option.value = scopeType;
    option.textContent = irsDecisionScopeLabels[scopeType] || scopeType;
    if (scopeType === previousScope) option.selected = true;
    irsRefs.decisionScopeFilter.append(option);
  });

  irsRefs.decisionStatusFilter.innerHTML = '<option value="">Todos os status</option>';
  DECISION_RESULT_STATUSES.forEach((status) => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = irsDecisionStatusLabels[status] || status;
    if (status === previousStatus) option.selected = true;
    irsRefs.decisionStatusFilter.append(option);
  });
};

// Open / close
const openImageReviewStudio = () => {
  if (!selectedProjectId()) return;
  irsIsOpen = true;
  irsSelectedOutputId = null;
  irsCompareIds = [];
  irsCanonModalOutputId = null;
  irsPopulateFilterSelectors();
  irsPopulateDecisionFilters();
  irsSwitchTab('review');
  irsRenderGallery();
  irsRefs.detailPanel.classList.add('irs-hidden');
  irsRefs.detailEmpty.style.display = '';
  irsRefs.overlay.classList.remove('irs-hidden');
  document.body.style.overflow = 'hidden';
};

const closeImageReviewStudio = () => {
  irsIsOpen = false;
  irsRefs.canonModal.classList.add('irs-hidden');
  irsRefs.overlay.classList.add('irs-hidden');
  document.body.style.overflow = '';
  render();
};

irsRefs.closeBtn.addEventListener('click', closeImageReviewStudio);

irsRefs.openGenStudioBtn.addEventListener('click', () => {
  closeImageReviewStudio();
  openImageGenStudio();
});

$('openImageReviewStudioBtn').addEventListener('click', openImageReviewStudio);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (irsRefs.canonModal && !irsRefs.canonModal.classList.contains('irs-hidden')) {
    irsRefs.canonModal.classList.add('irs-hidden');
    irsCanonModalOutputId = null;
    return;
  }
  if (!irsIsOpen) return;
  const active = document.activeElement;
  const isInput = active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.tagName === 'SELECT');
  if (isInput) return;
  closeImageReviewStudio();
});

render();

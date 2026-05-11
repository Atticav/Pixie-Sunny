const DEFAULT_PROTAGONIST_TEXT = 'a pessoa protagonista';
export const DEFAULT_NEGATIVE_PROMPT =
  'anime, cartoon, proporções irreais, maquiagem glamour moderna, olhos inconsistentes, figurino moderno';

export const PROMPT_STYLE_PRESETS = [
  {
    id: 'cinematic-realism',
    label: 'Realismo cinematográfico',
    guidance: 'realismo cinematográfico, textura natural de pele e tecido, fidelidade anatômica, detalhes orgânicos'
  },
  {
    id: 'dark-fantasy',
    label: 'Dark fantasy',
    guidance: 'dark fantasy realista, atmosfera sombria, materiais envelhecidos, contraste dramático'
  },
  {
    id: 'dreamy-ethereal',
    label: 'Etéreo onírico',
    guidance: 'fotografia etérea, névoa delicada, highlights suaves, aura poética sem perder realismo'
  }
];

export const PROMPT_CINEMATIC_PRESETS = [
  {
    id: 'portrait-intimate',
    label: 'Retrato íntimo',
    guidance: 'close portrait, intimacy, emotional focus, subtle background separation'
  },
  {
    id: 'wide-establishing',
    label: 'Plano aberto',
    guidance: 'wide establishing shot, environmental storytelling, depth layers, cinematic scale'
  },
  {
    id: 'dramatic-motion',
    label: 'Movimento dramático',
    guidance: 'dynamic blocking, motion-ready staging, cinematic tension, directional movement'
  }
];

export const PROMPT_LENS_LIGHT_PRESETS = [
  {
    id: 'natural-soft',
    label: 'Luz suave natural',
    guidance: '50mm look, soft natural light, gentle falloff, grounded exposure'
  },
  {
    id: 'moonlit-cold',
    label: 'Luz fria lunar',
    guidance: '85mm compression, cold moonlight, blue shadows, low-key contrast'
  },
  {
    id: 'golden-haze',
    label: 'Contraluz dourado',
    guidance: '35mm cinematic lens, golden haze, rim light, atmospheric particles'
  }
];

const line = (value) => (typeof value === 'string' ? value.trim() : '');

const list = (values) =>
  (Array.isArray(values) ? values : [])
    .map((value) => line(value))
    .filter(Boolean);

const uniqueList = (values) => [...new Set(list(values))];

const joinClause = (values, fallback = '') => {
  const safeValues = list(values);
  return safeValues.length ? safeValues.join(', ') : fallback;
};

const joinSentence = (values, fallback = '') => {
  const safeValues = list(values);
  return safeValues.length ? safeValues.join('; ') : fallback;
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findPreset = (collection, id, fallbackId) =>
  collection.find((item) => item.id === id) ||
  collection.find((item) => item.id === fallbackId) ||
  collection[0];

const describeReference = (reference) => {
  if (!reference) return 'referência inválida';
  const bits = [line(reference.name) || 'referência sem nome'];
  if (reference.type) bits.push(`tipo ${reference.type}`);
  if (reference.preserve) bits.push(`preservar ${reference.preserve}`);
  if (reference.mayVary) bits.push(`variar ${reference.mayVary}`);
  return bits.join(', ');
};

const extractConsistencyNegatives = (rules) =>
  list(rules)
    .filter((rule) => /não|nunca|evitar|sem/i.test(rule))
    .map((rule) => rule.replace(/\.$/, ''));

const formatPromptMediumHint = (promptMedium) =>
  promptMedium === 'video'
    ? 'otimizado para geração de vídeo com coerência de movimento e continuidade entre quadros'
    : 'otimizado para geração de imagem estática com alta fidelidade visual';

export const suggestNextParagraph = ({ chapterContent, chapterTitle, loreEntries, characters }) => {
  const lore = loreEntries.slice(0, 3).map((entry) => `- ${entry.title}: ${entry.content}`).join('\n');
  const cast = characters.slice(0, 3).map((character) => character.name).join(', ');

  return [
    `Continuação sugerida para "${chapterTitle}":`,
    '',
    `No silêncio da cena, ${cast || DEFAULT_PROTAGONIST_TEXT} percebe um detalhe que conecta o presente a um fato canônico do universo.`,
    'Esse detalhe gera uma decisão concreta e irreversível para o próximo conflito.',
    '',
    'Memória relevante:',
    lore || '- Sem fatos canônicos cadastrados ainda.'
  ].join('\n');
};

export const searchLore = (entries, query) => {
  if (!query?.trim()) return entries;
  const q = query.toLowerCase();
  return entries.filter((entry) => `${entry.title} ${entry.content}`.toLowerCase().includes(q));
};

export const buildCharacterPromptPack = ({
  character,
  projectTone = '',
  references = [],
  promptMedium = 'image',
  preserve = [],
  vary = [],
  stylePreset = 'cinematic-realism',
  cinematicPreset = 'portrait-intimate',
  lensLightingPreset = 'natural-soft'
}) => {
  const style = findPreset(PROMPT_STYLE_PRESETS, stylePreset, 'cinematic-realism');
  const cinematic = findPreset(PROMPT_CINEMATIC_PRESETS, cinematicPreset, 'portrait-intimate');
  const lensLighting = findPreset(PROMPT_LENS_LIGHT_PRESETS, lensLightingPreset, 'natural-soft');
  const referenceList = references.map(describeReference);
  const fixedChecklist = uniqueList([
    ...(character?.canonTraits || []),
    ...(character?.fixedTraits || []),
    ...preserve,
    ...references.flatMap((reference) => (reference.preserve || '').split(','))
  ]);
  const variationList = uniqueList([
    ...(character?.variableTraits || []),
    ...vary,
    ...references.flatMap((reference) => (reference.mayVary || '').split(','))
  ]);
  const identity = joinClause([
    character?.name,
    character?.apparentAge && `idade aparente ${character.apparentAge}`,
    character?.genderPresentation,
    character?.skinTone,
    character?.hair,
    character?.eyes,
    character?.faceShape,
    character?.bodyType,
    character?.marks,
    character?.typicalClothing,
    character?.accessories,
    character?.dominantExpression,
    character?.presence,
    character?.visualAesthetic,
    character?.colorPalette && `paleta ${character.colorPalette}`,
    character?.periodStyle
  ]);
  const tone = line(projectTone) || 'fantasia sombria cinematográfica';
  const referenceSentence = joinSentence(referenceList, 'usar apenas cânone interno e descrição textual disponível');
  const masterPrompt = [
    identity,
    style.guidance,
    cinematic.guidance,
    lensLighting.guidance,
    `tom do projeto: ${tone}`,
    formatPromptMediumHint(promptMedium),
    fixedChecklist.length ? `preservar: ${fixedChecklist.join(', ')}` : '',
    referenceSentence ? `âncoras de referência: ${referenceSentence}` : '',
    character?.cinematicNotes ? `notas cinematográficas: ${character.cinematicNotes}` : '',
    character?.notes ? `contexto narrativo: ${character.notes}` : '',
    character?.consistencyRules?.length ? `regras de consistência: ${character.consistencyRules.join('; ')}` : ''
  ]
    .filter(Boolean)
    .join('. ');
  const shortPrompt = [
    character?.name,
    character?.hair,
    character?.eyes,
    character?.marks,
    character?.typicalClothing,
    style.label.toLowerCase(),
    promptMedium === 'video' ? 'continuidade temporal' : 'retrato de alta fidelidade'
  ]
    .filter(Boolean)
    .join(', ');
  const detailedPrompt = [
    `Retrato de ${character?.name || 'personagem'} com ${identity || 'identidade visual canônica definida'}.`,
    fixedChecklist.length ? `Elementos fixos: ${fixedChecklist.join('; ')}.` : '',
    variationList.length ? `Pode variar apenas em: ${variationList.join('; ')}.` : '',
    referenceSentence ? `Referências internas: ${referenceSentence}.` : '',
    `Look & feel: ${style.guidance}; ${cinematic.guidance}; ${lensLighting.guidance}.`,
    promptMedium === 'video'
      ? 'Manter consistência facial, material e iluminação em cada frame; movimento sutil de câmera e microexpressões naturais.'
      : 'Manter nitidez orgânica, anatomia coerente, pele realista e fotografia cinematográfica sem estilização cartunesca.'
  ]
    .filter(Boolean)
    .join(' ');
  const negativePrompt = uniqueList([
    ...DEFAULT_NEGATIVE_PROMPT.split(','),
    ...(character?.negativePrompt || '').split(','),
    ...extractConsistencyNegatives(character?.consistencyRules || [])
  ]).join(', ');

  return {
    masterPrompt,
    negativePrompt,
    shortPrompt,
    detailedPrompt,
    scenePrompt: '',
    cinematicPrompt: [
      `Personagem ${character?.name || 'canônico'} em abordagem ${cinematic.label.toLowerCase()}`,
      lensLighting.guidance,
      promptMedium === 'video' ? 'camera drift lento, respiração natural, continuidade entre quadros' : 'profundidade de campo cinematográfica'
    ].join(', '),
    variations: variationList.map((item) => `Variar ${item} mantendo os demais traços canônicos.`),
    fixedChecklist
  };
};

export const inferSceneCharactersFromContext = (characters, scene, chapter) => {
  const haystack = `${scene?.title || ''} ${scene?.description || ''} ${chapter?.summary || ''} ${(chapter?.presentCharacters || []).join(' ')}`.toLowerCase();
  return characters.filter((character) => {
    const name = line(character?.name).toLowerCase();
    if (!name) return false;
    const matcher = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(name)}($|[^\\p{L}\\p{N}])`, 'u');
    return matcher.test(haystack);
  });
};

const inferRelevantLore = (loreEntries, scene, chapter) => {
  const query = joinClause([scene?.title, scene?.description, scene?.location, chapter?.summary], '').toLowerCase();
  if (!query) return loreEntries.slice(0, 3);
  const matched = loreEntries.filter((entry) => `${entry.title} ${entry.content}`.toLowerCase().includes(query)).slice(0, 4);
  return matched.length ? matched : loreEntries.slice(0, 3);
};

export const buildScenePromptPack = ({
  projectTone = '',
  scene,
  chapter,
  characters = [],
  loreEntries = [],
  references = [],
  promptMedium = 'image',
  preserve = [],
  vary = [],
  stylePreset = 'cinematic-realism',
  cinematicPreset = 'wide-establishing',
  lensLightingPreset = 'natural-soft',
  emotionalTone = '',
  environment = '',
  lighting = '',
  composition = ''
}) => {
  const style = findPreset(PROMPT_STYLE_PRESETS, stylePreset, 'cinematic-realism');
  const cinematic = findPreset(PROMPT_CINEMATIC_PRESETS, cinematicPreset, 'wide-establishing');
  const lensLighting = findPreset(PROMPT_LENS_LIGHT_PRESETS, lensLightingPreset, 'natural-soft');
  const involvedCharacters = inferSceneCharactersFromContext(characters, scene, chapter);
  const relevantLore = inferRelevantLore(loreEntries, scene, chapter);
  const referenceList = references.map(describeReference);
  const fixedChecklist = uniqueList([
    scene?.location,
    environment,
    lighting,
    composition,
    ...preserve,
    ...involvedCharacters.flatMap((character) => character.fixedTraits || []),
    ...references.flatMap((reference) => (reference.preserve || '').split(','))
  ]);
  const variationList = uniqueList([
    ...vary,
    ...involvedCharacters.flatMap((character) => character.variableTraits || []),
    ...references.flatMap((reference) => (reference.mayVary || '').split(','))
  ]);
  const characterSentence = joinSentence(
    involvedCharacters.map((character) =>
      joinClause([
        character.name,
        character.hair,
        character.eyes,
        character.typicalClothing,
        character.presence
      ])
    ),
    'sem personagens canônicos identificados automaticamente'
  );
  const loreSentence = joinSentence(
    relevantLore.map((entry) => `${entry.title}: ${entry.content}`),
    'sem lore diretamente associado'
  );
  const scenePrompt = [
    `Cena "${scene?.title || 'sem título'}"`,
    line(scene?.description) || 'descrever ação principal',
    scene?.location || environment ? `ambiente ${joinClause([environment, scene?.location], 'não definido')}` : '',
    emotionalTone ? `tom emocional ${emotionalTone}` : '',
    lighting ? `iluminação ${lighting}` : '',
    composition ? `composição ${composition}` : '',
    `estilo ${style.guidance}`,
    cinematic.guidance,
    lensLighting.guidance,
    `personagens: ${characterSentence}`,
    `lore relacionado: ${loreSentence}`,
    fixedChecklist.length ? `manter fixo: ${fixedChecklist.join(', ')}` : '',
    formatPromptMediumHint(promptMedium)
  ]
    .filter(Boolean)
    .join('. ');
  const cinematicPrompt = [
    `Sequência cinematográfica para "${scene?.title || 'cena'}"`,
    cinematic.guidance,
    lensLighting.guidance,
    emotionalTone ? `subtexto emocional: ${emotionalTone}` : '',
    promptMedium === 'video'
      ? 'movimento de câmera controlado, blocking legível, continuidade de vento/roupa/cabelo entre frames'
      : 'frame único com blocking claro, profundidade de campo e direção de olhar consistente'
  ]
    .filter(Boolean)
    .join('. ');
  const negativePrompt = uniqueList([
    ...DEFAULT_NEGATIVE_PROMPT.split(','),
    ...involvedCharacters.flatMap((character) => (character.negativePrompt || '').split(',')),
    ...involvedCharacters.flatMap((character) => extractConsistencyNegatives(character.consistencyRules || []))
  ]).join(', ');

  return {
    masterPrompt: scenePrompt,
    negativePrompt,
    shortPrompt: joinClause([
      scene?.title,
      scene?.location,
      emotionalTone,
      style.label.toLowerCase()
    ]),
    detailedPrompt: [
      scenePrompt,
      variationList.length ? `Variações permitidas: ${variationList.join('; ')}.` : '',
      referenceList.length ? `Referências visuais internas: ${referenceList.join('; ')}.` : ''
    ]
      .filter(Boolean)
      .join(' '),
    scenePrompt,
    cinematicPrompt,
    variations: [
      `Variação 1 — aproximar a câmera e intensificar ${emotionalTone || 'a emoção principal'} mantendo ${joinClause(fixedChecklist, 'os elementos fixos')}.`,
      `Variação 2 — mudar o ângulo/composição dentro de ${joinClause(variationList, 'pequenas variações permitidas')} sem perder a fidelidade dos personagens.`,
      `Variação 3 — reforçar ambiente ${joinClause([environment, scene?.location], 'base')} e atmosfera ${emotionalTone || 'cinematográfica'} preservando referências oficiais.`
    ],
    fixedChecklist
  };
};

export const buildSceneSpec = ({ projectTone, scene, characters }) => ({
  mode: 'image-spec',
  sceneTitle: scene?.title,
  sceneLocation: scene?.location || 'não definido',
  cinematicTone: projectTone || 'fantasia sombria cinematográfica',
  continuityChecklist: characters.map((character) => ({
    character: character.name,
    lockTraits: character.canonTraits
  })),
  prompt: `Cena "${scene?.title}": ${scene?.description}. Local: ${scene?.location || 'não definido'}. Estilo realista cinematográfico, textura natural de pele e tecido, iluminação dramática coerente com o cenário descrito.`,
  negativePrompt: DEFAULT_NEGATIVE_PROMPT
});

export const buildVideoSpec = ({ scene, imageAsset, projectTone }) => ({
  mode: 'video-spec',
  sourceImage: imageAsset?.path || 'definir arquivo local',
  sceneTitle: scene?.title,
  motionPrompt: `Movimento sutil e cinematográfico para ${scene?.title || 'cena'}: vento leve, respiração natural, micro expressão facial e deslocamento de câmera lento.`,
  ambiencePrompt: 'Ambiência natural coerente com o cenário (vento, folhas, passos em solo úmido).',
  outputHint: 'gerar clipe curto (4-8s) para manter qualidade máxima local/offline',
  tone: projectTone || 'dark fantasy realista'
});

const DEFAULT_PROTAGONIST_TEXT = 'the protagonist';
export const DEFAULT_NEGATIVE_PROMPT =
  'anime, cartoon, unrealistic proportions, modern glam makeup, inconsistent eyes, modern wardrobe';

export const PROMPT_STYLE_PRESETS = [
  {
    id: 'cinematic-realism',
    label: 'Cinematic realism',
    guidance: 'cinematic realism, natural skin and fabric texture, anatomical fidelity, organic details'
  },
  {
    id: 'dark-fantasy',
    label: 'Dark fantasy',
    guidance: 'realistic dark fantasy, somber atmosphere, weathered materials, dramatic contrast'
  },
  {
    id: 'dreamy-ethereal',
    label: 'Dreamlike ethereal',
    guidance: 'ethereal photography, delicate mist, soft highlights, poetic aura without losing realism'
  }
];

export const PROMPT_CINEMATIC_PRESETS = [
  {
    id: 'portrait-intimate',
    label: 'Intimate portrait',
    guidance: 'close portrait, intimacy, emotional focus, subtle background separation'
  },
  {
    id: 'wide-establishing',
    label: 'Wide shot',
    guidance: 'wide establishing shot, environmental storytelling, depth layers, cinematic scale'
  },
  {
    id: 'dramatic-motion',
    label: 'Dramatic movement',
    guidance: 'dynamic blocking, motion-ready staging, cinematic tension, directional movement'
  }
];

export const PROMPT_LENS_LIGHT_PRESETS = [
  {
    id: 'natural-soft',
    label: 'Soft natural light',
    guidance: '50mm look, soft natural light, gentle falloff, grounded exposure'
  },
  {
    id: 'moonlit-cold',
    label: 'Cold moonlight',
    guidance: '85mm compression, cold moonlight, blue shadows, low-key contrast'
  },
  {
    id: 'golden-haze',
    label: 'Golden backlight',
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
  if (!reference) return 'invalid reference';
  const bits = [line(reference.name) || 'unnamed reference'];
  if (reference.type) bits.push(`type ${reference.type}`);
  if (reference.preserve) bits.push(`preserve ${reference.preserve}`);
  if (reference.mayVary) bits.push(`vary ${reference.mayVary}`);
  return bits.join(', ');
};

const extractConsistencyNegatives = (rules) =>
  list(rules)
    .filter((rule) => /não|nunca|evitar|sem|do not|never|avoid|without/i.test(rule))
    .map((rule) => rule.replace(/\.$/, ''));

const formatPromptMediumHint = (promptMedium) =>
  promptMedium === 'video'
    ? 'optimized for video generation with motion coherence and frame-to-frame continuity'
    : 'optimized for still-image generation with high visual fidelity';

export const suggestNextParagraph = ({ chapterContent, chapterTitle, loreEntries, characters }) => {
  const lore = loreEntries.slice(0, 3).map((entry) => `- ${entry.title}: ${entry.content}`).join('\n');
  const cast = characters.slice(0, 3).map((character) => character.name).join(', ');

  return [
    `Suggested continuation for "${chapterTitle}":`,
    '',
    `In the silence of the scene, ${cast || DEFAULT_PROTAGONIST_TEXT} notices a detail that connects the present moment to a canonical fact in the universe.`,
    'That detail creates a concrete, irreversible decision for the next conflict.',
    '',
    'Relevant memory:',
    lore || '- No canonical facts added yet.'
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
    character?.apparentAge && `apparent age ${character.apparentAge}`,
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
    character?.colorPalette && `palette ${character.colorPalette}`,
    character?.periodStyle
  ]);
  const tone = line(projectTone) || 'cinematic dark fantasy';
  const referenceSentence = joinSentence(referenceList, 'use only internal canon and the available textual description');
  const masterPrompt = [
    identity,
    style.guidance,
    cinematic.guidance,
    lensLighting.guidance,
    `project tone: ${tone}`,
    formatPromptMediumHint(promptMedium),
    fixedChecklist.length ? `preserve: ${fixedChecklist.join(', ')}` : '',
    referenceSentence ? `reference anchors: ${referenceSentence}` : '',
    character?.cinematicNotes ? `cinematic notes: ${character.cinematicNotes}` : '',
    character?.notes ? `narrative context: ${character.notes}` : '',
    character?.consistencyRules?.length ? `consistency rules: ${character.consistencyRules.join('; ')}` : ''
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
    promptMedium === 'video' ? 'temporal continuity' : 'high-fidelity portrait'
  ]
    .filter(Boolean)
    .join(', ');
  const detailedPrompt = [
    `Portrait of ${character?.name || 'character'} with ${identity || 'a defined canonical visual identity'}.`,
    fixedChecklist.length ? `Fixed elements: ${fixedChecklist.join('; ')}.` : '',
    variationList.length ? `May vary only in: ${variationList.join('; ')}.` : '',
    referenceSentence ? `Internal references: ${referenceSentence}.` : '',
    `Look & feel: ${style.guidance}; ${cinematic.guidance}; ${lensLighting.guidance}.`,
    promptMedium === 'video'
      ? 'Maintain facial, material, and lighting consistency in every frame; use subtle camera movement and natural micro-expressions.'
      : 'Maintain organic sharpness, coherent anatomy, realistic skin, and cinematic photography without cartoon stylization.'
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
      `Character ${character?.name || 'canonical'} in a ${cinematic.label.toLowerCase()}`,
      lensLighting.guidance,
      promptMedium === 'video' ? 'slow camera drift, natural breathing, frame-to-frame continuity' : 'cinematic depth of field'
    ].join(', '),
    variations: variationList.map((item) => `Vary ${item} while keeping the other canonical traits.`),
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
    'no canonical characters automatically identified'
  );
  const loreSentence = joinSentence(
    relevantLore.map((entry) => `${entry.title}: ${entry.content}`),
    'no directly associated lore'
  );
  const scenePrompt = [
    `Scene "${scene?.title || 'untitled'}"`,
    line(scene?.description) || 'describe the main action',
    scene?.location || environment ? `environment ${joinClause([environment, scene?.location], 'undefined')}` : '',
    emotionalTone ? `emotional tone ${emotionalTone}` : '',
    lighting ? `lighting ${lighting}` : '',
    composition ? `composition ${composition}` : '',
    `style ${style.guidance}`,
    cinematic.guidance,
    lensLighting.guidance,
    `characters: ${characterSentence}`,
    `related lore: ${loreSentence}`,
    fixedChecklist.length ? `keep fixed: ${fixedChecklist.join(', ')}` : '',
    formatPromptMediumHint(promptMedium)
  ]
    .filter(Boolean)
    .join('. ');
  const cinematicPrompt = [
    `Cinematic sequence for "${scene?.title || 'scene'}"`,
    cinematic.guidance,
    lensLighting.guidance,
    emotionalTone ? `emotional subtext: ${emotionalTone}` : '',
    promptMedium === 'video'
      ? 'controlled camera movement, readable blocking, continuity of wind/clothing/hair across frames'
      : 'single frame with clear blocking, depth of field, and consistent eyeline direction'
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
      variationList.length ? `Allowed variations: ${variationList.join('; ')}.` : '',
      referenceList.length ? `Internal visual references: ${referenceList.join('; ')}.` : ''
    ]
      .filter(Boolean)
      .join(' '),
    scenePrompt,
    cinematicPrompt,
    variations: [
      `Variation 1 — move the camera closer and intensify ${emotionalTone || 'the main emotion'} while keeping ${joinClause(fixedChecklist, 'the fixed elements')}.`,
      `Variation 2 — change the angle/composition within ${joinClause(variationList, 'small allowed variations')} without losing character fidelity.`,
      `Variation 3 — reinforce the environment ${joinClause([environment, scene?.location], 'base')} and atmosphere ${emotionalTone || 'cinematic'} while preserving official references.`
    ],
    fixedChecklist
  };
};

export const buildSceneSpec = ({ projectTone, scene, characters }) => ({
  mode: 'image-spec',
  sceneTitle: scene?.title,
  sceneLocation: scene?.location || 'undefined',
  cinematicTone: projectTone || 'cinematic dark fantasy',
  continuityChecklist: characters.map((character) => ({
    character: character.name,
    lockTraits: character.canonTraits
  })),
  prompt: `Scene "${scene?.title}": ${scene?.description}. Location: ${scene?.location || 'undefined'}. Cinematic realistic style, natural skin and fabric texture, and dramatic lighting consistent with the described setting.`,
  negativePrompt: DEFAULT_NEGATIVE_PROMPT
});

export const buildVideoSpec = ({ scene, imageAsset, projectTone }) => ({
  mode: 'video-spec',
  sourceImage: imageAsset?.path || 'define local file',
  sceneTitle: scene?.title,
  motionPrompt: `Subtle cinematic movement for ${scene?.title || 'scene'}: light wind, natural breathing, facial micro-expression, and slow camera movement.`,
  ambiencePrompt: 'Natural ambience consistent with the setting (wind, leaves, footsteps on damp ground).',
  outputHint: 'generate a short clip (4–8s) to keep maximum local/offline quality',
  tone: projectTone || 'realistic dark fantasy'
});

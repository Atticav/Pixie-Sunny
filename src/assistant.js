export const suggestNextParagraph = ({ chapterContent, chapterTitle, loreEntries, characters }) => {
  const lore = loreEntries.slice(0, 3).map((entry) => `- ${entry.title}: ${entry.content}`).join('\n');
  const cast = characters.slice(0, 3).map((character) => character.name).join(', ');

  return [
    `Continuação sugerida para "${chapterTitle}":`,
    '',
    `No silêncio da cena, ${cast || 'a protagonista'} percebe um detalhe que conecta o presente a um fato canônico do universo.`,
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

export const buildSceneSpec = ({ projectTone, scene, characters }) => ({
  mode: 'image-spec',
  sceneTitle: scene?.title,
  cinematicTone: projectTone || 'fantasia sombria cinematográfica',
  continuityChecklist: characters.map((character) => ({
    character: character.name,
    lockTraits: character.canonTraits
  })),
  prompt: `Cena "${scene?.title}": ${scene?.description}. Estilo realista cinematográfico, textura natural de pele e tecido, iluminação dramática coerente com floresta enevoada.`,
  negativePrompt: 'anime, cartoon, proporções irreais, maquiagem glamour moderna, olhos inconsistentes, figurino moderno'
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

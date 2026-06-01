import test from 'node:test';
import assert from 'node:assert/strict';

import { translateUserFacingText } from '../src/i18n.js';
import { buildSceneSpec, buildVideoSpec, suggestNextParagraph } from '../src/assistant.js';

test('translateUserFacingText localizes key UI text and templated prompts', () => {
  assert.equal(translateUserFacingText('Exportar JSON'), 'Export JSON');
  assert.equal(
    translateUserFacingText('Excluir o projeto "Alpha" e todos os dados relacionados?'),
    'Delete project "Alpha" and all related data?'
  );
});

test('assistant-generated scaffolding is emitted in English', () => {
  const paragraph = suggestNextParagraph({
    chapterTitle: 'Opening',
    chapterContent: '',
    loreEntries: [],
    characters: []
  });
  assert.match(paragraph, /Suggested continuation/);
  assert.doesNotMatch(paragraph, /Continuação sugerida|Memória relevante/);

  const sceneSpec = buildSceneSpec({
    projectTone: '',
    scene: { title: 'Forest Gate', description: 'The hero arrives.', location: '' },
    characters: []
  });
  assert.match(sceneSpec.prompt, /^Scene /);
  assert.doesNotMatch(sceneSpec.prompt, /Estilo|cenário descrito/);

  const videoSpec = buildVideoSpec({
    scene: { title: 'Forest Gate' },
    imageAsset: null,
    projectTone: ''
  });
  assert.equal(videoSpec.sourceImage, 'define local file');
  assert.match(videoSpec.ambiencePrompt, /Natural ambience consistent/);
});

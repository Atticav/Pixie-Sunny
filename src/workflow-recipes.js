/**
 * Workflow Recipes / Guided Playbooks
 *
 * Provides a small, extensible set of step-by-step guided playbooks that walk
 * the user through common high-value workflows in the studio.  Each recipe is
 * self-contained and references existing app surfaces via scrollTarget /
 * quickAction anchors so integration is purely additive and requires no
 * changes to existing modules.
 *
 * MVP recipes:
 *   1. nova-cena     – Create a new scene from scratch
 *   2. review-inbox  – Review Inbox resolution flow
 *   3. pre-export    – Pre-export readiness flow
 *
 * Future recipes can be added to WORKFLOW_RECIPES without touching any
 * other file.
 */

/** Step status values */
export const STEP_STATUSES = ['pending', 'current', 'done', 'skipped'];

/** Recipe status values derived from step states */
export const RECIPE_STATUSES = ['not_started', 'in_progress', 'complete'];

/**
 * Each recipe step shape:
 * {
 *   id: string,
 *   label: string,
 *   rationale: string,
 *   scrollTarget?: string,   // CSS selector to scroll to (optional)
 *   quickAction?: string     // action key handled in app.js (optional)
 * }
 */

/** Canonical list of starter playbooks. */
export const WORKFLOW_RECIPES = [
  {
    id: 'nova-cena',
    title: 'Criar nova cena do zero',
    description:
      'Guia completo para iniciar uma nova cena: estrutura, personagens, shots e geração de imagem.',
    steps: [
      {
        id: 'nova-cena-1',
        label: 'Selecionar ou criar um projeto',
        rationale:
          'Todo conteúdo precisa de um projeto-pai. Verifique se o projeto correto está selecionado antes de continuar.',
        scrollTarget: 'section:has(#projectSelect)',
        quickAction: 'scroll-project'
      },
      {
        id: 'nova-cena-2',
        label: 'Criar ou confirmar personagem principal',
        rationale:
          'A cena é mais rica quando vinculada a um personagem com traços canônicos definidos.',
        scrollTarget: 'section:has(#characterSelect)',
        quickAction: 'scroll-characters'
      },
      {
        id: 'nova-cena-3',
        label: 'Adicionar entradas de lore relevantes',
        rationale:
          'Regras de universo e notas de lore ajudam o gerador de prompts a manter consistência.',
        scrollTarget: 'section:has(#loreSelect)',
        quickAction: 'scroll-lore'
      },
      {
        id: 'nova-cena-4',
        label: 'Criar a cena e preencher briefing',
        rationale:
          'Defina localização, objetivo narrativo e tom visual da cena.',
        scrollTarget: 'section:has(#sceneSelect)',
        quickAction: 'scroll-scenes'
      },
      {
        id: 'nova-cena-5',
        label: 'Planejar shots no Shot Planner',
        rationale:
          'Divida a cena em shots planejados com direção visual, continuidade e referências.',
        scrollTarget: '.sp-section',
        quickAction: 'open-shot-planner'
      },
      {
        id: 'nova-cena-6',
        label: 'Gerar imagens no Estúdio de Geração',
        rationale:
          'Gere outputs de imagem localmente para cada shot planejado.',
        quickAction: 'open-image-gen'
      },
      {
        id: 'nova-cena-7',
        label: 'Revisar e canonizar outputs na Revisão de Imagens',
        rationale:
          'Selecione os melhores outputs, marque como canon e resolva conflicts de continuidade.',
        quickAction: 'open-image-review'
      }
    ]
  },
  {
    id: 'review-inbox',
    title: 'Fluxo de resolução da Review Inbox',
    description:
      'Passo a passo para triar, priorizar e resolver os itens pendentes na inbox de revisão.',
    steps: [
      {
        id: 'review-inbox-1',
        label: 'Abrir a Review Inbox e verificar pendências',
        rationale:
          'A inbox consolida conflitos, riscos e itens stale que precisam de decisão humana.',
        scrollTarget: '.ri-section',
        quickAction: 'scroll-review-inbox'
      },
      {
        id: 'review-inbox-2',
        label: 'Filtrar por prioridade alta',
        rationale:
          'Concentre-se primeiro nos itens de risco crítico para evitar gargalos no pipeline.',
        scrollTarget: '.ri-section',
        quickAction: 'scroll-review-inbox'
      },
      {
        id: 'review-inbox-3',
        label: 'Inspecionar cada item e tomar uma decisão',
        rationale:
          'Aprove, rejeite, adie ou marque para refresh. Cada decisão é registrada no histórico.',
        scrollTarget: '.ri-section',
        quickAction: 'scroll-review-inbox'
      },
      {
        id: 'review-inbox-4',
        label: 'Resolver itens de diff / compare context',
        rationale:
          'Abra o Diff Viewer para itens com conflitos de contexto e valide as diferenças.',
        scrollTarget: '.dv-section',
        quickAction: 'scroll-diff-viewer'
      },
      {
        id: 'review-inbox-5',
        label: 'Verificar prontidão do projeto no Dashboard',
        rationale:
          'Após resolução, confirme que o score de prontidão melhorou no Production Readiness Dashboard.',
        scrollTarget: '.ap-section',
        quickAction: 'scroll-assistive'
      }
    ]
  },
  {
    id: 'pre-export',
    title: 'Fluxo de prontidão pré-export',
    description:
      'Checklist guiado para garantir que o projeto está pronto antes de gerar o pacote de exportação.',
    steps: [
      {
        id: 'pre-export-1',
        label: 'Verificar Production Readiness via Assistive Planning',
        rationale:
          'O painel de Assistive Planning mostra o score de prontidão e bloqueia identificados por cena/sequência.',
        scrollTarget: '.ap-section',
        quickAction: 'scroll-assistive'
      },
      {
        id: 'pre-export-2',
        label: 'Resolver itens bloqueados na Review Inbox',
        rationale:
          'Todo item com status "blocked" ou prioridade alta precisa ser resolvido antes do export.',
        scrollTarget: '.ri-section',
        quickAction: 'scroll-review-inbox'
      },
      {
        id: 'pre-export-3',
        label: 'Confirmar que os outputs canônicos estão marcados',
        rationale:
          'Revise a galeria de imagens e certifique-se que cada cena tem pelo menos um output canônico.',
        quickAction: 'open-image-review'
      },
      {
        id: 'pre-export-4',
        label: 'Revisar lineage e supersession de assets',
        rationale:
          'Verifique o grafo de lineage para garantir que nenhum asset supersedido ainda está marcado como canon.',
        scrollTarget: '.irs-section',
        quickAction: 'open-image-review'
      },
      {
        id: 'pre-export-5',
        label: 'Exportar pacote JSON do projeto',
        rationale:
          'Gere o export JSON completo como snapshot final antes do handoff ou publicação.',
        quickAction: 'export-json'
      }
    ]
  }
];

/**
 * Returns a recipe by id, or null if not found.
 * @param {string} id
 * @returns {object|null}
 */
export const getRecipeById = (id) => WORKFLOW_RECIPES.find((r) => r.id === id) || null;

/**
 * Normalizes a single step-progress entry from persisted state.
 * Ensures unknown statuses fall back to 'pending'.
 * @param {object} raw
 * @returns {{ stepId: string, status: string }}
 */
const normalizeStepProgress = (raw) => ({
  stepId: typeof raw?.stepId === 'string' ? raw.stepId : '',
  status: STEP_STATUSES.includes(raw?.status) ? raw.status : 'pending'
});

/**
 * Derives the per-step display state for a recipe given stored progress.
 *
 * Rules:
 *   - If a step has an explicit entry in stepProgress, use that status.
 *   - Otherwise all steps before the first non-done step are 'done', the
 *     first non-done step is 'current', and the rest are 'pending'.
 *   - If all steps are done the recipe is 'complete'.
 *
 * @param {object} recipe         - a WORKFLOW_RECIPES entry
 * @param {object[]} stepProgress - array of { stepId, status } from stored state
 * @returns {{ steps: Array<{ id, label, rationale, scrollTarget, quickAction, status }>, recipeStatus: string }}
 */
export const buildRecipeProgress = (recipe, stepProgress = []) => {
  if (!recipe || !Array.isArray(recipe.steps)) {
    return { steps: [], recipeStatus: 'not_started' };
  }

  const progressMap = new Map(
    stepProgress
      .map(normalizeStepProgress)
      .filter((p) => p.stepId)
      .map((p) => [p.stepId, p.status])
  );

  let foundCurrent = false;
  const steps = recipe.steps.map((step) => {
    const stored = progressMap.get(step.id);
    let status;
    if (stored) {
      status = stored;
    } else if (foundCurrent) {
      status = 'pending';
    } else {
      status = 'current';
      foundCurrent = true;
    }
    return { ...step, status };
  });

  const allDone = steps.every((s) => s.status === 'done' || s.status === 'skipped');
  const anyProgress = steps.some((s) => s.status === 'done' || s.status === 'current');
  const recipeStatus = allDone ? 'complete' : anyProgress ? 'in_progress' : 'not_started';

  return { steps, recipeStatus };
};

/**
 * Advances one step in a recipe: marks the step as done, returns updated
 * stepProgress array.
 *
 * @param {string}   recipeId
 * @param {string}   stepId
 * @param {object[]} stepProgress  current stored progress array
 * @returns {object[]} updated stepProgress array
 */
export const markStepDone = (recipeId, stepId, stepProgress = []) => {
  const recipe = getRecipeById(recipeId);
  if (!recipe) return stepProgress;
  const stepExists = recipe.steps.some((s) => s.id === stepId);
  if (!stepExists) return stepProgress;

  const existing = stepProgress.filter((p) => p.stepId !== stepId);
  return [...existing, { stepId, status: 'done' }];
};

/**
 * Resets all step progress for a given recipe.
 *
 * @param {string}   recipeId
 * @param {object[]} stepProgress  current stored progress array
 * @returns {object[]} updated stepProgress array (recipe steps removed)
 */
export const resetRecipeProgress = (recipeId, stepProgress = []) => {
  const recipe = getRecipeById(recipeId);
  if (!recipe) return stepProgress;
  const stepIds = new Set(recipe.steps.map((s) => s.id));
  return stepProgress.filter((p) => !stepIds.has(p.stepId));
};

/**
 * Returns a summary object for all recipes given current step progress.
 *
 * @param {object[]} stepProgress
 * @returns {Array<{ id, title, recipeStatus, completedSteps, totalSteps }>}
 */
export const buildRecipesSummary = (stepProgress = []) =>
  WORKFLOW_RECIPES.map((recipe) => {
    const { steps, recipeStatus } = buildRecipeProgress(recipe, stepProgress);
    const completedSteps = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
    return {
      id: recipe.id,
      title: recipe.title,
      recipeStatus,
      completedSteps,
      totalSteps: recipe.steps.length
    };
  });

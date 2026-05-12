import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKFLOW_RECIPES,
  STEP_STATUSES,
  RECIPE_STATUSES,
  getRecipeById,
  buildRecipeProgress,
  markStepDone,
  resetRecipeProgress,
  buildRecipesSummary
} from '../src/workflow-recipes.js';

// ── constants ──────────────────────────────────────────────────────────────

test('WORKFLOW_RECIPES contains at least 3 recipes', () => {
  assert.ok(Array.isArray(WORKFLOW_RECIPES));
  assert.ok(WORKFLOW_RECIPES.length >= 3);
});

test('every recipe has required fields', () => {
  for (const recipe of WORKFLOW_RECIPES) {
    assert.ok(typeof recipe.id === 'string' && recipe.id, `recipe.id must be non-empty string`);
    assert.ok(typeof recipe.title === 'string' && recipe.title, `recipe.title must be non-empty string`);
    assert.ok(typeof recipe.description === 'string', `recipe.description must be string`);
    assert.ok(Array.isArray(recipe.steps) && recipe.steps.length > 0, `recipe.steps must be non-empty array`);
  }
});

test('every step in every recipe has required fields', () => {
  for (const recipe of WORKFLOW_RECIPES) {
    for (const step of recipe.steps) {
      assert.ok(typeof step.id === 'string' && step.id, `step.id must be non-empty string`);
      assert.ok(typeof step.label === 'string' && step.label, `step.label must be non-empty string`);
      assert.ok(typeof step.rationale === 'string' && step.rationale, `step.rationale must be non-empty string`);
    }
  }
});

test('STEP_STATUSES contains expected values', () => {
  assert.deepEqual(STEP_STATUSES, ['pending', 'current', 'done', 'skipped']);
});

test('RECIPE_STATUSES contains expected values', () => {
  assert.deepEqual(RECIPE_STATUSES, ['not_started', 'in_progress', 'complete']);
});

// ── getRecipeById ──────────────────────────────────────────────────────────

test('getRecipeById returns recipe for known id', () => {
  const recipe = getRecipeById('nova-cena');
  assert.ok(recipe);
  assert.equal(recipe.id, 'nova-cena');
});

test('getRecipeById returns null for unknown id', () => {
  assert.equal(getRecipeById('unknown-id'), null);
});

// ── buildRecipeProgress ────────────────────────────────────────────────────

test('buildRecipeProgress with empty progress marks first step as current', () => {
  const recipe = getRecipeById('nova-cena');
  const { steps, recipeStatus } = buildRecipeProgress(recipe, []);
  assert.equal(steps[0].status, 'current');
  assert.ok(steps.slice(1).every((s) => s.status === 'pending'));
  assert.equal(recipeStatus, 'in_progress');
});

test('buildRecipeProgress with all steps done returns complete', () => {
  const recipe = getRecipeById('nova-cena');
  const stepProgress = recipe.steps.map((s) => ({ stepId: s.id, status: 'done' }));
  const { recipeStatus, steps } = buildRecipeProgress(recipe, stepProgress);
  assert.equal(recipeStatus, 'complete');
  assert.ok(steps.every((s) => s.status === 'done'));
});

test('buildRecipeProgress respects stored step statuses', () => {
  const recipe = getRecipeById('review-inbox');
  const stepProgress = [
    { stepId: recipe.steps[0].id, status: 'done' },
    { stepId: recipe.steps[1].id, status: 'done' }
  ];
  const { steps } = buildRecipeProgress(recipe, stepProgress);
  assert.equal(steps[0].status, 'done');
  assert.equal(steps[1].status, 'done');
});

test('buildRecipeProgress ignores unknown step ids in progress', () => {
  const recipe = getRecipeById('pre-export');
  const stepProgress = [{ stepId: 'nonexistent-step', status: 'done' }];
  const { steps } = buildRecipeProgress(recipe, stepProgress);
  // Should still work fine and first step should be current
  assert.equal(steps[0].status, 'current');
});

test('buildRecipeProgress returns empty steps for null recipe', () => {
  const { steps, recipeStatus } = buildRecipeProgress(null, []);
  assert.deepEqual(steps, []);
  assert.equal(recipeStatus, 'not_started');
});

test('buildRecipeProgress handles skipped steps in complete check', () => {
  const recipe = getRecipeById('nova-cena');
  const stepProgress = recipe.steps.map((s) => ({ stepId: s.id, status: 'skipped' }));
  const { recipeStatus } = buildRecipeProgress(recipe, stepProgress);
  assert.equal(recipeStatus, 'complete');
});

// ── markStepDone ───────────────────────────────────────────────────────────

test('markStepDone adds a done entry for the given step', () => {
  const recipe = getRecipeById('nova-cena');
  const firstStep = recipe.steps[0];
  const result = markStepDone('nova-cena', firstStep.id, []);
  assert.equal(result.length, 1);
  assert.equal(result[0].stepId, firstStep.id);
  assert.equal(result[0].status, 'done');
});

test('markStepDone overwrites existing progress entry for a step', () => {
  const recipe = getRecipeById('nova-cena');
  const firstStep = recipe.steps[0];
  const initial = [{ stepId: firstStep.id, status: 'current' }];
  const result = markStepDone('nova-cena', firstStep.id, initial);
  assert.equal(result.filter((p) => p.stepId === firstStep.id).length, 1);
  assert.equal(result.find((p) => p.stepId === firstStep.id).status, 'done');
});

test('markStepDone returns unchanged array for unknown recipe', () => {
  const initial = [{ stepId: 'some-step', status: 'done' }];
  const result = markStepDone('no-such-recipe', 'some-step', initial);
  assert.deepEqual(result, initial);
});

test('markStepDone returns unchanged array for unknown step in valid recipe', () => {
  const initial = [{ stepId: 'some-step', status: 'done' }];
  const result = markStepDone('nova-cena', 'not-a-real-step', initial);
  assert.deepEqual(result, initial);
});

// ── resetRecipeProgress ────────────────────────────────────────────────────

test('resetRecipeProgress removes all steps belonging to recipe', () => {
  const recipe = getRecipeById('nova-cena');
  const stepProgress = recipe.steps.map((s) => ({ stepId: s.id, status: 'done' }));
  // Add an entry from another recipe too
  stepProgress.push({ stepId: 'review-inbox-1', status: 'done' });
  const result = resetRecipeProgress('nova-cena', stepProgress);
  // Only the non-nova-cena step should remain
  assert.equal(result.length, 1);
  assert.equal(result[0].stepId, 'review-inbox-1');
});

test('resetRecipeProgress returns unchanged array for unknown recipe', () => {
  const initial = [{ stepId: 'review-inbox-1', status: 'done' }];
  const result = resetRecipeProgress('no-such-recipe', initial);
  assert.deepEqual(result, initial);
});

// ── buildRecipesSummary ────────────────────────────────────────────────────

test('buildRecipesSummary returns one entry per recipe', () => {
  const summary = buildRecipesSummary([]);
  assert.equal(summary.length, WORKFLOW_RECIPES.length);
});

test('buildRecipesSummary shows in_progress when no stored progress', () => {
  const summary = buildRecipesSummary([]);
  // With no stored progress, first step is 'current' -> in_progress
  // (because buildRecipeProgress marks first step as current by default)
  for (const s of summary) {
    assert.equal(s.recipeStatus, 'in_progress');
    assert.equal(s.completedSteps, 0);
  }
});

test('buildRecipesSummary reflects completed steps correctly', () => {
  const recipe = getRecipeById('nova-cena');
  const stepProgress = recipe.steps.slice(0, 2).map((s) => ({ stepId: s.id, status: 'done' }));
  const summary = buildRecipesSummary(stepProgress);
  const entry = summary.find((s) => s.id === 'nova-cena');
  assert.ok(entry);
  assert.equal(entry.completedSteps, 2);
  assert.equal(entry.totalSteps, recipe.steps.length);
  assert.equal(entry.recipeStatus, 'in_progress');
});

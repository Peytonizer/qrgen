// The step rail: tracks which of the four panels is visible and which steps
// the user may currently jump to by clicking the rail.
//
// Per SPEC.md ("Interface — Walkthrough"): steps 1 and 2 must be completed in
// order (step 2 needs a parsed file to show anything), but once a file is
// loaded and mapped the user may move freely between 2, 3 and 4 — re-styling
// after seeing the download screen is a normal thing to want. Mapping happens
// automatically the moment a file parses, so unlocking 2-4 together on parse
// satisfies that rule without a separate "confirm mapping" action.

/**
 * Wires up a step rail. `railEl` is the nav containing one button per step
 * (`data-step="1..4"`); `panelEls` is the list of step panels
 * (`data-step-panel="1..4"`). Returns `{ goTo, unlock, current }`.
 */
export function createStepRail(railEl, panelEls, { onStepChange } = {}) {
  const buttons = [...railEl.querySelectorAll('[data-step]')];
  let current = 1;
  const reachable = new Set([1]);

  function render() {
    buttons.forEach((btn) => {
      const step = Number(btn.dataset.step);
      const isCurrent = step === current;
      btn.classList.toggle('is-current', isCurrent);
      btn.classList.toggle('is-done', step < current);
      btn.disabled = !reachable.has(step);
      if (isCurrent) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    });
    panelEls.forEach((panel) => {
      panel.hidden = Number(panel.dataset.stepPanel) !== current;
    });
  }

  function goTo(step) {
    if (!reachable.has(step) || step === current) return;
    current = step;
    render();
    onStepChange?.(step);
  }

  /** Adds `steps` (an array of step numbers) to the set the rail allows jumping to. */
  function unlock(steps) {
    steps.forEach((step) => reachable.add(step));
    render();
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => goTo(Number(btn.dataset.step)));
  });

  render();

  return {
    goTo,
    unlock,
    get current() {
      return current;
    },
  };
}

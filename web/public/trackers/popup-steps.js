/**
 * Multi-step popup: a few one-tap questions, then the email form.
 *
 * Asking something easy first is the whole trick — a visitor who has answered two
 * questions is likelier to finish than one shown an email box cold. Answers are stored
 * with the lead under each step's name, so the owner learns who the lead is as well as
 * how to reach them.
 */
import { el } from './popup-util.js';

/** "Step 2 of 4". The email step counts, so the visitor can see how little is left. */
export const progressLabel = (index, questionCount) => `Step ${index + 1} of ${questionCount + 1}`;

/**
 * @param {object[]} steps         validated step definitions
 * @param {object}   handlers      `{ renderFinal(answers, container) }` — shows the email step
 * @returns {{ el: HTMLElement }}
 */
export const buildSteps = (steps, { renderFinal }) => {
  const container = el('div', { className: 'snc-steps' });
  const answers = {};
  let index = 0;

  const show = () => {
    if (index >= steps.length) {
      container.replaceChildren();
      const progress = el('p', { className: 'snc-step-progress', textContent: progressLabel(steps.length, steps.length) });
      const slot = el('div');
      container.append(progress, slot);
      renderFinal({ ...answers }, slot);
      return;
    }
    const step = steps[index];
    const title = el('h3', { className: 'snc-step-title', textContent: step.title });
    const options = el('div', { className: 'snc-step-options' });
    for (const option of step.options) {
      const button = el('button', { type: 'button', className: 'snc-step-option', textContent: option.label });
      button.addEventListener('click', () => { answers[step.name] = option.value; index++; show(); });
      options.append(button);
    }
    const children = [el('p', { className: 'snc-step-progress', textContent: progressLabel(index, steps.length) }), title];
    if (step.body) children.push(el('p', { className: 'snc-step-body', textContent: step.body }));
    children.push(options);
    if (index > 0) {
      const back = el('button', { type: 'button', className: 'snc-step-back', textContent: 'Back' });
      back.addEventListener('click', () => { index--; show(); });
      children.push(back);
    }
    container.replaceChildren(...children);
    // Keyboard and screen-reader users land on the new question, not on a removed button.
    const first = options.querySelector('button');
    if (first && container.isConnected) first.focus({ preventScroll: true });
  };

  show();
  return { el: container };
};

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MAX_OPTIONS, MAX_STEPS, MIN_OPTIONS, addOption, addStep, removeOption, removeStep, updateOptionLabel, updateStep, validateSteps,
  type PopupStep,
} from '@/lib/popup-config';
import { Labeled, Problems, inp } from './fields';

/**
 * The questions of a multi-step popup, asked one at a time before the email.
 *
 * Each question's *name* is the key its answer is stored under on the lead; each answer's
 * *value* is what is stored. Values follow the label as it is typed until set apart.
 */
export function StepsFields({ steps, onChange }: { steps: PopupStep[]; onChange: (s: PopupStep[]) => void }) {
  const set = (i: number, step: PopupStep) => onChange(updateStep(steps, i, step));
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="space-y-2 rounded-md border border-border/60 p-2">
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Labeled label={`Question ${i + 1}`}>
              <Input value={step.title} maxLength={120} onChange={(e) => set(i, { ...step, title: e.target.value })} className={inp} />
            </Labeled>
            <Labeled label="Stored as">
              <Input value={step.name} maxLength={40} onChange={(e) => set(i, { ...step, name: e.target.value })} className={inp} />
            </Labeled>
            <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label={`Remove question ${i + 1}`} disabled={steps.length <= 1} onClick={() => onChange(removeStep(steps, i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {step.options.map((o, j) => (
            <div key={j} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 pl-3">
              <Labeled label={`Answer ${j + 1}`}>
                <Input value={o.label} maxLength={60} onChange={(e) => set(i, updateOptionLabel(step, j, e.target.value))} className={inp} />
              </Labeled>
              <Labeled label="Value">
                <Input value={o.value} maxLength={60} onChange={(e) => set(i, { ...step, options: step.options.map((x, k) => (k === j ? { ...x, value: e.target.value } : x)) })} className={inp} />
              </Labeled>
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label={`Remove answer ${j + 1}`} disabled={step.options.length <= MIN_OPTIONS} onClick={() => set(i, removeOption(step, j))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={step.options.length >= MAX_OPTIONS} onClick={() => set(i, addOption(step))}>
            <Plus className="h-3 w-3" /> Add answer
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="h-8 gap-1" disabled={steps.length >= MAX_STEPS} onClick={() => onChange(addStep(steps))}>
        <Plus className="h-3.5 w-3.5" /> Add question
      </Button>
      <p className="text-[11px] text-muted-foreground">The email step comes last, so a visitor sees “Step {steps.length + 1} of {steps.length + 1}” there.</p>
      <Problems problems={validateSteps(steps)} />
    </div>
  );
}

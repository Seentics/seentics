import { useEffect, useRef } from 'react';
import { CornerDownLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isSending?: boolean;
  placeholder?: string;
  /** Matches the server's own prompt ceiling, so the limit is felt before the refusal. */
  maxLength?: number;
  className?: string;
}

/** The input. Controlled, so the parent owns the draft and can prefill it. */
export function ChatComposer({
  value, onChange, onSend, isSending, placeholder, maxLength = 2000, className,
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  /*
   * One row that grows to the text, capped before it takes over the screen.
   *
   * A fixed two-row box is mostly empty for the one-line questions people actually ask,
   * and too small for the occasional long one. Height is reset before measuring because
   * `scrollHeight` never shrinks on its own.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 76), 220)}px`;
  }, [value]);

  return (
    /*
     * Raised off the page rather than separated by a rule. The composer sits at the
     * bottom of a scrolling column, so it needs to read as the thing in front — a border
     * alone reads as a seam, and content scrolling behind it needs somewhere to go.
     */
    <div
      className={cn(
        'relative rounded-xl border border-border bg-card',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.12)]',
        'transition-shadow focus-within:border-primary/40',
        'focus-within:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-8px_rgba(0,0,0,0.18)]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_10px_28px_-10px_rgba(0,0,0,0.6)]',
        className,
      )}
    >
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends, shift+enter breaks the line — what a chat box is expected to do
          // rather than what a form field does.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={placeholder}
        rows={1}
        maxLength={maxLength}
        className="max-h-[200px] min-h-[76px] resize-none border-0 bg-transparent px-4 py-3.5 pr-14 text-sm shadow-none focus-visible:ring-0"
      />
      <Button
        size="icon"
        className="absolute bottom-2.5 right-2.5 h-9 w-9"
        disabled={!value.trim() || isSending}
        onClick={onSend}
      >
        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CornerDownLeft className="h-4 w-4" />}
      </Button>
    </div>
  );
}

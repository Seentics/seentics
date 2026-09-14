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
  return (
    <div className={cn('relative', className)}>
      <Textarea
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
        rows={2}
        maxLength={maxLength}
        className="resize-none pr-12 text-sm"
      />
      <Button
        size="icon"
        className="absolute bottom-2 right-2 h-8 w-8"
        disabled={!value.trim() || isSending}
        onClick={onSend}
      >
        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CornerDownLeft className="h-4 w-4" />}
      </Button>
    </div>
  );
}

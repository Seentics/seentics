import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FrequencyControlProps {
  value: string;
  onChange: (value: string) => void;
  triggerType?: string;
}

export const FrequencyControl: React.FC<FrequencyControlProps> = ({ 
  value, 
  onChange,
  triggerType 
}) => {
  // Default frequency based on trigger type
  const getDefaultFrequency = () => {
    switch (triggerType) {
      case 'pageView':
      case 'scroll':
      case 'timeOnPage':
        return 'once_per_session';
      case 'exitIntent':
      case 'formSubmit':
        return 'once_per_session';
      case 'click':
        return 'always';
      case 'funnelDropoff':
      case 'funnelComplete':
      case 'goalCompleted':
        return 'always';
      default:
        return 'always';
    }
  };

  const currentValue = value || getDefaultFrequency();

  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
        Frequency Control
      </Label>
      <Select 
        value={currentValue}
        onValueChange={onChange}
      >
        <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-800 text-white">
          <SelectItem value="always">
            <div className="flex flex-col">
              <span>Every time</span>
              <span className="text-[10px] text-slate-500">Trigger on every occurrence</span>
            </div>
          </SelectItem>
          <SelectItem value="once_per_session">
            <div className="flex flex-col">
              <span>Once per session</span>
              <span className="text-[10px] text-slate-500">Max 1 time per browser session</span>
            </div>
          </SelectItem>
          <SelectItem value="once_per_visitor">
            <div className="flex flex-col">
              <span>Once per visitor</span>
              <span className="text-[10px] text-slate-500">Only once ever (uses cookie)</span>
            </div>
          </SelectItem>
          <SelectItem value="once_per_day">
            <div className="flex flex-col">
              <span>Once per day</span>
              <span className="text-[10px] text-slate-500">Max 1 time per 24 hours</span>
            </div>
          </SelectItem>
          <SelectItem value="once_per_hour">
            <div className="flex flex-col">
              <span>Once per hour</span>
              <span className="text-[10px] text-slate-500">Max 1 time per 60 minutes</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="text-[10px] text-slate-500">
        Controls how often this automation can trigger for the same user. 
        {currentValue === 'always' && ' ⚠️ Use with caution - may annoy users.'}
        {currentValue === 'once_per_session' && ' ✅ Recommended for most cases.'}
        {currentValue === 'once_per_visitor' && ' 🔒 Permanent limit per user.'}
      </p>
    </div>
  );
};

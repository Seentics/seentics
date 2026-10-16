import { describe, expect, it } from 'vitest';
import { noRecordingReason } from '@/components/replays/no-recording';

describe('why a session has no recording', () => {
  it('a visit of a second or two ended before the recorder loaded', () => {
    expect(noRecordingReason({ durationSeconds: 0, signalTypes: ['network_event'] }).title).toBe('The visit was too short to record');
    expect(noRecordingReason({ durationSeconds: 2, signalTypes: [] }).body).toContain('after 2 seconds');
    expect(noRecordingReason({ durationSeconds: 1, signalTypes: [] }).body).toContain('after 1 second,');
  });

  it('a longer visit with side events but no page: the recorder was blocked, naming what was captured', () => {
    const r = noRecordingReason({ durationSeconds: 26, signalTypes: ['network_event', 'network_event', 'console_event'] });
    expect(r.title).toBe('The page recorder didn’t start');
    expect(r.body).toContain('network requests and console messages were captured');
    expect(noRecordingReason({ durationSeconds: 40, signalTypes: ['session_error'] }).body).toContain('errors were captured');
  });

  it('nothing at all: not recorded', () => {
    expect(noRecordingReason({ durationSeconds: 90, signalTypes: [] }).title).toBe('No recording for this session');
    expect(noRecordingReason({ durationSeconds: undefined, signalTypes: [] }).title).toBe('The visit was too short to record');
  });
});

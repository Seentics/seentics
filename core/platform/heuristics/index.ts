/**
 * Seentics' statistics engine and message templates, shared by every module.
 *
 * Everything here is pure: plain data in, numbers or plain-language text out, no database, no
 * model, no clock unless one is passed. The modules own *what* to measure (heatmaps read clicks,
 * recordings read rrweb streams, the anomaly check reads hourly counts); this library owns *how*
 * a measurement is judged and how it is said, so the same rules hold in every message.
 *
 * - `stats`: robust baselines, z-scores, two-proportion tests, change.
 * - `format`: how counts, changes, rates and durations read.
 * - `privacy`: masking ids, emails and secrets out of paths and messages.
 * - `templates/*`: the plain-language messages, written from those, and used wherever a model
 *   is not: by default for calm cases, and as the fallback when AI is off or over its allowance.
 */
export * from './stats';
export * from './format';
export * from './privacy';
export * from './templates/visit';

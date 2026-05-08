/*!
 * Seentics rrweb loader — exposes window.__rrweb_record for the main tracker.
 * Built as a separate IIFE so it can be loaded lazily after seentics.js.
 */
import { record } from 'rrweb';
(window as any).__rrweb_record = record;

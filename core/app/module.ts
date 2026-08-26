import type { AppConfig } from "../config";

/**
 * The lifecycle half of a composed module.
 *
 * Both hooks are optional because most modules have neither: a module that is only
 * services and routes is fully alive the moment it is composed. The two that do own
 * background work (heatmaps' engine and screenshot cache, ingest's flush timer)
 * declare it here instead of having the composition root reach into their internals
 * to start and stop it.
 *
 * `start` takes the config rather than closing over it at compose time, so composing
 * the graph stays side-effect free — nothing opens a socket, launches a browser or
 * arms a timer until the HTTP server is already listening.
 */
export type ModuleLifecycle = {
  /** One-time initialisation. Called after the server is listening. */
  start?(cfg: AppConfig): Promise<void> | void;

  /**
   * Release background work. Called in reverse composition order.
   *
   * Must not throw for a resource that is already gone: shutdown runs on the way
   * out, and a module refusing to stop cleanly would strand the ones behind it.
   */
  stop?(): Promise<void> | void;
};

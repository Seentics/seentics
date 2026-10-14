/**
 * The masking rules, as a public surface.
 *
 * One definition of "what identifies a person in a path or a message" for everything that
 * stores or sends visitor-derived text: the insights read it, and the recordings module
 * masks element labels and error messages with it before a session analysis is stored.
 * Re-exported here because a peer may only import a module's `interfaces`.
 */
export { looksPersonal, maskPath, maskText } from "../insights/privacy";

/**
 * Public contracts for the auth module.
 *
 * Auth owns `users`. `UserDirectory` is the only capability peers need — nothing
 * outside this module has any business with password hashes or token signing.
 */
export type { FrontendUser, UserProfile, UserDirectory } from "./auth.interface";

/** The whole module surface, as a peer receives it at composition time. */
export type { AuthModule } from "./auth.module";

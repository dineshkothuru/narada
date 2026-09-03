import type { Kysely } from "kysely";
import type { DB } from "./db/types.js";
import { env } from "./env.js";
import { makeRepos, type Repos } from "./repositories/index.js";

// llm/sarvam/storage clients are added in Phase A2 (see
// docs/VOICE-AGENT-PLAN.md); this is the composition root's shape today.
export type Deps = {
  env: typeof env;
  repos: Repos;
  clock: () => Date;
};

export function makeDeps(db: Kysely<DB>, overrides?: Partial<Deps>): Deps {
  return {
    env,
    clock: () => new Date(),
    ...overrides,
    // pg.Pool connects lazily, so callers that pass a repos override (tests)
    // never construct real repos and never open a socket. Resolved last so an
    // explicit `repos: undefined` in overrides can't clobber the fallback.
    repos: overrides?.repos ?? makeRepos(db),
  };
}

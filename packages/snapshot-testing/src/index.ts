export type * from './types.ts'

// node:test entrypoint
export { createFixtureTests } from './node-test/index.ts'

// instruction extractors
export { fromLineComment } from './instructions/extractors/line-comment.ts'

// post-processors
export { collapseKey } from './post-processors/collapse-key.ts'

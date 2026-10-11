import { mergeConfig } from "vitest/config";
import base from "./vitest.config";

/** Live acceptance tests: hit the real external sources. Run with `npm run test:live`. */
export default mergeConfig(base, {
  test: { include: ["tests/live/**/*.test.ts"], testTimeout: 180_000 },
});

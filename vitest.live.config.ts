import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Live acceptance tests: hit the real external sources. Run with `npm run test:live`. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/helpers/empty.ts", import.meta.url)),
    },
  },
  test: { include: ["tests/live/**/*.test.ts"], environment: "node", testTimeout: 180_000 },
});

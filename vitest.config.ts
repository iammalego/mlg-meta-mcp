import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Automatically clear mock state (calls, instances, results) between every test.
    // This prevents state leaking from one test into another without needing
    // a manual beforeEach(() => vi.clearAllMocks()) in every describe block.
    clearMocks: true,
  },
});

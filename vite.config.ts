import { cloudflare } from '@cloudflare/vite-plugin';
import { flue, flueWorkerConfig } from '@flue/vite';
import { defineConfig, lazyPlugins } from 'vite-plus';

export default defineConfig({
  fmt: {
    ignorePatterns: ['dist/**', '.flue-vite/**', '.wrangler/**', 'worker-configuration.d.ts'],
    singleQuote: true,
  },
  lint: {
    ignorePatterns: ['dist/**', '.flue-vite/**', '.wrangler/**', 'worker-configuration.d.ts'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  plugins: lazyPlugins(() => [flue(), cloudflare({ config: flueWorkerConfig() })]),
});

import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'source-provenance',
    generateBundle() {
      const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim());
      this.emitFile({
        type: 'asset',
        fileName: 'source.json',
        source: JSON.stringify({ generation: 2, source, sourceDirty }, null, 2) + '\n',
      });
    },
  }],
});

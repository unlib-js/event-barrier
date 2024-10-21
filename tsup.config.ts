import { defineConfig } from 'tsup'


export default defineConfig({
  entryPoints: [ 'src/index.ts' ],
  format: [ 'cjs', 'esm' ],
  dts: true,
  sourcemap: true,
  outDir: 'build',
  splitting: true
})

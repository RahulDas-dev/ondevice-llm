import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  base: '/ondevice-llm/',        // ← REQUIRED for GitHub Pages subpath
  plugins: [
    viteSingleFile()             // inlines all JS/CSS into one HTML file
  ],
  build: {
    outDir: 'dist',
    target: 'esnext',            // needed for top-level await & modern APIs
    minify: 'terser',            // you already have terser installed
  }
})
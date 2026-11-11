import { defineConfig } from 'vite'
import { serveRideResearch } from './server/ride-research.mjs'

export default defineConfig({
  plugins: [{
    name: 'riverloop-ride-research',
    configureServer: serveRideResearch,
    configurePreviewServer: serveRideResearch,
  }],
})

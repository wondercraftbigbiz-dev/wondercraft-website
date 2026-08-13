// Lets plain node run scripts that import the app's modules.
//
// Two things node cannot do on its own:
//  - resolve the "@/..." path alias from tsconfig
//  - import 'server-only', whose default export throws by design
//
// Register with: node --import ./scripts/node-hooks.mjs
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(new URL('./node-hooks-impl.mjs', import.meta.url), pathToFileURL('./'))

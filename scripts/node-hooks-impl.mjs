import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = process.cwd()

/**
 * `server-only` guards modules against being pulled into a client bundle. In a
 * plain node script there is no client bundle, so map it to an empty module
 * instead of letting its intentional throw fire.
 */
const EMPTY = 'data:text/javascript,export {}'

export async function resolve(specifier, context, next) {
  if (specifier === 'server-only' || specifier === 'client-only') {
    return { url: EMPTY, shortCircuit: true, format: 'module' }
  }

  if (specifier.startsWith('@/')) {
    const resolved = resolveFile(path.join(ROOT, specifier.slice(2)))
    if (resolved) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true }
    }
  }

  // Relative imports inside those modules are extensionless too.
  if (specifier.startsWith('.') && !path.extname(specifier)) {
    const parentPath = context.parentURL?.startsWith('file:')
      ? path.dirname(fileURLToPath(context.parentURL))
      : ROOT
    const resolved = resolveFile(path.resolve(parentPath, specifier))
    if (resolved) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true }
    }
  }

  return next(specifier, context)
}

function resolveFile(base) {
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.js`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
  ]
  return candidates.find((c) => existsSync(c))
}

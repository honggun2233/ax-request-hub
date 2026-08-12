import type { Graph } from './types'
import { buildGraph } from './load'

let cached: Graph | null = null
let cachedAt = 0
const TTL_MS = 60_000

export async function getGraph(force?: boolean): Promise<Graph> {
  if (!force && cached && Date.now() - cachedAt < TTL_MS) return cached
  cached = await buildGraph()
  cachedAt = Date.now()
  return cached
}

export function invalidateGraph(): void {
  cached = null
  cachedAt = 0
}

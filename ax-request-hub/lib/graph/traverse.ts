import { Graph, NodeKey, EdgeType, TraversalHit } from './types'

export function traverse(
  graph: Graph,
  start: NodeKey,
  opts: { maxHops: number; allowedEdges: EdgeType[]; includeRetired?: boolean }
): TraversalHit[] {
  const visited = new Set<NodeKey>()
  const results: TraversalHit[] = []

  interface QueueItem {
    key: NodeKey
    hops: number
    via: EdgeType[]
  }

  const queue: QueueItem[] = [{ key: start, hops: 0, via: [] }]
  visited.add(start)

  while (queue.length > 0) {
    const item = queue.shift()!

    if (item.hops >= opts.maxHops) {
      continue
    }

    for (const edge of graph.edges) {
      if (edge.from !== item.key && edge.to !== item.key) {
        continue
      }

      if (!opts.allowedEdges.includes(edge.type)) {
        continue
      }

      const neighbor: NodeKey = edge.from === item.key ? edge.to : edge.from

      if (visited.has(neighbor)) {
        continue
      }

      visited.add(neighbor)

      const node = graph.nodes.get(neighbor)
      if (!node) {
        continue
      }

      const nextVia = [...item.via, edge.type]

      if (node.meta.retired === true && !opts.includeRetired) {
        // Excluded from results but still traversed
      } else {
        results.push({
          node,
          hops: item.hops + 1,
          via: nextVia,
        })
      }

      queue.push({ key: neighbor, hops: item.hops + 1, via: nextVia })
    }
  }

  return results
}

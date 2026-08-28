'use client'

import * as d3 from 'd3'
import {
  LinkIcon,
  MaximizeIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  RotateCwIcon,
  UnlinkIcon,
  XCircleIcon,
  XIcon
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { executeQuery } from '@/lib/triplestore'
import type { SparqlBindingValue } from '@/types'
import NodeInfoPanel from './node-info-panel'

// Types
export interface Node {
  id: string
  label: string
  type: string
  size: number
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  fixed?: boolean
  isLoading?: boolean
  rdfType?: string | null
}

export interface Link {
  source: string | Node
  target: string | Node
  predicates: string[]
  id?: string
}

export interface GraphData {
  nodes: Node[]
  links: Link[]
}

// Additional types for RDF data
interface RdfNode {
  id: string
  position: { x: number; y: number }
  type?: string
  data: {
    label: string
    uri: string
    rdfType?: string | null
  }
}

interface RdfEdge {
  id: string
  source: string
  target: string
  label: string
  data: { predicate: string }
}

type QueryBinding = {
  p: SparqlBindingValue
  o: SparqlBindingValue
  subjRdfType?: SparqlBindingValue
  rdfType?: SparqlBindingValue
}

// Custom hook for colors
function useTypeColors() {
  const [typeColorMap, setTypeColorMap] = useState<Record<string, string>>({})

  // Generate a random color
  const generateRandomColor = useCallback((): string => {
    const hue = Math.floor(Math.random() * 360)
    return `hsl(${hue}, 70%, 60%)`
  }, [])

  // Get or create a color for a type
  const getNodeColor = useCallback(
    (rdfType?: string | null): string => {
      // If we have an rdf:type, use that for coloring
      if (rdfType) {
        if (!typeColorMap[rdfType]) {
          setTypeColorMap((prev) => ({
            ...prev,
            [rdfType]: generateRandomColor()
          }))
        }
        return typeColorMap[rdfType] || '#dfe6e9'
      }
      return '#dfe6e9'
    },
    [typeColorMap, generateRandomColor]
  )

  return { typeColorMap, getNodeColor }
}

// Helper functions
const shortenUri = (uri: string): string => {
  const parts = uri.split(/[/#]/)
  return parts[parts.length - 1]
}

const formatPredicate = (predicate: string) => {
  return shortenUri(predicate)
}

// Fetch RDF data for a URI
const fetchRdfData = async (
  uri: string,
  limit: number = Infinity
): Promise<{ nodes: RdfNode[]; edges: RdfEdge[] }> => {
  try {
    const query = `
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT ?p ?o ?subjRdfType ?rdfType
      WHERE {
        <${uri}> ?p ?o .
        OPTIONAL { <${uri}> rdf:type ?subjRdfType }
        OPTIONAL { ?o rdf:type ?rdfType }
      }
      ${limit === Infinity ? '' : `LIMIT ${limit}`}
    `
    const result = await executeQuery(query)

    if (result.kind !== 'bindings') {
      return { nodes: [], edges: [] }
    }

    // Process and transform query results efficiently
    const nodes: RdfNode[] = []
    const edges: RdfEdge[] = []
    const addedNodes = new Set<string>([uri])
    const processedObjects = new Map<string, { rdfType: string | null }>()

    // Find main node type
    let nodeType: string | null = null
    for (const binding of result.bindings as QueryBinding[]) {
      if (binding.subjRdfType?.value) {
        nodeType = binding.subjRdfType.value
        break
      }
    }

    // Add source node
    nodes.push({
      id: uri,
      position: { x: 0, y: 0 },
      data: {
        label: shortenUri(uri),
        uri: uri,
        rdfType: nodeType
      }
    })

    // First pass to collect type information
    ;(result.bindings as QueryBinding[]).forEach((binding: QueryBinding) => {
      const object = binding.o.value

      if (
        binding.p.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
        binding.o.type === 'uri'
      ) {
        if (!processedObjects.has(uri)) {
          processedObjects.set(uri, { rdfType: binding.o.value })
        }
      }

      if (
        binding.o.type === 'uri' &&
        binding.rdfType &&
        binding.rdfType.value
      ) {
        processedObjects.set(object, { rdfType: binding.rdfType.value })
      }
    })

    // Second pass to create nodes and edges
    const totalBindings = result.bindings.length
    ;(result.bindings as QueryBinding[]).forEach(
      (binding: QueryBinding, index: number) => {
        const predicate = binding.p.value
        const object = binding.o.value

        if (!addedNodes.has(object) && binding.o.type === 'uri') {
          const objInfo = processedObjects.get(object) || { rdfType: null }

          nodes.push({
            id: object,
            position: {
              x: 200,
              y: index * 50 - totalBindings * 25
            },
            data: {
              label: shortenUri(object),
              uri: object,
              rdfType: objInfo.rdfType
            }
          })
          addedNodes.add(object)
        }

        if (binding.o.type === 'uri') {
          edges.push({
            id: `${uri}-${predicate}-${object}`,
            source: uri,
            target: object,
            label: shortenUri(predicate),
            data: { predicate }
          })
        }
      }
    )

    return { nodes, edges }
  } catch (error) {
    console.error('Error fetching RDF data:', error)
    return { nodes: [], edges: [] }
  }
}

// Convert RDF data to graph format
const convertRdfToGraphData = (rdfData: {
  nodes: RdfNode[]
  edges: RdfEdge[]
}): GraphData => {
  const nodes: Node[] = rdfData.nodes.map((node) => ({
    id: node.id,
    label: node.data.label,
    type: node.type || 'default',
    rdfType: node.data.rdfType,
    size: 24,
    x: node.position?.x,
    y: node.position?.y
  }))

  const links: Link[] = rdfData.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    predicates: [edge.data.predicate]
  }))

  return { nodes, links }
}

export default function GraphVisualization({
  initialUri,
  autoSelectNode
}: {
  initialUri: string
  autoSelectNode?: boolean
}) {
  // Refs
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null)

  // State
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] })
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [width, setWidth] = useState(1000)
  const [height, setHeight] = useState(800)
  const [linksLimit, setLinksLimit] = useState(20)
  const [showLinksText, setShowLinksText] = useState(true)
  const [numberOfPinnedNodes, setNumberOfPinnedNodes] = useState(0)
  const [, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // Custom hooks
  const { getNodeColor } = useTypeColors()
  const graphFittedRef = useRef(false)

  // Center and zoom the graph to fit all nodes
  const fitGraphToView = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || data.nodes.length === 0) return

    const svg = d3.select(svgRef.current)

    // Calculate the bounds efficiently
    const bounds = data.nodes.reduce(
      (acc, node) => {
        const x = node.x || 0
        const y = node.y || 0
        const nodeSize = node.size || 24

        return {
          minX: Math.min(acc.minX, x - nodeSize),
          minY: Math.min(acc.minY, y - nodeSize),
          maxX: Math.max(acc.maxX, x + nodeSize),
          maxY: Math.max(acc.maxY, y + nodeSize)
        }
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    )

    // Add padding
    const padding = 50
    bounds.minX -= padding
    bounds.minY -= padding
    bounds.maxX += padding
    bounds.maxY += padding

    // Calculate dimensions and scale
    const graphWidth = bounds.maxX - bounds.minX
    const graphHeight = bounds.maxY - bounds.minY

    const scaleX = width / graphWidth
    const scaleY = height / graphHeight
    const scale = Math.min(scaleX, scaleY, 1.5) // Limit max zoom

    // Calculate center points
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2

    // Apply transform with transition
    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-centerX, -centerY)

    svg.transition().duration(200).call(zoomRef.current.transform, transform)
  }, [data.nodes, width, height])

  // Load initial data
  const loadInitialData = useCallback(
    async (uri: string) => {
      if (!uri) return

      try {
        setIsLoading(true)
        setError(null)
        graphFittedRef.current = false

        const rdfData = await fetchRdfData(uri, linksLimit)
        const graphData = convertRdfToGraphData(rdfData)

        setData(graphData)
        setExpandedNodes(new Set())

        // If we have a node and autoSelectNode is true, select it
        if (graphData.nodes.length > 0 && autoSelectNode) {
          const mainNode = graphData.nodes.find((node) => node.id === uri)
          if (mainNode) {
            setSelectedNode(mainNode)
            setShowInfoPanel(true)
          }
        }
      } catch (err) {
        setError('Failed to load RDF data. Please check the URI and try again.')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    },
    [linksLimit, autoSelectNode]
  )

  // Handle node click events with debounce
  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNode(node)
    setShowInfoPanel(true)
  }, [])

  // Handle node expansion on double-click
  const expandNode = useCallback(
    async (node: Node) => {
      setError(null)

      // Check if node is already expanded
      if (expandedNodes.has(node.id)) {
        // Node is already expanded, do nothing
        return
      }

      // Update the node to mark it as loading
      setData((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === node.id ? { ...n, isLoading: true } : n
        )
      }))

      try {
        const rdfData = await fetchRdfData(node.id, linksLimit)

        // Create efficient sets for lookups
        const existingNodeIds = new Set(data.nodes.map((n) => n.id))
        const existingLinkIds = new Set(data.links.map((l) => l.id))

        // Filter out nodes we already have
        const newNodes = rdfData.nodes
          .filter((n) => !existingNodeIds.has(n.id))
          .map((node) => ({
            id: node.id,
            label: node.data.label,
            type: node.type || 'default',
            size: 24,
            rdfType: node.data.rdfType,
            x: (node.position?.x || 0) + (Math.random() * 100 - 50),
            y: (node.position?.y || 0) + (Math.random() * 100 - 50)
          }))

        // Process new edges
        const newLinks = rdfData.edges
          .filter((edge) => !existingLinkIds.has(edge.id))
          .map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            predicates: [edge.data.predicate]
          }))

        // Mark node as expanded
        setExpandedNodes((prev) => new Set(prev).add(node.id))

        // Only update state if there are new nodes or links
        if (newNodes.length > 0 || newLinks.length > 0) {
          setData((prev) => ({
            nodes: prev.nodes
              .map((n) => (n.id === node.id ? { ...n, isLoading: false } : n))
              .concat(newNodes),
            links: [...prev.links, ...newLinks]
          }))
        } else {
          // No new data, just remove loading state without triggering re-render
          setData((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === node.id ? { ...n, isLoading: false } : n
            )
          }))
        }
      } catch (err) {
        console.error('Error expanding node:', err)
        setError('Failed to expand node connections')

        // Reset loading state if there's an error
        setData((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === node.id ? { ...n, isLoading: false } : n
          )
        }))
      }
    },
    [data.nodes, data.links, linksLimit, expandedNodes]
  )

  // Handle node double-click
  const handleNodeDblClick = useCallback(
    (node: Node) => {
      expandNode(node)
    },
    [expandNode]
  )

  // Remove node and its connections
  const removeNode = useCallback(
    (node: Node) => {
      const nodesToRemove = new Set<string>([node.id])

      // Create a recursive function to find connected nodes
      const findConnectedNodes = (nodeId: string) => {
        // Find outgoing links
        const outgoingLinks = data.links.filter((l) => {
          const sourceId = typeof l.source === 'string' ? l.source : l.source.id
          return sourceId === nodeId
        })

        outgoingLinks.forEach((link) => {
          const targetId =
            typeof link.target === 'string' ? link.target : link.target.id

          if (!nodesToRemove.has(targetId)) {
            // Check if this node only has connections from nodes we're removing
            const incomingLinks = data.links.filter((l) => {
              const targetLinkId =
                typeof l.target === 'string' ? l.target : l.target.id
              return targetLinkId === targetId
            })

            const shouldRemove = incomingLinks.every((l) => {
              const sourceId =
                typeof l.source === 'string' ? l.source : l.source.id
              return nodesToRemove.has(sourceId)
            })

            if (shouldRemove) {
              nodesToRemove.add(targetId)
              findConnectedNodes(targetId)
            }
          }
        })
      }

      // Start recursive node removal process
      findConnectedNodes(node.id)

      // Update state in one batch operation
      setData((prev) => {
        const updatedNodes = prev.nodes.filter((n) => !nodesToRemove.has(n.id))
        const updatedLinks = prev.links.filter((l) => {
          const sourceId = typeof l.source === 'string' ? l.source : l.source.id
          const targetId = typeof l.target === 'string' ? l.target : l.target.id
          return !nodesToRemove.has(sourceId) && !nodesToRemove.has(targetId)
        })

        return { nodes: updatedNodes, links: updatedLinks }
      })

      // Clear selection if removed
      if (selectedNode && nodesToRemove.has(selectedNode.id)) {
        setSelectedNode(null)
        setShowInfoPanel(false)
      }
    },
    [data.links, selectedNode]
  )

  // Toggle node fixed state
  const toggleNodeFixed = useCallback((node: Node) => {
    setData((prev) => {
      const updatedNodes = prev.nodes.map((n) => {
        if (n.id === node.id) {
          const newFixed = !n.fixed
          if (newFixed) {
            setNumberOfPinnedNodes((p) => p + 1)
            return { ...n, fixed: true, fx: n.x, fy: n.y }
          } else {
            setNumberOfPinnedNodes((p) => p - 1)
            return { ...n, fixed: false, fx: null, fy: null }
          }
        }
        return n
      })

      return { ...prev, nodes: updatedNodes }
    })
  }, [])

  // Toggle all nodes fixed state
  const toggleAllNodesFixed = useCallback(() => {
    const shouldFix = numberOfPinnedNodes === 0

    setData((prev) => {
      const updatedNodes = prev.nodes.map((n) => {
        if (shouldFix) {
          return { ...n, fixed: true, fx: n.x, fy: n.y }
        } else {
          return { ...n, fixed: false, fx: null, fy: null }
        }
      })

      return { ...prev, nodes: updatedNodes }
    })

    setNumberOfPinnedNodes(shouldFix ? data.nodes.length : 0)
  }, [numberOfPinnedNodes, data.nodes.length])

  // Update graph simulation
  const updateVisualization = useCallback(() => {
    if (!simulationRef.current) return

    // Map nodes by ID for efficient lookup
    const nodeById = new Map(data.nodes.map((node) => [node.id, node]))

    // Update links with references to actual node objects
    const links = data.links.map((link) => ({
      ...link,
      source:
        typeof link.source === 'string'
          ? nodeById.get(link.source) || link.source
          : link.source,
      target:
        typeof link.target === 'string'
          ? nodeById.get(link.target) || link.target
          : link.target
    }))

    // Update simulation with minimal changes
    simulationRef.current.nodes(data.nodes)
    simulationRef.current.force(
      'link',
      d3
        .forceLink<Node, Link>(links)
        .id((d) => d.id)
        .distance(100)
    )

    simulationRef.current.alpha(0.3).restart()
  }, [data.nodes, data.links])

  // Rotate the graph with animation
  const rotateGraph = useCallback(
    (clockwise: boolean) => {
      const totalAngle = (clockwise ? 1 : -1) * ((45 * Math.PI) / 180)
      const duration = 500
      const startTime = Date.now()
      const centerX = width / 2
      const centerY = height / 2

      // Capture initial positions
      const initialPositions = data.nodes.map((node) => ({
        id: node.id,
        x: node.x || 0,
        y: node.y || 0
      }))

      // Easing function
      const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

      // Animation function
      const animateRotation = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easedProgress = easeOutCubic(progress)
        const currentAngle = totalAngle * easedProgress

        const cos = Math.cos(currentAngle)
        const sin = Math.sin(currentAngle)

        setData((prev) => ({
          ...prev,
          nodes: prev.nodes.map((node) => {
            const initialPosition = initialPositions.find(
              (p) => p.id === node.id
            )
            if (!initialPosition) return node

            const dx = initialPosition.x - centerX
            const dy = initialPosition.y - centerY

            const newX = centerX + dx * cos - dy * sin
            const newY = centerY + dx * sin + dy * cos

            return {
              ...node,
              x: newX,
              y: newY,
              fx: node.fixed ? newX : null,
              fy: node.fixed ? newY : null
            }
          })
        }))

        if (simulationRef.current) {
          simulationRef.current.alpha(0.005).restart()
        }

        if (progress < 1) {
          requestAnimationFrame(animateRotation)
        } else if (simulationRef.current) {
          simulationRef.current.alpha(0.1).restart()
        }
      }

      requestAnimationFrame(animateRotation)
    },
    [width, height, data.nodes]
  )

  // Handle links limit changes
  const handleLinksLimitChange = useCallback((delta: number) => {
    setLinksLimit((prev) => Math.max(1, Math.min(1000, prev + delta)))
  }, [])

  // Initialize effects
  useEffect(() => {
    if (initialUri) {
      loadInitialData(initialUri)
    }
  }, [initialUri, loadInitialData])

  // Setup resize observer
  useEffect(() => {
    if (!containerRef.current) return

    // Set initial dimensions
    setWidth(containerRef.current.clientWidth)
    setHeight(containerRef.current.clientHeight)

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0] || !containerRef.current) return

      const newWidth = containerRef.current.clientWidth
      const newHeight = containerRef.current.clientHeight

      requestAnimationFrame(() => {
        setWidth(newWidth)
        setHeight(newHeight)

        if (simulationRef.current) {
          simulationRef.current
            .force('center', d3.forceCenter(newWidth / 2, newHeight / 2))
            .alpha(0.3)
            .restart()
        }
      })
    })

    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [])

  // Keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowInfoPanel(false)
        setSelectedNode(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // D3 graph initialization
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)

    // Preserve current zoom transform
    const currentTransform = zoomRef.current
      ? d3.zoomTransform(svg.node() as Element)
      : d3.zoomIdentity

    svg.selectAll('*').remove()

    // Create container group
    const g = svg
      .append('g')
      .attr('class', 'nodes-container')
      .style('user-select', 'none')

    // Define arrow markers
    svg
      .append('defs')
      .selectAll('marker')
      .data(['end'])
      .enter()
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999')

    // Setup zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })

    zoomRef.current = zoom
    svg.call(zoom).on('dblclick.zoom', null)

    // Reapply the preserved transform
    svg.call(zoom.transform, currentTransform)

    // Exit if no data - simulation will be created when data arrives
    if (data.nodes.length === 0) {
      return () => {
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
      }
    }

    // Map nodes by ID
    const nodeById = new Map(data.nodes.map((node) => [node.id, node]))

    // Process links to ensure proper references
    const links = data.links.map((link) => ({
      ...link,
      source:
        typeof link.source === 'string'
          ? nodeById.get(link.source) || link.source
          : link.source,
      target:
        typeof link.target === 'string'
          ? nodeById.get(link.target) || link.target
          : link.target
    }))

    // Setup force simulation
    simulationRef.current = d3
      .forceSimulation<Node, Link>(data.nodes)
      .force(
        'link',
        d3
          .forceLink<Node, Link>(links)
          .id((d) => d.id)
          .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collide',
        d3
          .forceCollide<Node>()
          .radius((d) => d.size + 10)
          .strength(0.7)
      )
      .on('tick', tick)

    // Create links
    const linkGroup = g
      .append('g')
      .attr('class', 'links')
      .selectAll('g')
      .data(links)
      .enter()
      .append('g')
      .attr('class', 'link-wrapper')

    const link = linkGroup
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-width', 1)
      .attr('marker-end', 'url(#arrow)')

    const linkText = linkGroup
      .append('text')
      .attr('class', (d) =>
        d.predicates.length > 1 ? 'predicates' : 'predicate'
      )
      .attr('dy', '-0.5em')
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#666')
      .style('display', showLinksText ? 'block' : 'none')
      .text((d) =>
        d.predicates.length > 1
          ? `${d.predicates.length} predicates`
          : formatPredicate(d.predicates[0])
      )

    // Create nodes
    const nodeGroup = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(data.nodes)
      .enter()
      .append('g')
      .attr('class', 'node-wrapper')
      .attr('id', (d) => d.id)

    const node = nodeGroup
      .append('circle')
      .attr('class', 'node')
      .attr('r', (d) => d.size)
      .attr('fill', (d) => getNodeColor(d.rdfType))
      .call(
        d3
          .drag<SVGCircleElement, Node>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
      )

    // Loading indicator
    nodeGroup
      .filter((d) => Boolean(d.isLoading))
      .append('circle')
      .attr('class', 'loading-indicator')
      .attr('r', (d) => d.size * 1.1)
      .attr('fill', 'none')
      .attr('stroke', '#3498db')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,3')
      .style('animation', 'dash 1.5s linear infinite')

    // Node labels
    nodeGroup
      .append('text')
      .attr('class', 'node-label')
      .attr('dy', 4)
      .attr('text-anchor', 'middle')
      .style('font-size', (d) => `${Math.min((2 * d.size) / 3, 12)}px`)
      .style('pointer-events', 'none')
      .text((d) =>
        d.label.length > 20 ? `${d.label.substring(0, 17)}…` : d.label
      )

    // Node click handlers
    node.on('click', (event, d) => {
      event.stopPropagation()

      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
        clickTimerRef.current = null
      }

      clickTimerRef.current = setTimeout(() => {
        handleNodeClick(d)
        clickTimerRef.current = null
      }, 250)
    })

    node.on('dblclick', (event, d) => {
      event.stopPropagation()

      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
        clickTimerRef.current = null
      }

      handleNodeDblClick(d)
    })

    node.on('contextmenu', (event, d) => {
      event.preventDefault()
      toggleNodeFixed(d)
      updateVisualization()
    })

    // Background click to deselect
    svg.on('click', () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
        clickTimerRef.current = null
      }

      setSelectedNode(null)
      setShowInfoPanel(false)
    })

    // Tick function
    let tickCount = 0
    function tick() {
      // Update link positions
      link
        .attr('x1', (d) => (typeof d.source === 'object' ? d.source.x || 0 : 0))
        .attr('y1', (d) => (typeof d.source === 'object' ? d.source.y || 0 : 0))
        .attr('x2', (d) => (typeof d.target === 'object' ? d.target.x || 0 : 0))
        .attr('y2', (d) => (typeof d.target === 'object' ? d.target.y || 0 : 0))

      // Update link text positions
      linkText
        .attr('x', (d) => {
          const sourceX = typeof d.source === 'object' ? d.source.x || 0 : 0
          const targetX = typeof d.target === 'object' ? d.target.x || 0 : 0
          return (sourceX + targetX) / 2
        })
        .attr('y', (d) => {
          const sourceY = typeof d.source === 'object' ? d.source.y || 0 : 0
          const targetY = typeof d.target === 'object' ? d.target.y || 0 : 0
          return (sourceY + targetY) / 2
        })
        .attr('transform', (d) => {
          if (typeof d.source !== 'object' || typeof d.target !== 'object')
            return ''

          const sourceX = d.source.x || 0
          const sourceY = d.source.y || 0
          const targetX = d.target.x || 0
          const targetY = d.target.y || 0

          const angle =
            (Math.atan2(targetY - sourceY, targetX - sourceX) * 180) / Math.PI
          const textX = (sourceX + targetX) / 2
          const textY = (sourceY + targetY) / 2

          return `rotate(${
            angle <= 90 && angle >= -90 ? angle : angle + 180
          }, ${textX}, ${textY})`
        })

      // Update node positions
      nodeGroup
        .selectAll<SVGCircleElement, Node>('circle')
        .attr('cx', (d) => d.x || 0)
        .attr('cy', (d) => d.y || 0)

      nodeGroup
        .selectAll<SVGTextElement, Node>('text')
        .attr('x', (d) => d.x || 0)
        .attr('y', (d) => d.y || 0)

      if (!graphFittedRef.current && tickCount++ === 3) {
        requestAnimationFrame(() => fitGraphToView())
        graphFittedRef.current = true
      }
    }

    // Drag functions
    function dragstarted(
      event: d3.D3DragEvent<SVGCircleElement, Node, Node>,
      d: Node
    ) {
      if (!event.active && simulationRef.current)
        simulationRef.current.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(
      event: d3.D3DragEvent<SVGCircleElement, Node, Node>,
      d: Node
    ) {
      d.fx = event.x
      d.fy = event.y
      if (!d.fixed) {
        d.fixed = true
        setNumberOfPinnedNodes((prev) => prev + 1)
      }
    }

    function dragended(
      event: d3.D3DragEvent<SVGCircleElement, Node, Node>,
      d: Node
    ) {
      if (!event.active && simulationRef.current)
        simulationRef.current.alphaTarget(0)
      if (!d.fixed) {
        d.fx = null
        d.fy = null
      }
    }

    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
      if (simulationRef.current) simulationRef.current.stop()
    }
  }, [
    data,
    showLinksText,
    width,
    height,
    getNodeColor,
    handleNodeClick,
    handleNodeDblClick,
    toggleNodeFixed,
    updateVisualization,
    fitGraphToView
  ])

  // JSX rendering
  return (
    <div className="relative h-full w-full">
      {error && (
        <div className="absolute top-4 right-4 z-20 max-w-md">
          <Card className="overflow-hidden border-red-300 bg-red-50 shadow-md">
            <div className="flex items-start gap-3 p-4">
              <div className="mt-0.5 text-red-600">
                <XCircleIcon className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-600 hover:bg-red-100 hover:text-red-800"
                onClick={() => setError(null)}
              >
                <XIcon />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* URI Input and Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <Card className="flex w-72 flex-col gap-2 p-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Links Limit: {linksLimit}
            </span>
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleLinksLimitChange(-1)}
                  >
                    <MinusIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Decrease limit</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleLinksLimitChange(1)}
                  >
                    <PlusIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Increase limit</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              id="showLinksText"
              className="h-4 w-4"
              checked={showLinksText}
              onChange={() => setShowLinksText(!showLinksText)}
            />
            <label htmlFor="showLinksText" className="text-sm">
              Show predicate labels
            </label>
          </div>

          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => rotateGraph(false)}
                >
                  <RotateCcwIcon />
                  <span>Rotate</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Rotate the graph counter-clockwise
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => rotateGraph(true)}
                >
                  <RotateCwIcon />
                  <span>Rotate</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rotate the graph clockwise</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllNodesFixed}
                  className="flex-1"
                >
                  {numberOfPinnedNodes > 0 ? <UnlinkIcon /> : <LinkIcon />}
                  <span>
                    {numberOfPinnedNodes > 0 ? 'Unpin All' : 'Pin All'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {numberOfPinnedNodes > 0
                  ? 'Unpin all nodes'
                  : 'Pin down all nodes'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fitGraphToView}
                  className="flex-1"
                >
                  <MaximizeIcon />
                  <span>Fit Graph</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Center and zoom graph to fit all nodes
              </TooltipContent>
            </Tooltip>
          </div>
        </Card>
      </div>

      {/* Loading Indicator */}
      {/* {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="p-4">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
            <p className="mt-2 text-center text-sm">Loading data...</p>
          </div>
        </div>
      )} */}

      {/* Node Info Panel */}
      {showInfoPanel && selectedNode && (
        <NodeInfoPanel
          node={selectedNode}
          onClose={() => setShowInfoPanel(false)}
          onExpand={() => expandNode(selectedNode)}
          onRemove={() => removeNode(selectedNode)}
        />
      )}

      {/* SVG Container */}
      <div className="h-full w-full" ref={containerRef}>
        {data.nodes.length > 0 && (
          <svg
            ref={svgRef}
            className="h-full max-h-full w-full max-w-full bg-white"
            style={{ display: 'block' }}
          >
            <title>RDF Graph Visualization</title>
            <rect width="100%" height="100%" fill="none" pointerEvents="all" />
          </svg>
        )}
      </div>
    </div>
  )
}

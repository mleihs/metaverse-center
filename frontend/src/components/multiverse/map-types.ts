/** Types for the Cartographer's Map force-directed graph. */

export interface MapNodeData {
  id: string;
  name: string;
  slug: string;
  theme: string;
  description?: string;
  bannerUrl?: string;
  agentCount: number;
  buildingCount: number;
  eventCount: number;
  echoCount: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

export interface MapEdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  connectionType: string;
  bleedVectors: string[];
  strength: number;
  description?: string;
}

export interface ForceConfig {
  repulsion: number;
  attraction: number;
  centerForce: number;
  damping: number;
  minDistance: number;
  nodeRadius: number;
}

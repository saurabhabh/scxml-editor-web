import type { Node, Edge } from 'reactflow';
import type { SCXMLStateNodeData } from '@/components/diagram/nodes/scxml-state-node';

export interface ContainerMetadata {
  childLayout: 'auto' | 'grid' | 'manual';
  padding: number;
  minSize: { width: number; height: number };
  isCollapsible: boolean;
  isExpanded: boolean;
}

export interface CompoundStateNodeData extends SCXMLStateNodeData {
  children: string[]; // Child state IDs
  containerMetadata: ContainerMetadata;
  childPositions?: Map<string, { x: number; y: number }>;
  descendants?: HierarchicalNode[]; // All descendant nodes for visual rendering (deprecated)
  childCount?: number; // Number of child nodes (for new format)
}

export interface ParallelStateNodeData extends CompoundStateNodeData {
  parallelRegions: string[][]; // Groups of parallel child state IDs
}

export interface HierarchicalNode extends Node {
  data: SCXMLStateNodeData | CompoundStateNodeData | ParallelStateNodeData;
  parentId?: string;
  childIds?: string[];
  depth: number;
  containerBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface LayoutStrategy {
  type: 'auto' | 'grid' | 'force' | 'manual';
  options?: {
    columns?: number;
    spacing?: { x: number; y: number };
    alignment?: 'center' | 'left' | 'right' | 'top' | 'bottom';
  };
}

export interface ChildPosition {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type NodeType = 'simple' | 'compound' | 'parallel' | 'final' | 'history';

export interface HierarchicalLayout {
  nodes: HierarchicalNode[];
  edges: Edge[];
  hierarchy: Map<string, string[]>; // parent -> children mapping
  parentMap: Map<string, string>; // child -> parent mapping
  datamodelContext?: Record<string, any>; // SCXML datamodel context
}
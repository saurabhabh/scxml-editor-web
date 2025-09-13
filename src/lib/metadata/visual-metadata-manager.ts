/**
 * Visual Metadata Manager
 * 
 * Handles extraction, manipulation, and serialization of visual metadata
 * stored in the custom XML namespace xmlns:visual="http://visual-scxml-editor/metadata"
 */

import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import type {
  VisualMetadata,
  ElementVisualMetadata,
  LayoutMetadata,
  StyleMetadata,
  DiagramMetadata,
  VisualXMLAttributes,
  VisualMetadataSerializationConfig,
  VisualMetadataValidationResult,
  VisualMetadataValidationError,
  VisualMetadataValidationWarning,
  VisualMetadataChangeEvent,
  Waypoint,
  ActionNamespaceMetadata,
  ViewStateMetadata,
} from '@/types/visual-metadata';
import { VISUAL_METADATA_CONSTANTS } from '@/types/visual-metadata';
import type { SCXMLDocument, SCXMLElement } from '@/types/scxml';

/**
 * Manages visual metadata for SCXML elements with full namespace support
 */
export class VisualMetadataManager {
  private readonly namespaceURI: string;
  private readonly namespacePrefix: string;
  private metadataStore = new Map<string, ElementVisualMetadata>();
  private changeListeners: ((event: VisualMetadataChangeEvent) => void)[] = [];

  constructor(
    namespaceURI = VISUAL_METADATA_CONSTANTS.NAMESPACE_URI,
    namespacePrefix = VISUAL_METADATA_CONSTANTS.NAMESPACE_PREFIX
  ) {
    this.namespaceURI = namespaceURI;
    this.namespacePrefix = namespacePrefix;
  }

  /**
   * Extract visual metadata from parsed SCXML element
   */
  extractVisualMetadata(element: any, elementId: string): ElementVisualMetadata | null {
    if (!element || !elementId) return null;

    const metadata: ElementVisualMetadata = {
      elementId,
      elementType: this.determineElementType(element),
      lastModified: Date.now(),
    };

    // Extract layout metadata
    const layout = this.extractLayoutMetadata(element);
    if (layout && Object.keys(layout).length > 0) {
      metadata.layout = layout;
    }

    // Extract style metadata
    const style = this.extractStyleMetadata(element);
    if (style && Object.keys(style).length > 0) {
      metadata.style = style;
    }

    // Extract diagram metadata
    const diagram = this.extractDiagramMetadata(element);
    if (diagram && Object.keys(diagram).length > 0) {
      metadata.diagram = diagram;
    }

    // Extract action namespace metadata
    const actions = this.extractActionNamespaceMetadata(element);
    if (actions && Object.keys(actions).length > 0) {
      metadata.actions = actions;
    }

    // Extract view state metadata
    const view = this.extractViewStateMetadata(element);
    if (view && Object.keys(view).length > 0) {
      metadata.view = view;
    }

    // Only return metadata if we found something
    const hasMetadata = metadata.layout || metadata.style || metadata.diagram || 
                       metadata.actions || metadata.view;
    
    if (hasMetadata) {
      this.metadataStore.set(elementId, metadata);
      return metadata;
    }

    return null;
  }

  /**
   * Extract all visual metadata from SCXML document
   */
  extractAllVisualMetadata(scxmlDoc: SCXMLDocument): Map<string, ElementVisualMetadata> {
    this.metadataStore.clear();
    
    // Extract from root scxml element
    const rootMetadata = this.extractVisualMetadata(scxmlDoc.scxml, 'scxml');
    if (rootMetadata) {
      this.metadataStore.set('scxml', rootMetadata);
    }

    // Recursively extract from all child elements
    this.extractMetadataRecursively(scxmlDoc.scxml, '');

    return new Map(this.metadataStore);
  }

  /**
   * Update visual metadata for an element
   */
  updateVisualMetadata(elementId: string, metadata: Partial<VisualMetadata>): void {
    const existing = this.metadataStore.get(elementId);
    const previousMetadata = existing ? { ...existing } : undefined;
    
    const updated: ElementVisualMetadata = {
      ...(existing || {
        elementId,
        elementType: 'state',
      }),
      ...metadata,
      elementId, // Ensure elementId is preserved
      lastModified: Date.now(),
    };

    this.metadataStore.set(elementId, updated);

    // Emit change event
    this.emitChangeEvent({
      type: existing ? 'update' : 'create',
      elementId,
      previousMetadata,
      newMetadata: updated,
      timestamp: Date.now(),
      source: 'api',
    });
  }

  /**
   * Get visual metadata for an element
   */
  getVisualMetadata(elementId: string): ElementVisualMetadata | undefined {
    return this.metadataStore.get(elementId);
  }

  /**
   * Remove visual metadata for an element
   */
  removeVisualMetadata(elementId: string): boolean {
    const existing = this.metadataStore.get(elementId);
    if (existing) {
      this.metadataStore.delete(elementId);
      this.emitChangeEvent({
        type: 'delete',
        elementId,
        previousMetadata: existing,
        newMetadata: existing, // For compatibility
        timestamp: Date.now(),
        source: 'api',
      });
      return true;
    }
    return false;
  }

  /**
   * Apply visual metadata to an SCXML element for serialization
   */
  applyVisualMetadataToElement(element: any, elementId: string): any {
    const metadata = this.metadataStore.get(elementId);
    if (!metadata) return element;

    const updatedElement = { ...element };

    // Apply layout metadata
    if (metadata.layout) {
      if (metadata.layout.x !== undefined) {
        updatedElement[`@_${this.namespacePrefix}:x`] = metadata.layout.x.toString();
      }
      if (metadata.layout.y !== undefined) {
        updatedElement[`@_${this.namespacePrefix}:y`] = metadata.layout.y.toString();
      }
      if (metadata.layout.width !== undefined) {
        updatedElement[`@_${this.namespacePrefix}:width`] = metadata.layout.width.toString();
      }
      if (metadata.layout.height !== undefined) {
        updatedElement[`@_${this.namespacePrefix}:height`] = metadata.layout.height.toString();
      }
      if (metadata.layout.zIndex !== undefined) {
        updatedElement[`@_${this.namespacePrefix}:z-index`] = metadata.layout.zIndex.toString();
      }
    }

    // Apply style metadata
    if (metadata.style) {
      if (metadata.style.fill) {
        updatedElement[`@_${this.namespacePrefix}:fill`] = metadata.style.fill;
      }
      if (metadata.style.stroke) {
        updatedElement[`@_${this.namespacePrefix}:stroke`] = metadata.style.stroke;
      }
      if (metadata.style.strokeWidth !== undefined) {
        updatedElement[`@_${this.namespacePrefix}:stroke-width`] = metadata.style.strokeWidth.toString();
      }
      if (metadata.style.borderRadius !== undefined) {
        updatedElement[`@_${this.namespacePrefix}:border-radius`] = metadata.style.borderRadius.toString();
      }
      if (metadata.style.className) {
        updatedElement[`@_${this.namespacePrefix}:class`] = metadata.style.className;
      }
      if (metadata.style.style) {
        // Convert style object to CSS string
        const styleString = Object.entries(metadata.style.style)
          .map(([key, value]) => `${key}:${value}`)
          .join(';');
        updatedElement[`@_${this.namespacePrefix}:style`] = styleString;
      }
      if (metadata.style.opacity !== undefined) {
        updatedElement[`@_${this.namespacePrefix}:opacity`] = metadata.style.opacity.toString();
      }
    }

    // Apply diagram metadata
    if (metadata.diagram) {
      if (metadata.diagram.waypoints && metadata.diagram.waypoints.length > 0) {
        const waypointsString = metadata.diagram.waypoints
          .map(wp => `${wp.x},${wp.y}`)
          .join(' ');
        updatedElement[`@_${this.namespacePrefix}:waypoints`] = waypointsString;
      }
      if (metadata.diagram.labelOffset) {
        updatedElement[`@_${this.namespacePrefix}:label-offset`] = 
          `${metadata.diagram.labelOffset.x},${metadata.diagram.labelOffset.y}`;
      }
      if (metadata.diagram.curveType) {
        updatedElement[`@_${this.namespacePrefix}:curve-type`] = metadata.diagram.curveType;
      }
      if (metadata.diagram.markerType) {
        updatedElement[`@_${this.namespacePrefix}:marker-type`] = metadata.diagram.markerType;
      }
    }

    // Apply action namespace metadata
    if (metadata.actions) {
      if (metadata.actions.namespaces && metadata.actions.namespaces.length > 0) {
        updatedElement[`@_${this.namespacePrefix}:action-namespaces`] = 
          metadata.actions.namespaces.join(',');
      }
      if (metadata.actions.definitions && metadata.actions.definitions.length > 0) {
        // Serialize custom action definitions as JSON
        const actionsJson = JSON.stringify(metadata.actions.definitions);
        updatedElement[`@_${this.namespacePrefix}:custom-actions`] = actionsJson;
      }
    }

    // Apply view state metadata
    if (metadata.view) {
      if (metadata.view.collapsed && metadata.view.collapsed.length > 0) {
        updatedElement[`@_${this.namespacePrefix}:collapsed`] = 
          metadata.view.collapsed.join(',');
      }
      if (metadata.view.selected && metadata.view.selected.length > 0) {
        updatedElement[`@_${this.namespacePrefix}:selected`] = 
          metadata.view.selected.join(',');
      }
    }

    return updatedElement;
  }

  /**
   * Serialize SCXML document with visual metadata
   */
  serializeWithVisualMetadata(
    scxmlDoc: SCXMLDocument,
    config: Partial<VisualMetadataSerializationConfig> = {}
  ): string {
    const fullConfig: VisualMetadataSerializationConfig = {
      includeVisualMetadata: true,
      formatOutput: true,
      namespacePrefix: this.namespacePrefix,
      namespaceURI: this.namespaceURI,
      validate: true,
      ...config,
    };

    if (!fullConfig.includeVisualMetadata) {
      // Return clean SCXML without visual metadata
      return this.serializeCleanSCXML(scxmlDoc);
    }

    // Validate metadata if requested
    if (fullConfig.validate) {
      const validation = this.validateAllMetadata();
      if (!validation.isValid) {
        console.warn('Visual metadata validation failed:', validation.errors);
      }
    }

    // Apply visual metadata to SCXML structure
    const enrichedDoc = this.applyAllVisualMetadata(scxmlDoc);

    // Add namespace declaration to root element
    (enrichedDoc.scxml as any)[`@_xmlns:${fullConfig.namespacePrefix}`] = fullConfig.namespaceURI;

    // Serialize with XML builder
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: fullConfig.formatOutput,
      indentBy: '  ',
      suppressEmptyNode: false,
    });

    return builder.build(enrichedDoc);
  }

  /**
   * Validate visual metadata
   */
  validateMetadata(elementId: string): VisualMetadataValidationResult {
    const metadata = this.metadataStore.get(elementId);
    if (!metadata) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
      };
    }

    const errors: VisualMetadataValidationError[] = [];
    const warnings: VisualMetadataValidationWarning[] = [];

    // Validate layout metadata
    if (metadata.layout) {
      if (metadata.layout.x !== undefined && (isNaN(metadata.layout.x) || !isFinite(metadata.layout.x))) {
        errors.push({
          message: 'Invalid x coordinate value',
          elementId,
          attribute: 'visual:x',
          code: 'INVALID_NUMERIC_VALUE',
        });
      }
      if (metadata.layout.y !== undefined && (isNaN(metadata.layout.y) || !isFinite(metadata.layout.y))) {
        errors.push({
          message: 'Invalid y coordinate value',
          elementId,
          attribute: 'visual:y',
          code: 'INVALID_NUMERIC_VALUE',
        });
      }
      if (metadata.layout.width !== undefined && (isNaN(metadata.layout.width) || metadata.layout.width <= 0)) {
        errors.push({
          message: 'Width must be a positive number',
          elementId,
          attribute: 'visual:width',
          code: 'INVALID_POSITIVE_VALUE',
        });
      }
      if (metadata.layout.height !== undefined && (isNaN(metadata.layout.height) || metadata.layout.height <= 0)) {
        errors.push({
          message: 'Height must be a positive number',
          elementId,
          attribute: 'visual:height',
          code: 'INVALID_POSITIVE_VALUE',
        });
      }
    }

    // Validate style metadata
    if (metadata.style) {
      if (metadata.style.opacity !== undefined && 
          (isNaN(metadata.style.opacity) || metadata.style.opacity < 0 || metadata.style.opacity > 1)) {
        errors.push({
          message: 'Opacity must be between 0 and 1',
          elementId,
          attribute: 'visual:opacity',
          code: 'INVALID_OPACITY_RANGE',
        });
      }
      if (metadata.style.strokeWidth !== undefined && 
          (isNaN(metadata.style.strokeWidth) || metadata.style.strokeWidth < 0)) {
        errors.push({
          message: 'Stroke width must be non-negative',
          elementId,
          attribute: 'visual:stroke-width',
          code: 'INVALID_STROKE_WIDTH',
        });
      }
    }

    // Validate waypoints
    if (metadata.diagram?.waypoints) {
      for (let i = 0; i < metadata.diagram.waypoints.length; i++) {
        const waypoint = metadata.diagram.waypoints[i];
        if (isNaN(waypoint.x) || !isFinite(waypoint.x) || isNaN(waypoint.y) || !isFinite(waypoint.y)) {
          errors.push({
            message: `Invalid waypoint coordinates at index ${i}`,
            elementId,
            attribute: 'visual:waypoints',
            code: 'INVALID_WAYPOINT_COORDINATES',
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate all stored metadata
   */
  validateAllMetadata(): VisualMetadataValidationResult {
    const allErrors: VisualMetadataValidationError[] = [];
    const allWarnings: VisualMetadataValidationWarning[] = [];

    for (const elementId of this.metadataStore.keys()) {
      const result = this.validateMetadata(elementId);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Add change listener
   */
  addChangeListener(listener: (event: VisualMetadataChangeEvent) => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * Remove change listener
   */
  removeChangeListener(listener: (event: VisualMetadataChangeEvent) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index !== -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * Get all metadata as a map
   */
  getAllMetadata(): Map<string, ElementVisualMetadata> {
    return new Map(this.metadataStore);
  }

  /**
   * Clear all metadata
   */
  clearAllMetadata(): void {
    this.metadataStore.clear();
  }

  // Private helper methods

  private determineElementType(element: any): ElementVisualMetadata['elementType'] {
    // Check element structure to determine type
    if (element.state !== undefined || element['@_id'] !== undefined) return 'state';
    if (element.parallel !== undefined) return 'parallel';
    if (element.final !== undefined) return 'final';
    if (element.history !== undefined) return 'history';
    if (element.transition !== undefined) return 'transition';
    return 'state';
  }

  private extractLayoutMetadata(element: any): LayoutMetadata | undefined {
    const layout: LayoutMetadata = {};
    
    const x = this.getVisualAttribute(element, 'x');
    const y = this.getVisualAttribute(element, 'y');
    const width = this.getVisualAttribute(element, 'width');
    const height = this.getVisualAttribute(element, 'height');
    const zIndex = this.getVisualAttribute(element, 'z-index');

    if (x !== undefined) layout.x = parseFloat(x);
    if (y !== undefined) layout.y = parseFloat(y);
    if (width !== undefined) layout.width = parseFloat(width);
    if (height !== undefined) layout.height = parseFloat(height);
    if (zIndex !== undefined) layout.zIndex = parseInt(zIndex, 10);

    return Object.keys(layout).length > 0 ? layout : undefined;
  }

  private extractStyleMetadata(element: any): StyleMetadata | undefined {
    const style: StyleMetadata = {};
    
    const fill = this.getVisualAttribute(element, 'fill');
    const stroke = this.getVisualAttribute(element, 'stroke');
    const strokeWidth = this.getVisualAttribute(element, 'stroke-width');
    const borderRadius = this.getVisualAttribute(element, 'border-radius');
    const className = this.getVisualAttribute(element, 'class');
    const inlineStyle = this.getVisualAttribute(element, 'style');
    const opacity = this.getVisualAttribute(element, 'opacity');

    if (fill) style.fill = fill;
    if (stroke) style.stroke = stroke;
    if (strokeWidth !== undefined) style.strokeWidth = parseFloat(strokeWidth);
    if (borderRadius !== undefined) style.borderRadius = parseFloat(borderRadius);
    if (className) style.className = className;
    if (inlineStyle) {
      // Parse CSS string to object
      style.style = this.parseCSSString(inlineStyle);
    }
    if (opacity !== undefined) style.opacity = parseFloat(opacity);

    return Object.keys(style).length > 0 ? style : undefined;
  }

  private extractDiagramMetadata(element: any): DiagramMetadata | undefined {
    const diagram: DiagramMetadata = {};
    
    const waypoints = this.getVisualAttribute(element, 'waypoints');
    const labelOffset = this.getVisualAttribute(element, 'label-offset');
    const curveType = this.getVisualAttribute(element, 'curve-type');
    const markerType = this.getVisualAttribute(element, 'marker-type');

    if (waypoints) {
      diagram.waypoints = this.parseWaypoints(waypoints);
    }
    if (labelOffset) {
      const [x, y] = labelOffset.split(',').map(s => parseFloat(s.trim()));
      if (!isNaN(x) && !isNaN(y)) {
        diagram.labelOffset = { x, y };
      }
    }
    if (curveType) diagram.curveType = curveType as DiagramMetadata['curveType'];
    if (markerType) diagram.markerType = markerType as DiagramMetadata['markerType'];

    return Object.keys(diagram).length > 0 ? diagram : undefined;
  }

  private extractActionNamespaceMetadata(element: any): ActionNamespaceMetadata | undefined {
    const actions: ActionNamespaceMetadata = {};
    
    const namespaces = this.getVisualAttribute(element, 'action-namespaces');
    const customActions = this.getVisualAttribute(element, 'custom-actions');

    if (namespaces) {
      actions.namespaces = namespaces.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (customActions) {
      try {
        actions.definitions = JSON.parse(customActions);
      } catch (error) {
        console.warn('Failed to parse custom actions JSON:', error);
      }
    }

    return Object.keys(actions).length > 0 ? actions : undefined;
  }

  private extractViewStateMetadata(element: any): ViewStateMetadata | undefined {
    const view: ViewStateMetadata = {};
    
    const collapsed = this.getVisualAttribute(element, 'collapsed');
    const selected = this.getVisualAttribute(element, 'selected');

    if (collapsed) {
      view.collapsed = collapsed.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (selected) {
      view.selected = selected.split(',').map(s => s.trim()).filter(Boolean);
    }

    return Object.keys(view).length > 0 ? view : undefined;
  }

  private getVisualAttribute(element: any, attrName: string): string | undefined {
    return element?.[`@_${this.namespacePrefix}:${attrName}`] || 
           element?.[`@_visual:${attrName}`]; // Fallback for 'visual' prefix
  }

  private parseWaypoints(waypointsString: string): Waypoint[] {
    return waypointsString
      .split(/\s+/)
      .map(point => {
        const [x, y] = point.split(',').map(s => parseFloat(s.trim()));
        return !isNaN(x) && !isNaN(y) ? { x, y } : null;
      })
      .filter((waypoint): waypoint is Waypoint => waypoint !== null);
  }

  private parseCSSString(cssString: string): Record<string, string> {
    const styles: Record<string, string> = {};
    cssString.split(';').forEach(rule => {
      const [property, value] = rule.split(':').map(s => s.trim());
      if (property && value) {
        styles[property] = value;
      }
    });
    return styles;
  }

  private extractMetadataRecursively(parent: any, parentPath: string): void {
    // Process states
    const states = parent.state;
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];
      for (const state of statesArray) {
        const stateId = state['@_id'];
        if (stateId) {
          this.extractVisualMetadata(state, stateId);
          this.extractMetadataRecursively(state, parentPath ? `${parentPath}.${stateId}` : stateId);
        }
      }
    }

    // Process parallel states
    const parallels = parent.parallel;
    if (parallels) {
      const parallelsArray = Array.isArray(parallels) ? parallels : [parallels];
      for (const parallel of parallelsArray) {
        const parallelId = parallel['@_id'];
        if (parallelId) {
          this.extractVisualMetadata(parallel, parallelId);
          this.extractMetadataRecursively(parallel, parentPath ? `${parentPath}.${parallelId}` : parallelId);
        }
      }
    }

    // Process transitions
    const transitions = parent.transition;
    if (transitions) {
      const transitionsArray = Array.isArray(transitions) ? transitions : [transitions];
      for (let i = 0; i < transitionsArray.length; i++) {
        const transition = transitionsArray[i];
        const transitionId = `${parentPath || 'root'}-transition-${i}`;
        this.extractVisualMetadata(transition, transitionId);
      }
    }
  }

  private applyAllVisualMetadata(scxmlDoc: SCXMLDocument): SCXMLDocument {
    const enriched: SCXMLDocument = { scxml: { ...scxmlDoc.scxml } };
    
    // Apply metadata to root element
    enriched.scxml = this.applyVisualMetadataToElement(enriched.scxml, 'scxml');
    
    // Recursively apply to all child elements
    enriched.scxml = this.applyMetadataRecursively(enriched.scxml, '');
    
    return enriched;
  }

  private applyMetadataRecursively(parent: any, parentPath: string): any {
    const updated = { ...parent };

    // Apply to states
    if (updated.state) {
      const statesArray = Array.isArray(updated.state) ? updated.state : [updated.state];
      updated.state = statesArray.map((state: any) => {
        const stateId = state['@_id'];
        if (stateId) {
          let updatedState = this.applyVisualMetadataToElement(state, stateId);
          updatedState = this.applyMetadataRecursively(updatedState, parentPath ? `${parentPath}.${stateId}` : stateId);
          return updatedState;
        }
        return state;
      });
      if (!Array.isArray(parent.state)) {
        updated.state = updated.state[0];
      }
    }

    // Apply to parallel states
    if (updated.parallel) {
      const parallelsArray = Array.isArray(updated.parallel) ? updated.parallel : [updated.parallel];
      updated.parallel = parallelsArray.map((parallel: any) => {
        const parallelId = parallel['@_id'];
        if (parallelId) {
          let updatedParallel = this.applyVisualMetadataToElement(parallel, parallelId);
          updatedParallel = this.applyMetadataRecursively(updatedParallel, parentPath ? `${parentPath}.${parallelId}` : parallelId);
          return updatedParallel;
        }
        return parallel;
      });
      if (!Array.isArray(parent.parallel)) {
        updated.parallel = updated.parallel[0];
      }
    }

    // Apply to transitions
    if (updated.transition) {
      const transitionsArray = Array.isArray(updated.transition) ? updated.transition : [updated.transition];
      updated.transition = transitionsArray.map((transition: any, i: number) => {
        const transitionId = `${parentPath || 'root'}-transition-${i}`;
        return this.applyVisualMetadataToElement(transition, transitionId);
      });
      if (!Array.isArray(parent.transition)) {
        updated.transition = updated.transition[0];
      }
    }

    return updated;
  }

  private serializeCleanSCXML(scxmlDoc: SCXMLDocument): string {
    // Remove all visual metadata attributes and namespace declarations
    const cleanDoc = this.removeVisualMetadataRecursively(scxmlDoc);
    
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: false,
    });

    return builder.build(cleanDoc);
  }

  private removeVisualMetadataRecursively(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeVisualMetadataRecursively(item));
    }
    
    if (obj && typeof obj === 'object') {
      const cleaned: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // Skip visual namespace attributes and declarations
        if (key.includes(`${this.namespacePrefix}:`)) {
          continue;
        }
        if (key === `@_xmlns:${this.namespacePrefix}`) {
          continue;
        }
        
        cleaned[key] = this.removeVisualMetadataRecursively(value);
      }
      
      return cleaned;
    }
    
    return obj;
  }

  private emitChangeEvent(event: VisualMetadataChangeEvent): void {
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in visual metadata change listener:', error);
      }
    }
  }
}
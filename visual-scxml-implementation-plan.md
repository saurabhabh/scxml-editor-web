# Visual SCXML Editor Implementation Plan

## Current State Analysis
The project is in **Milestone 1** completion state with:
- ✅ Next.js 14 TypeScript foundation with Monaco Editor
- ✅ Basic SCXML parsing and validation using fast-xml-parser
- ✅ File import/export functionality
- ✅ Zustand state management already in place

## Implementation Plan for Visual Diagram Feature

```
SCXML Code Editor → SCXML Parser → XState Machine → React Flow Nodes/Edges → Visual Diagram
       ↑                                                                            ↓
   Code Updates ←← Visual Metadata Manager ←← Node Drag/Edit ←← User Interaction ←←
```

### Phase 1: Architecture & Dependencies (1-2 days)
**Goal:** Set up React Flow-based visual diagram foundation

```
Dependencies Installation → Zustand Store Extension → Tab Interface → XState Pipeline
```

**Tasks:**
1. Install React Flow and XState dependencies
2. Extend Zustand store for visual metadata and runtime state
3. Create base Visual Diagram tab component structure
4. Set up SCXML → XState machine conversion pipeline

**Key Dependencies:**
- `@xyflow/react` (React Flow v12+)
- `xstate` for SCXML execution and state tracking
- `@dagrejs/dagre` or `@eclipse-elk/elkjs` for automatic layout algorithms
- `@types/d3` for any supplementary SVG operations

### Phase 2: SCXML → Visual Mapping (2-3 days)
**Goal:** Convert SCXML to React Flow nodes and edges

```
SCXML Elements → State Classification → Node Generation → Edge Generation → Layout Algorithm
    ↓                    ↓                   ↓               ↓                 ↓
(states, transitions) → (simple,compound) → (rectangles) → (styled arrows) → (positioned)
```

**Tasks:**
1. Create SCXML parser extension for visual node/edge extraction
2. Implement node generators for different state types:
   - Simple states → rectangular nodes
   - Compound states → expandable group nodes (using `parentNode` property)
   - Final states → double-circle nodes
   - Initial state indicators with arrow pointers
   - Parallel state regions with clear visual boundaries
3. Create transition edge generators with styling based on type:
   - Event-only: Solid gray with event labels
   - Condition-only: Dashed blue with condition badges
   - Event + Condition: Solid blue with dual indicators
   - Always transitions: Dotted black
   - Action-executing: Thicker lines with action icons/badges
   - Internal transitions: Self-loop curves with action indicators
4. Position layout algorithm:
   - **Automatic Layout**: Integrate Dagre or ELK algorithms for hierarchical arrangement
   - **Manual Override**: Support drag-and-drop positioning with metadata persistence
   - **Compound State Layout**: Proper nested positioning for hierarchical states

### Phase 3: Two-Way Synchronization (2-3 days)
**Goal:** Bidirectional sync between code and visual editors

```
Code Changes → Debounced Parser → Incremental Update → Visual Diagram Update
     ↑                                                         ↓
Visual Metadata ← Metadata Serializer ← Position/Style ← Node Drag/Edit
```

**Tasks:**
1. Code → Visual: Real-time SCXML parsing and diagram updates
   - **Performance**: Debounced updates for large SCXML files
   - **Incremental Updates**: Only update changed nodes/edges to prevent full re-renders
2. Visual → Code: Node drag/edit operations updating SCXML with visual metadata
3. Visual metadata namespace implementation (`xmlns:visual`)
4. Metadata serialization/deserialization system
5. **Error Handling**: Invalid SCXML handling with broken node highlighting without diagram crashes

### Phase 4: Runtime Execution & Highlighting (1-2 days)
**Goal:** Live state machine execution with visual feedback

```
XState Interpreter → State Changes → Zustand Store → Visual Highlighting → Transition Animations
       ↑                                                   ↓                      ↓
Event Triggers ← UI Controls ← User Interaction ← Active States ← Flashing Edges
```

**Tasks:**
1. XState machine interpreter integration
2. **Active State Highlighting**: Dynamic visual feedback system in React Flow
   - Current active states with colored borders/backgrounds
   - **Transition Animations**: Flashing edges during state transitions (n8n-style)
   - Multi-state highlighting for parallel regions
3. Event trigger UI (buttons/controls for sending events)
4. Runtime state synchronization with Zustand store
5. **Dynamic Execution Feedback**: Visual indicators for entry/exit actions during execution

### Phase 5: Advanced UX Features (2-3 days)
**Goal:** Professional user experience and interactivity

```
Tab Interface → Element Selection → XML Highlighting → Zoom/Pan Controls → Drag & Drop
     ↓              ↓                 ↓                 ↓                  ↓
Visual ↔ Code → Click Sync → Monaco Focus → Minimap → Position Metadata
```

**Tasks:**
1. Tab-based interface (Code Editor ↔ Visual Diagram)
2. Zoom/pan controls and minimap
3. Node selection → XML highlighting (bidirectional linking)
4. Drag & drop node positioning with metadata persistence
5. Visual legend and toolbar

## Technical Architecture

### Extended Zustand Store Structure
```typescript
interface EditorState {
  // Existing
  content: string;
  // New additions
  visualMetadata: VisualMetadata;
  currentMachine: StateMachine | null;
  activeState: string | null;
  nodes: Node[];
  edges: Edge[];
}
```

### Component Architecture
```
src/
├── components/
│   ├── visual/
│   │   ├── VisualDiagram.tsx        # Main React Flow component
│   │   ├── StateNode.tsx            # Custom state node component
│   │   ├── TransitionEdge.tsx       # Custom edge component
│   │   ├── ExecutionControls.tsx    # Event trigger buttons
│   │   └── VisualLegend.tsx         # Node/edge type legend
│   ├── layout/
│   │   └── TabInterface.tsx         # Code ↔ Visual tab switching
│   └── editor/ (existing)
├── lib/
│   ├── visual/
│   │   ├── scxml-to-reactflow.ts    # SCXML → nodes/edges converter
│   │   ├── metadata-manager.ts     # Visual namespace handler
│   │   └── xstate-integration.ts   # XState machine creation
│   └── parsers/ (existing)
```

## Success Criteria
- ✅ Visual diagram renders all SCXML states and transitions
- ✅ Real-time sync between code and visual editors
- ✅ Live state highlighting during execution
- ✅ Visual metadata preserved in SCXML without affecting runtime
- ✅ Professional UX with zoom, pan, and interactive elements

## Performance Considerations

### Large SCXML Files
- **Debounced Updates**: Code → diagram synchronization with 300-500ms debounce
- **Virtual Rendering**: Consider React Flow's virtualization for 1000+ nodes
- **Incremental Rendering**: Only update changed nodes/edges to prevent full re-renders
- **Lazy Loading**: Load compound state children on expand

### Memory Management
- **Node Cleanup**: Remove unmounted nodes from React Flow instance
- **XState Instance Management**: Proper machine disposal on content changes

## Enhanced Features & Error Handling

### Visual Error Indicators
- **Broken Nodes**: Red border/icon for invalid state definitions
- **Missing Targets**: Highlight transitions with invalid target states
- **Syntax Errors**: Visual indicators without crashing the diagram
- **Graceful Degradation**: Show partial diagrams for partially valid SCXML

### Runtime Enhancements
- **Transition Animations**: n8n-style flashing edges during state changes
- **Entry/Exit Feedback**: Visual pulses for action execution
- **Event Queue Visualization**: Show pending events in UI
- **Step-by-step Debugging**: Pause/resume execution controls

## Timeline: 10-12 days total
This builds directly on the existing Milestone 1 foundation, leveraging the current Monaco Editor, SCXML parsing, and Zustand state management while adding the complete visual diagram system with enhanced performance and user experience features.
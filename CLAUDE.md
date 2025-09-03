# Visual SCXML Editor - Web Application Conversion

## Project Overview

Converting the Visual SCXML Editor from a VS Code plugin to a standalone web application with two-tab interface (Code Editor + Visual Diagram). The application will maintain full SCXML W3C specification compliance while adding rich visual editing capabilities.

**Original Repository:** https://github.com/Phrogz/visual-scxml-editor  
**SCXML Specification:** https://www.w3.org/TR/scxml/  
**License:** MIT

## Core Requirements

### Primary Features

- **Two-way editing**: Switch between visual and code views seamlessly, with live sync
- **Rich visualization**: Highlights states, actions, conditions; supports custom styling and waypoints
- **UX & navigation**: Text-graph link, zoom/pan controls, intuitive command palette integration
- **Action authoring**: Define and manage custom action namespaces visually in the SCXML diagram
- **Non-intrusive visual metadata**: Visual edits use a custom XML namespace, preserving SCXML's runtime behavior

### Detailed Feature Requirements

#### State Visualization

- States with entry/exit actions are highlighted (colored borders, icons)
- Compound states shown as nested visual containers
- Final states use double-circle styling
- Initial state indicators clearly marked

#### Transition Visualization

- Transitions that execute actions are clearly distinguished (thicker lines + indicators)
- Transitions with conditions, events, or neither are visually differentiated:
  - Condition + Event: Solid blue line with condition badge
  - Event only: Solid gray line with event label
  - Condition only: Dashed blue line with condition text
  - Neither (always): Dotted black line
- "Internal" transitions (self-loops with actions) shown as curved loops

#### Custom Visual Styling

- Matches the user's current VS Code theme by default
- Offers customizable state colors to convey additional meaning
- Theme adaptation system for professional appearance

#### Inspector Palette

- Built-in UI panel to author custom actions or modify state/transition properties visually
- Property panel for selected elements
- Color picker and styling controls
- Layout tools (alignment, distribution, spacing)

#### Waypoint Support

- Enables manually routing transitions around other elements using XML-injected waypoints
- Drag-and-drop waypoint editing
- Visual waypoint indicators and handles

#### Editor Interactivity & Navigation

- Text–graph linking: Selecting any visual element highlights its corresponding XML in the text editor
- Command palette for quick actions and navigation
- Zoom, pan, and minimap controls for large diagrams
- Keyboard shortcuts and accessibility features

## Technical Architecture

### Framework & Core Technologies

- **Next.js 14+** with App Router
- **TypeScript 5+** for type safety
- **React 18+** with modern hooks and patterns

### Code Editor

- **Monaco Editor** with `@monaco-editor/react`
- Custom SCXML language support and syntax highlighting
- IntelliSense and auto-completion for SCXML elements
- Real-time validation with error highlighting

### Visualization Engine

- **D3.js** for advanced SVG-based state machine rendering
- Custom styling engine for states, transitions, and actions
- Interactive waypoint system for transition paths
- Zoom/pan controls with smooth animations

### XML & SCXML Processing

- **fast-xml-parser** or **xml-js** for XML parsing with namespace support
- **xml-formatter** for XML beautification
- Custom metadata manager for visual namespace handling
- SCXML validation engine with W3C compliance checking

### UI Framework & Styling

- **Tailwind CSS** for utility-first styling
- **Headless UI** for accessible, unstyled components
- **Lucide React** for consistent iconography
- **framer-motion** for smooth animations and transitions

### State Management & Navigation

- **Redux Toolkit** for predictable state management
- **RTK Query** for server state and caching

### Additional Libraries

- **monaco-themes** for VS Code theme integration
- **react-color** for color picker functionality
- **react-resizable-panels** for resizable layout panels
- **react-dnd** for drag-and-drop interactions
- **chroma-js** for color manipulation and theme generation

## Visual Metadata System

### Custom XML Namespace

Uses `xmlns:visual="http://visual-scxml-editor/metadata"` namespace for non-intrusive visual data storage.

### Example SCXML with Visual Metadata

```xml
<scxml xmlns="http://www.w3.org/2005/07/scxml"
       xmlns:visual="http://visual-scxml-editor/metadata"
       initial="idle">

  <state id="idle"
         visual:x="100"
         visual:y="50"
         visual:width="120"
         visual:height="60"
         visual:style="fill:#e1f5fe;stroke:#0277bd">
    <transition event="start" target="active"
                visual:waypoints="200,80 250,120"
                visual:label-offset="10,5"/>
  </state>

  <state id="active"
         visual:x="300"
         visual:y="150"
         visual:custom-actions="namespace1,namespace2">
    <!-- Standard SCXML content unchanged -->
  </state>
</scxml>
```

### Metadata Types

- **Layout Data**: Position (x,y), dimensions (width, height)
- **Visual Styling**: Colors, border styles, custom CSS classes
- **Diagram Layout**: Waypoints for transitions, label positions
- **Action Namespaces**: Custom action definitions and associations
- **View State**: Zoom level, pan position, collapsed states

### Key Features

- **Runtime Preservation**: Visual metadata doesn't affect SCXML execution
- **Clean Export**: Option to export pure W3C-compliant SCXML without visual data
- **Backward Compatibility**: Import existing SCXML files and add visual metadata
- **Validation**: Ensure visual metadata doesn't interfere with state machine logic

## Development Commands

### Project Setup

```bash
# Initialize Next.js project
npx create-next-app@latest visual-scxml-editor --typescript --tailwind --app

# Install core dependencies
npm install @monaco-editor/react d3 fast-xml-parser xml-formatter zustand

# Install UI libraries
npm install @headlessui/react lucide-react framer-motion react-color

# Install development tools
npm install -D jest @testing-library/react @testing-library/jest-dom playwright
```

### Development Workflow

```bash
# Start development server
npm run dev

# Run tests
npm run test

# Run linting
npm run lint

# Type checking
npm run type-check

# Build for production
npm run build
```

## File Structure

```
visual-scxml-editor/
├── src/
│   ├── app/                    # Next.js App Router
│   ├── components/             # React components
│   │   ├── editor/            # Monaco Editor components
│   │   ├── diagram/           # D3.js visualization components
│   │   ├── inspector/         # Inspector palette components
│   │   └── ui/                # Reusable UI components
│   ├── lib/                   # Utilities and core logic
│   │   ├── scxml/            # SCXML parsing and validation
│   │   ├── metadata/         # Visual metadata management
│   │   ├── themes/           # VS Code theme integration
│   │   └── utils/            # General utilities
│   ├── types/                 # TypeScript type definitions
│   └── stores/               # Zustand state management
├── public/                    # Static assets
├── tests/                     # Test files
├── docs/                     # Documentation
└── milestones.md             # Development milestones
```

## Success Criteria

The completed web application should:

1. **Match Original Functionality**: All VS Code plugin features available in browser
2. **Enhanced UX**: Improved navigation, theming, and visual feedback
3. **W3C Compliance**: Generate valid SCXML that works with any compliant processor
4. **Production Ready**: Fast, accessible, well-tested, and documented
5. **Open Source**: MIT licensed with comprehensive documentation

## Reference Files

- [Development Milestones](./milestones.md) - Detailed 5-milestone development plan
- [Technical Specifications](./docs/technical-specs.md) - Detailed technical requirements
- [API Documentation](./docs/api.md) - Component and utility API reference

## Getting Started

See [milestones.md](./milestones.md) for the complete development roadmap broken down into 5 achievable milestones.

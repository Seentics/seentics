# Canvas-Based Workflow Builder

## Overview
The automation builder has been transformed from a linear list to a fully interactive 2D canvas-based workflow builder, similar to n8n. This provides a more visual and intuitive way to create complex automation workflows.

## Features

### 🎨 Canvas Interface
- **Drag & Drop**: Drag nodes from the sidebar directly onto the canvas
- **Pan**: Click and drag on the canvas background to pan around
- **Zoom**: Use zoom controls or keyboard shortcuts to zoom in/out
- **Grid Background**: Visual grid helps with node alignment

### 🔗 Node Connections
- **Visual Links**: Nodes show connection lines between them
- **Manual Connecting**: 
  - Click the **bottom handle** (circle) on a node to start connecting
  - Click the **top handle** on another node to complete the connection
  - A temporary dashed line shows while connecting
- **Auto-arrange**: First-time nodes are auto-arranged vertically with connections

### 🖱️ Node Interactions
- **Drag to Reposition**: Click and drag any node to move it around the canvas
- **Configure**: Click the gear icon to open configuration modal
- **Delete**: Click the trash icon to remove a node
- **Hover Effects**: Connection handles appear on hover

### ⌨️ Keyboard Shortcuts
- `Cmd/Ctrl + +` - Zoom in
- `Cmd/Ctrl + -` - Zoom out
- `Cmd/Ctrl + 0` - Reset zoom and pan
- `Cmd/Ctrl + Wheel` - Zoom with mouse wheel

### 🎯 Canvas Controls
Located in the top-left corner:
- **Zoom In** button (🔍+)
- **Zoom Out** button (🔍-)
- **Reset View** button (⊡) - Returns to 100% zoom and center position

### 📊 Status Indicators
- **Zoom Level**: Bottom-left shows current zoom percentage
- **Instructions**: Bottom-right shows helpful tips when nodes are present

## Usage

### Adding Nodes
1. Open the sidebar on the right
2. Choose from **Triggers**, **Logic**, or **Actions** tabs
3. Drag a node type onto the canvas
4. Node appears at your mouse position

### Connecting Nodes
1. Hover over a node to see connection handles (circles)
2. Click the **bottom handle** of the source node
3. Click the **top handle** of the target node
4. Connection line appears between them

### Configuring Nodes
1. Click the gear icon (⚙️) on any node
2. Configure the node settings in the modal
3. Settings are specific to each node type (trigger/action/condition)

### Moving Nodes
1. Click and hold on a node
2. Drag it to the desired position
3. Release to place it

### Deleting Nodes
1. Click the trash icon (🗑️) on any node
2. Node and its connections are removed

## Technical Details

### Components
- **CanvasBuilder.tsx** - Main canvas component with pan/zoom and node rendering
- **WorkflowBuilder.tsx** - Container that integrates canvas, sidebar, and toolbar
- **EnhancedBuilderSidebar.tsx** - Node library with drag support
- **NodeConfigModal.tsx** - Configuration modal for node settings

### Data Structure
Nodes are stored with:
```typescript
{
  id: 'node_123',
  type: 'triggerNode' | 'actionNode' | 'conditionNode',
  position: { x: number, y: number },
  data: {
    label: string,
    description: string,
    config: { /* type-specific config */ }
  }
}
```

Connections are stored separately:
```typescript
{
  from: 'node_id_1',
  to: 'node_id_2'
}
```

### State Management
- **Zustand Store** (`automationStore.ts`) manages nodes and workflow state
- **Local State** in CanvasBuilder manages zoom, pan, and connections
- **Auto-save**: Changes marked as dirty in store trigger save prompts

## Migration from Linear Builder

The previous LinearBuilder component has been replaced with CanvasBuilder. Key changes:

### Before (Linear)
- Vertical list of nodes
- Drag to reorder within list
- Fixed positions

### After (Canvas)
- 2D canvas with free positioning
- Drag nodes anywhere
- Visual connection lines
- Pan and zoom support
- More flexible workflow design

### Data Compatibility
Existing workflows are automatically converted:
- Nodes with `position: {x: 0, y: 0}` are auto-arranged on first load
- Vertical spacing applied automatically
- Connections inferred from node order

## Best Practices

1. **Start with Triggers**: Place trigger nodes at the top of your canvas
2. **Flow Top-to-Bottom**: Design workflows that flow from top to bottom for clarity
3. **Group Related Nodes**: Use positioning to group related logic together
4. **Use Zoom**: Zoom out to see the big picture, zoom in for details
5. **Test Connections**: Always verify connections are correct before saving
6. **Save Often**: Use the save button in the toolbar to preserve your work

## Troubleshooting

### Nodes appear at (0,0)
- This happens on first load of old workflows
- The canvas auto-arranges them vertically
- Drag nodes to preferred positions

### Can't connect nodes
- Ensure you click the **bottom handle** first (source)
- Then click the **top handle** on target node
- Connection handles only appear on hover

### Canvas is too zoomed in/out
- Use `Cmd/Ctrl + 0` to reset view
- Or click the Reset View button (⊡)

### Nodes disappear when panning
- Zoom out to see more of the canvas
- Use Reset View to center everything

## Future Enhancements

Potential improvements for future versions:
- [ ] Mini-map for large workflows
- [ ] Multi-select with Shift+Click
- [ ] Selection box with drag
- [ ] Snap-to-grid option
- [ ] Undo/Redo functionality
- [ ] Copy/Paste nodes
- [ ] Export/Import workflows as JSON
- [ ] Connection deletion by clicking line
- [ ] Node grouping/subflows
- [ ] Comments and annotations

---

**Note**: This canvas builder provides a professional workflow editing experience similar to tools like n8n, making complex automation flows easier to visualize and manage.

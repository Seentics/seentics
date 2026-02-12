'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Settings2, 
  Zap,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { useAutomationStore } from '@/stores/automationStore';
import { Button } from '@/components/ui/button';
import { 
  TRIGGER_TYPES, 
  ACTION_TYPES, 
  LOGIC_TYPES 
} from './EnhancedBuilderSidebar';

// Helper to get icon for node
const getIcon = (type: string, subtype?: string) => {
  const all = [...TRIGGER_TYPES, ...ACTION_TYPES, ...LOGIC_TYPES];
  const item = all.find(i => (i.type === type && (!subtype || (i as any).subtype === subtype)));
  return item?.icon || Zap;
};

const getColorClass = (type: string, subtype?: string) => {
  const all = [...TRIGGER_TYPES, ...ACTION_TYPES, ...LOGIC_TYPES];
  const item = all.find(i => (i.type === type && (!subtype || (i as any).subtype === subtype)));
  
  const colorMap: Record<string, string> = {
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    lime: 'bg-lime-500/10 text-lime-500 border-lime-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    pink: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  };
  
  return colorMap[item?.color || 'blue'] || colorMap.blue;
};

interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
}

export const CanvasBuilder = () => {
  const { nodes, setNodes, updateNode, deleteNode, setSelectedNodeId } = useAutomationStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [nodeConnections, setNodeConnections] = useState<Array<{ from: string; to: string }>>([]);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [isDraggingConnection, setIsDraggingConnection] = useState(false);

  // Handle node drag
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('.connection-handle')) return;
    e.stopPropagation();
    setDraggedNode(nodeId);
    setHasMoved(false);
    setDragStart({ 
      x: e.clientX - nodes.find(n => n.id === nodeId)!.position.x * zoom, 
      y: e.clientY - nodes.find(n => n.id === nodeId)!.position.y * zoom 
    });
  };

  // Handle node click (only if not dragged)
  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('.connection-handle')) return;
    e.stopPropagation();
    
    // Only open modal if we didn't drag the node and not connecting
    if (!hasMoved && !connectingFrom && !isDraggingConnection) {
      setSelectedNodeId(nodeId);
    }
    
    // If we're connecting, finish the connection
    if (connectingFrom && connectingFrom !== nodeId && isDraggingConnection) {
      const exists = nodeConnections.some(
        conn => conn.from === connectingFrom && conn.to === nodeId
      );
      if (!exists) {
        setNodeConnections([...nodeConnections, { from: connectingFrom, to: nodeId }]);
      }
      setConnectingFrom(null);
      setIsDraggingConnection(false);
    }
  };

  // Handle connection start - drag from handle
  const handleConnectionHandleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setConnectingFrom(nodeId);
    setIsDraggingConnection(true);
    setHasMoved(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggedNode) {
      setHasMoved(true);
      const node = nodes.find(n => n.id === draggedNode);
      if (node) {
        updateNode(draggedNode, {
          ...node.data,
        });
        const newNodes = nodes.map(n => 
          n.id === draggedNode 
            ? { ...n, position: { x: (e.clientX - dragStart.x) / zoom, y: (e.clientY - dragStart.y) / zoom } }
            : n
        );
        setNodes(newNodes);
      }
    } else if (isDragging) {
      setPan({
        x: pan.x + e.movementX,
        y: pan.y + e.movementY
      });
    }
    
    // Track mouse position for connection line
    if (connectingFrom) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        setMousePos({
          x: (e.clientX - rect.left - pan.x) / zoom,
          y: (e.clientY - rect.top - pan.y) / zoom
        });
      }
    }
  }, [draggedNode, isDragging, nodes, dragStart, zoom, pan, connectingFrom, updateNode, setNodes]);

  const handleMouseUp = useCallback(() => {
    setDraggedNode(null);
    setIsDragging(false);
    // Cancel connection if clicking outside nodes
    if (connectingFrom && isDraggingConnection) {
      setConnectingFrom(null);
      setIsDraggingConnection(false);
    }
  }, [connectingFrom, isDraggingConnection]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cancel connection on Escape
      if (e.key === 'Escape' && connectingFrom) {
        setConnectingFrom(null);
        setIsDraggingConnection(false);
        return;
      }
      
      // Zoom in: Cmd/Ctrl + Plus
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom(prev => Math.min(prev + 0.1, 2));
      }
      // Zoom out: Cmd/Ctrl + Minus
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        setZoom(prev => Math.max(prev - 0.1, 0.5));
      }
      // Reset: Cmd/Ctrl + 0
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
      // Delete selected node: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
        const activeElement = document.activeElement;
        // Only delete if not typing in an input
        if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          // Delete logic would go here if we tracked selected node in canvas
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [connectingFrom]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom(prev => Math.min(Math.max(prev + delta, 0.5), 2));
    }
  }, []);

  // Auto-arrange nodes in a flow
  useEffect(() => {
    if (nodes.length > 0 && nodes.every(n => n.position.x === 0 && n.position.y === 0)) {
      const arranged = nodes.map((node, index) => ({
        ...node,
        position: { x: 400, y: 100 + index * 120 }
      }));
      setNodes(arranged);
      
      // Create connections
      const connections = [];
      for (let i = 0; i < arranged.length - 1; i++) {
        connections.push({ from: arranged[i].id, to: arranged[i + 1].id });
      }
      setNodeConnections(connections);
    }
  }, [nodes.length]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.canvas-background')) {
      setIsDragging(true);
    }
  };

  return (
    <div className="flex-1 relative overflow-hidden bg-slate-950" ref={canvasRef} onWheel={handleWheel}>
      {/* Canvas Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 bg-slate-900/90 border-slate-800 hover:bg-slate-800"
          onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
          title="Zoom In (Cmd +)"
        >
          <ZoomIn size={16} />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 bg-slate-900/90 border-slate-800 hover:bg-slate-800"
          onClick={() => setZoom(Math.max(zoom - 0.1, 0.5))}
          title="Zoom Out (Cmd -)"
        >
          <ZoomOut size={16} />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 bg-slate-900/90 border-slate-800 hover:bg-slate-800"
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          title="Reset View (Cmd 0)"
        >
          <Maximize2 size={16} />
        </Button>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 left-4 z-10 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-400 font-medium">
        {Math.round(zoom * 100)}%
      </div>

      {/* Instructions */}
      {nodes.length > 0 && (
        <div className="absolute bottom-4 right-4 z-10 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-400 font-medium flex items-center gap-2">
          {connectingFrom ? (
            <span className="text-primary animate-pulse">🔗 Release on any node to connect • Esc to cancel</span>
          ) : (
            <span>💡 Click node to configure • Drag bottom handle to connect</span>
          )}
        </div>
      )}

      {/* Canvas */}
      <div
        className="w-full h-full cursor-grab active:cursor-grabbing canvas-background"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(100, 116, 139, 0.1) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
        onMouseDown={handleCanvasMouseDown}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            position: 'relative'
          }}
        >
          {/* Connection Lines */}
          <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            {/* Existing connections */}
            {nodeConnections.map((conn, idx) => {
              const fromNode = nodes.find(n => n.id === conn.from);
              const toNode = nodes.find(n => n.id === conn.to);
              if (!fromNode || !toNode) return null;

              const x1 = fromNode.position.x + 125;
              const y1 = fromNode.position.y + 43;
              const x2 = toNode.position.x + 125;
              const y2 = toNode.position.y + 5;

              return (
                <path
                  key={idx}
                  d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                  stroke="rgb(71, 85, 105)"
                  strokeWidth="2"
                  fill="none"
                />
              );
            })}
            
            {/* Temporary connection line while dragging */}
            {connectingFrom && (() => {
              const fromNode = nodes.find(n => n.id === connectingFrom);
              if (!fromNode) return null;

              const x1 = fromNode.position.x + 125;
              const y1 = fromNode.position.y + 43;
              const x2 = mousePos.x;
              const y2 = mousePos.y;

              return (
                <path
                  d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                  stroke="rgb(99, 102, 241)"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  fill="none"
                  opacity="0.6"
                />
              );
            })()}
          </svg>

          {/* Empty State */}
          {nodes.length === 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="h-16 w-16 bg-slate-900/50 rounded-lg flex items-center justify-center mx-auto text-slate-600 mb-4">
                <Zap size={32} />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Start building</h3>
              <p className="text-slate-500 text-sm">Drag a node from the sidebar to begin</p>
            </div>
          )}

          {/* Nodes */}
          {nodes.map((node) => {
            const Icon = getIcon(node.type || '', node.data.config?.triggerType || node.data.config?.actionType || node.data.config?.conditionType);
            const colorClass = getColorClass(node.type || '', node.data.config?.triggerType || node.data.config?.actionType || node.data.config?.conditionType);
            const isConnecting = connectingFrom === node.id;
            const canConnect = connectingFrom && connectingFrom !== node.id;

            return (
              <div
                key={node.id}
                className="absolute group"
                style={{
                  left: `${node.position.x}px`,
                  top: `${node.position.y}px`,
                  cursor: draggedNode === node.id ? 'grabbing' : 'grab'
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onMouseUp={(e) => handleNodeClick(e, node.id)}
              >
                <div className={`w-[250px] bg-slate-900/90 border-2 ${
                  isConnecting ? 'border-primary ring-2 ring-primary/50' : 
                  canConnect ? 'border-primary/50 hover:border-primary' : 
                  'border-slate-800 hover:border-slate-700'
                } rounded-lg p-3 transition-all shadow-xl backdrop-blur-sm ${
                  canConnect ? 'cursor-pointer' : ''
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg ${colorClass} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {node.data.label}
                      </h4>
                      {node.data.description && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {node.data.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-slate-500 hover:text-white hover:bg-white/10" 
                        onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                      >
                        <Settings2 size={14} />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-slate-500 hover:text-red-500 hover:bg-red-500/10" 
                        onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Connection Points */}
                  <div 
                    className="connection-handle absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-slate-700 border-2 border-slate-900 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair hover:bg-primary hover:border-primary z-10" 
                    title="Drop connection here"
                  />
                  <div 
                    className="connection-handle absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 bg-primary border-2 border-slate-900 rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-grab active:cursor-grabbing hover:scale-110 hover:ring-2 hover:ring-primary/50 z-10" 
                    onMouseDown={(e) => handleConnectionHandleMouseDown(e, node.id)}
                    title="Drag to connect"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

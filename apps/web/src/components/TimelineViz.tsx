"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { api, TimelineEvent, Character } from "@/lib/api";
import { useAppContext } from "./AppProvider";
import { Clock, Layers, Sliders, Users } from "lucide-react";

export default function TimelineViz() {
  const { storyId, branchId, currentSequence, setCurrentSequence, setSelectedCharacterId } = useAppContext();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [viewMode, setViewMode] = useState<"timeline" | "network">("timeline");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (storyId) {
      setLoading(true);
      Promise.all([
        api.getTimeline(storyId, branchId),
        api.getCharacters(storyId, branchId)
      ])
        .then(([timelineData, charData]) => {
          setEvents(timelineData.events || []);
          setCharacters(charData || []);
          if (timelineData.events?.length > 0) {
            // Find current event or latest
            const match = timelineData.events.find(e => e.sequence === currentSequence) || timelineData.events[timelineData.events.length - 1];
            setSelectedEvent(match);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [storyId, branchId]);

  // Synchronize selectedEvent with currentSequence
  useEffect(() => {
    if (events.length > 0) {
      const match = events.find(e => e.sequence === currentSequence);
      if (match) setSelectedEvent(match);
    }
  }, [currentSequence, events]);

  const maxSeq = useMemo(() => {
    return Math.max(...events.map(e => e.sequence), 1);
  }, [events]);

  // D3 Visualization Renderer
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 450;
    
    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    if (events.length === 0) return;

    if (viewMode === "timeline") {
      renderTimelineView(svg, width, height);
    } else {
      renderNetworkView(svg, width, height);
    }
  }, [events, currentSequence, viewMode, characters]);

  const renderTimelineView = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, width: number, height: number) => {
    const margin = { top: 60, right: 60, bottom: 60, left: 60 };
    const innerWidth = Math.max(width - margin.left - margin.right, 300);
    const centerY = height / 2;

    const sortedEvents = [...events].sort((a, b) => a.sequence - b.sequence);
    
    // Linear scale for sequences
    const minSeq = 1;
    const effectiveMaxSeq = Math.max(maxSeq, 2);
    const xScale = d3.scaleLinear()
      .domain([minSeq, effectiveMaxSeq])
      .range([0, innerWidth]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${centerY})`);

    // Add glowing filter definitions
    const defs = svg.append("defs");
    const filter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    filter.append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Main canon baseline
    g.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", innerWidth)
      .attr("y2", 0)
      .attr("stroke", "#3f3f46")
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round");

    // A branch gets its own lane above canon.  This makes a divergence visible
    // even when the alternate events have the same sequence numbers as canon.
    const branchEvents = sortedEvents.filter(e => !e.canonical);
    if (branchEvents.length > 0) {
      const firstBranchSeq = branchEvents[0].sequence;
      const startX = xScale(Math.max(minSeq, firstBranchSeq - 1));
      const branchLine = d3.line<TimelineEvent>()
        .x(d => xScale(d.sequence))
        .y(() => -48)
        .curve(d3.curveMonotoneX);
      const branchPath = branchLine(branchEvents) || "";
      g.append("path")
        .attr("d", `M ${startX} 0 C ${startX + 24} -32, ${startX + 36} -48, ${xScale(firstBranchSeq)} -48 ${branchPath.replace(/^M[^L]*?(-?\d+(?:\.\d+)?)\s+-48/, "")}`)
        .attr("fill", "none")
        .attr("stroke", "#8b5cf6")
        .attr("stroke-width", 2.5)
        .attr("stroke-dasharray", "4 4");

      g.append("text")
        .attr("x", Math.min(xScale(firstBranchSeq) + 8, innerWidth - 90))
        .attr("y", -62)
        .attr("fill", "#a78bfa")
        .attr("font-family", "monospace")
        .attr("font-size", "10px")
        .attr("font-weight", "bold")
        .text("ALTERNATE TIMELINE");
    }

    // Knowledge Horizon vertical barrier
    const horizonSeqClamped = Math.max(minSeq, Math.min(currentSequence, effectiveMaxSeq));
    const horizonX = xScale(horizonSeqClamped);
    
    const horizonGroup = g.append("g")
      .attr("class", "horizon-line")
      .attr("transform", `translate(${horizonX}, 0)`);

    horizonGroup.append("line")
      .attr("y1", -centerY + 20)
      .attr("y2", centerY - 20)
      .attr("stroke", "#eab308")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "5 5")
      .attr("opacity", 0.85);

    horizonGroup.append("rect")
      .attr("x", -55)
      .attr("y", -centerY + 10)
      .attr("width", 110)
      .attr("height", 20)
      .attr("rx", 4)
      .attr("fill", "#18181b")
      .attr("stroke", "#eab308")
      .attr("stroke-width", 1);

    horizonGroup.append("text")
      .attr("x", 0)
      .attr("y", -centerY + 24)
      .attr("text-anchor", "middle")
      .attr("fill", "#eab308")
      .attr("font-family", "monospace")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .text(`HORIZON: SEQ ${currentSequence}`);

    // Draw Event Nodes
    const nodeGroups = g.selectAll(".event-node")
      .data(sortedEvents)
      .enter()
      .append("g")
      .attr("class", "event-node cursor-pointer")
      .attr("transform", d => {
        const yOffset = !d.canonical ? -48 : 0;
        return `translate(${xScale(d.sequence)}, ${yOffset})`;
      })
      .on("click", (e, d) => {
        setCurrentSequence(d.sequence);
        setSelectedEvent(d);
      });

    // Outer glow for active node
    nodeGroups.filter(d => d.sequence === currentSequence)
      .append("circle")
      .attr("r", 18)
      .attr("fill", d => d.canonical ? "rgba(234, 179, 8, 0.2)" : "rgba(139, 92, 246, 0.2)")
      .attr("filter", "url(#glow)");

    // Base circle
    nodeGroups.append("circle")
      .attr("r", d => d.sequence === currentSequence ? 11 : 8)
      .attr("fill", d => {
        if (!d.canonical) return "#8b5cf6";
        return d.sequence <= currentSequence ? "#eab308" : "#27272a";
      })
      .attr("stroke", d => {
        if (d.sequence === currentSequence) return "#ffffff";
        return d.canonical ? "#eab308" : "#8b5cf6";
      })
      .attr("stroke-width", d => d.sequence === currentSequence ? 3 : 2)
      .attr("opacity", d => d.sequence > currentSequence ? 0.4 : 1)
      .transition()
      .duration(300);

    // Sequence numbers inside/above circles
    nodeGroups.append("text")
      .attr("y", 3)
      .attr("text-anchor", "middle")
      .attr("fill", d => d.sequence <= currentSequence ? "#09090b" : "#a1a1aa")
      .attr("font-family", "monospace")
      .attr("font-size", "9px")
      .attr("font-weight", "bold")
      .text(d => d.sequence);

    // Labels with staggered heights
    nodeGroups.append("text")
      .attr("y", (d, i) => (!d.canonical ? -68 : (i % 2 === 0 ? 32 : -26)))
      .attr("text-anchor", "middle")
      .attr("fill", d => d.sequence === currentSequence ? "#ffffff" : (d.sequence <= currentSequence ? "#f4f4f5" : "#71717a"))
      .attr("font-family", "serif")
      .attr("font-size", d => d.sequence === currentSequence ? "12px" : "11px")
      .attr("font-weight", d => d.sequence === currentSequence ? "bold" : "normal")
      .text(d => {
        const text = d.title || `Event ${d.sequence}`;
        return text.length > 22 ? text.substring(0, 22) + "…" : text;
      });
  };

  const renderNetworkView = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, width: number, height: number) => {
    // Build graph nodes and links from characters and events
    interface GraphNode extends d3.SimulationNodeDatum {
      id: string;
      label: string;
      type: "character" | "event";
      alive?: boolean;
    }
    interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
      source: string | GraphNode;
      target: string | GraphNode;
    }

    const graphNodes: GraphNode[] = [];
    const graphLinks: GraphLink[] = [];

    characters.forEach(c => {
      graphNodes.push({
        id: c.id,
        label: c.name,
        type: "character",
        alive: c.alive,
      });
    });

    events.forEach(e => {
      graphNodes.push({
        id: e.id,
        label: `[Seq ${e.sequence}] ${e.title}`,
        type: "event",
      });

      e.participants.forEach(pid => {
        if (characters.some(c => c.id === pid)) {
          graphLinks.push({
            source: pid,
            target: e.id,
          });
        }
      });
    });

    const g = svg.append("g");

    const simulation = d3.forceSimulation<GraphNode>(graphNodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(graphLinks).id(d => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    const link = g.append("g")
      .attr("stroke", "#3f3f46")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(graphLinks)
      .enter().append("line")
      .attr("stroke-width", 1.5);

    const node = g.append("g")
      .selectAll("g")
      .data(graphNodes)
      .enter().append("g")
      .attr("class", "cursor-pointer")
      .on("click", (e, d) => {
        if (d.type === "character") {
          setSelectedCharacterId(d.id);
        } else {
          const ev = events.find(ev => ev.id === d.id);
          if (ev) {
            setCurrentSequence(ev.sequence);
            setSelectedEvent(ev);
          }
        }
      });

    node.append("circle")
      .attr("r", d => d.type === "character" ? 14 : 10)
      .attr("fill", d => d.type === "character" ? "#eab308" : "#8b5cf6")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5);

    node.append("text")
      .attr("dy", d => d.type === "character" ? 24 : 20)
      .attr("text-anchor", "middle")
      .attr("fill", "#f4f4f5")
      .attr("font-size", "10px")
      .attr("font-family", "sans-serif")
      .text(d => d.label.length > 18 ? d.label.substring(0, 18) + "…" : d.label);

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x || 0)
        .attr("y1", d => (d.source as GraphNode).y || 0)
        .attr("x2", d => (d.target as GraphNode).x || 0)
        .attr("y2", d => (d.target as GraphNode).y || 0);

      node.attr("transform", d => `translate(${d.x || 0},${d.y || 0})`);
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      
      {/* Visualizer Controls Top Toolbar */}
      <div className="flex-none px-6 py-3 border-b border-white/10 bg-black/20 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        
        {/* Left: View Mode Toggle & Legend */}
        <div className="flex items-center gap-4">
          <div className="flex bg-black/40 border border-white/15 rounded-lg p-1 text-xs font-mono backdrop-blur-md">
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                viewMode === "timeline"
                  ? "bg-white/20 text-white font-bold border border-white/20 shadow-sm backdrop-blur-md"
                  : "text-primary-muted hover:text-white"
              }`}
            >
              <Clock size={13} /> Chrono Timeline
            </button>
            <button
              onClick={() => setViewMode("network")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                viewMode === "network"
                  ? "bg-white/20 text-white font-bold border border-white/20 shadow-sm backdrop-blur-md"
                  : "text-primary-muted hover:text-white"
              }`}
            >
              <Layers size={13} /> Entity Network
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-primary-muted">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-canon inline-block shadow-sm"></span>
              <span>Canon</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-generated inline-block shadow-sm"></span>
              <span>Divergent</span>
            </div>
          </div>
        </div>

        {/* Right: Timeline Scrubber Slider */}
        <div className="flex items-center gap-3 bg-black/40 border border-white/15 px-3 py-1.5 rounded-lg backdrop-blur-md">
          <Sliders size={14} className="text-canon" />
          <span className="text-xs font-mono text-primary-muted">Sequence:</span>
          <input 
            type="range"
            min={1}
            max={maxSeq}
            value={currentSequence || 1}
            onChange={(e) => setCurrentSequence(Number(e.target.value))}
            className="w-32 accent-canon cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-canon min-w-[20px] text-right">
            {currentSequence}
          </span>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div ref={containerRef} className="flex-1 w-full h-full relative min-h-[280px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-10 font-mono text-xs text-primary-muted">
            Mapping narrative coordinates...
          </div>
        )}
        <svg ref={svgRef} className="w-full h-full block" />
      </div>

      {/* Event Details Drawer / Inspector Card */}
      {selectedEvent && (
        <div className="flex-none p-4 border-t border-white/10 bg-black/35 backdrop-blur-xl flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                selectedEvent.canonical
                  ? 'bg-canon/10 text-canon border-canon/30'
                  : 'bg-generated/10 text-generated border-generated/30'
              }`}>
                SEQ {selectedEvent.sequence} • {selectedEvent.canonical ? 'CANON BEAT' : 'DIVERGENT OUTCOME'}
              </span>
              <h3 className="font-serif font-bold text-sm text-primary">{selectedEvent.title}</h3>
            </div>
            
            {selectedEvent.participants.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-mono text-primary-muted">
                <Users size={13} className="text-primary-muted" />
                <span>{selectedEvent.participants.map(p => p.replace(/_/g, " ")).join(", ")}</span>
              </div>
            )}
          </div>

          <p className="text-xs font-serif text-primary-muted leading-relaxed line-clamp-2">
            {selectedEvent.description}
          </p>
        </div>
      )}
    </div>
  );
}

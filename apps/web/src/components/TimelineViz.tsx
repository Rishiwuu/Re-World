"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { api, TimelineEvent, Character, BranchInfo } from "@/lib/api";
import { useAppContext } from "./AppProvider";
import { Clock, Layers, Sliders, Users, ChevronDown, ChevronUp } from "lucide-react";

// Timeline Glow & Brightness Configuration (Adjust these values to set desired brightness)
export const TIMELINE_GLOW_CONFIG = {
  bloomBlur: 8,           // SVG gaussian blur radius (px)
  shadowBlur: 10,         // CSS drop-shadow blur radius (px)
  lineOpacity: 0.85,      // Baseline & branch opacity
  laserPulseOpacity: 0.9, // Animated laser beam pulse opacity
  lineWidth: 2.5,         // Core line thickness (px)
};

export default function TimelineViz() {
  const { storyId, branchId, setBranchId, currentSequence, setCurrentSequence, setSelectedCharacterId, isDarkMode } = useAppContext();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [canonEvents, setCanonEvents] = useState<TimelineEvent[]>([]);
  const [allBranches, setAllBranches] = useState<BranchInfo[]>([]);
  const [branchMap, setBranchMap] = useState<Record<string, TimelineEvent[]>>({});
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [viewMode, setViewMode] = useState<"timeline" | "network">("timeline");
  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [showEventDrawer, setShowEventDrawer] = useState(true);

  // ResizeObserver to ensure SVG canvas dynamically updates on all screen/window size changes
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (storyId) {
      setLoading(true);
      Promise.all([
        api.getTimeline(storyId, branchId),
        api.getCharacters(storyId, branchId),
        api.getTimeline(storyId, "canon"),
        api.listBranches(storyId),
      ])
        .then(async ([timelineData, charData, canonData, branchesList]) => {
          setEvents(timelineData.events || []);
          setCharacters(charData || []);
          const canonEvs = canonData?.events || timelineData.events || [];
          setCanonEvents(canonEvs);
          setAllBranches(branchesList || []);

          // Fetch timeline events for all branches
          const map: Record<string, TimelineEvent[]> = {};
          map["canon"] = canonEvs;
          for (const b of branchesList || []) {
            try {
              const res = await api.getTimeline(storyId, b.id);
              map[b.id] = res.events || [];
            } catch (e) {
              console.error(e);
            }
          }
          setBranchMap(map);

          if (timelineData.events?.length > 0) {
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
    let maxS = 1;
    Object.values(branchMap).forEach(evs => {
      evs.forEach(e => {
        if (e.sequence > maxS) maxS = e.sequence;
      });
    });
    return maxS;
  }, [branchMap]);

  // D3 Visualization Renderer with Zoom & Pan support
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 480;
    
    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    // SVG Defs: Filters and Cyber Graph Matrix Pattern
    const defs = svg.append("defs");

    // 1. Hyper-bloom glow filter
    const bloom = defs.append("filter")
      .attr("id", "hyper-bloom")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    bloom.append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "coloredBlur");
    const feMerge = bloom.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // 2. Subtle Coordinate Graph Grid Pattern
    const gridPattern = defs.append("pattern")
      .attr("id", "timeline-grid")
      .attr("width", 40)
      .attr("height", 40)
      .attr("patternUnits", "userSpaceOnUse");

    gridPattern.append("path")
      .attr("d", "M 40 0 L 0 0 0 40")
      .attr("fill", "none")
      .attr("stroke", isDarkMode ? "rgba(255, 255, 255, 0.035)" : "rgba(15, 23, 42, 0.05)")
      .attr("stroke-width", 1);

    gridPattern.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", 0.8)
      .attr("fill", isDarkMode ? "rgba(251, 191, 36, 0.25)" : "rgba(217, 119, 6, 0.25)");

    if (events.length === 0 && canonEvents.length === 0) return;

    // Attach D3 Zoom & Pan handler
    const zoomGroup = svg.append("g").attr("class", "zoom-container");

    // Zoomable Infinite Backdrop Graph Layer
    zoomGroup.append("rect")
      .attr("x", -5000)
      .attr("y", -5000)
      .attr("width", 10000)
      .attr("height", 10000)
      .attr("fill", "url(#timeline-grid)")
      .attr("pointer-events", "none");

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 3])
      .on("zoom", (event) => {
        zoomGroup.attr("transform", event.transform);
      });

    // Disable default double-click zoom to allow smooth node interaction
    svg.call(zoomBehavior).on("dblclick.zoom", null);

    if (viewMode === "timeline") {
      renderTimelineView(zoomGroup, defs, width, height);
    } else {
      renderNetworkView(zoomGroup, width, height);
    }
  }, [events, canonEvents, allBranches, branchMap, currentSequence, branchId, viewMode, characters, isDarkMode, dimensions]);

  const renderTimelineView = (
    zoomGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
    width: number,
    height: number
  ) => {
    const margin = { top: 60, right: 80, bottom: 60, left: 80 };
    const innerWidth = Math.max(width - margin.left - margin.right, 400);

    // Calculate maximum branch depth to dynamically adjust vertical scaling
    let maxAbsY = 0;
    const paletteColors = isDarkMode
      ? ["#00ffff", "#ff007f", "#b537f7", "#00ff88", "#ff5500", "#00e5ff", "#ff00c8"]
      : ["#0284c7", "#dc2626", "#7e22ce", "#059669", "#c2410c", "#0d9488", "#be185d"];

    const branchChildrenMap: Record<string, BranchInfo[]> = {};
    allBranches.forEach(b => {
      const pId = b.parent_branch_id || "canon";
      if (!branchChildrenMap[pId]) branchChildrenMap[pId] = [];
      branchChildrenMap[pId].push(b);
    });

    interface BranchVisual {
      yOffset: number;
      color: string;
      parentY: number;
      divSeq: number;
      depth: number;
    }

    const mainColor = isDarkMode ? "#ffe600" : "#d97706";
    const branchVisualMap: Record<string, BranchVisual> = {};
    branchVisualMap["canon"] = { yOffset: 0, color: mainColor, parentY: 0, divSeq: 1, depth: 0 };

    // Dynamic vertical step based on number of branches to prevent overlapping
    const totalBranchCount = allBranches.length;
    const verticalStep = totalBranchCount > 4 ? 65 : 75;

    function positionBranchChildren(parentId: string, parentY: number, parentDepth: number) {
      const children = branchChildrenMap[parentId] || [];
      if (children.length === 0) return;

      children.forEach((child, idx) => {
        const direction = idx % 2 === 0 ? -1 : 1;
        const step = Math.ceil((idx + 1) / 2) * verticalStep;
        const childY = parentY + (direction * step);

        if (Math.abs(childY) > maxAbsY) maxAbsY = Math.abs(childY);

        const color = paletteColors[(parentDepth + idx) % paletteColors.length];

        branchVisualMap[child.id] = {
          yOffset: childY,
          color: color,
          parentY: parentY,
          divSeq: child.divergence_sequence,
          depth: parentDepth + 1,
        };

        positionBranchChildren(child.id, childY, parentDepth + 1);
      });
    }

    positionBranchChildren("canon", 0, 0);

    const centerY = height / 2;

    // Linear scale for sequence x-coordinates
    const minSeq = 1;
    const effectiveMaxSeq = Math.max(maxSeq, 2);
    const xScale = d3.scaleLinear()
      .domain([minSeq, effectiveMaxSeq])
      .range([0, innerWidth]);

    const g = zoomGroup.append("g")
      .attr("transform", `translate(${margin.left}, ${centerY})`);

    // 1. Subtle Sequence Column Coordinate Guides (Backdrop Graph)
    const gridGuideGroup = g.append("g").attr("class", "sequence-grid-guides").attr("opacity", isDarkMode ? 0.35 : 0.45);
    for (let s = minSeq; s <= effectiveMaxSeq; s++) {
      const xPos = xScale(s);
      gridGuideGroup.append("line")
        .attr("x1", xPos)
        .attr("y1", -centerY + 16)
        .attr("x2", xPos)
        .attr("y2", centerY - 16)
        .attr("stroke", isDarkMode ? "rgba(255, 255, 255, 0.07)" : "rgba(15, 23, 42, 0.08)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3 4");

      // Minor bottom sequence coordinate tick text
      gridGuideGroup.append("text")
        .attr("x", xPos)
        .attr("y", centerY - 6)
        .attr("text-anchor", "middle")
        .attr("fill", isDarkMode ? "rgba(255, 255, 255, 0.22)" : "rgba(15, 23, 42, 0.32)")
        .attr("font-family", "monospace")
        .attr("font-size", "9px")
        .text(`S${s}`);
    }

    // Determine active divergence sequence if currently on a branch
    const activeBranchInfo = allBranches.find(b => b.id === branchId);
    const activeDivergenceSeq = activeBranchInfo ? activeBranchInfo.divergence_sequence : Infinity;

    // Helper to generate seamless continuous flowing linear gradients in defs
    const getFlowGradientId = (id: string, color: string, isFast: boolean = false) => {
      const gradId = `flow-grad-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      const existing = defs.select(`#${gradId}`);
      if (!existing.empty()) existing.remove();

      const grad = defs.append("linearGradient")
        .attr("id", gradId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%")
        .attr("spreadMethod", "repeat");

      grad.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.45);
      grad.append("stop").attr("offset", "20%").attr("stop-color", color).attr("stop-opacity", 0.9);
      grad.append("stop").attr("offset", "25%").attr("stop-color", "#ffffff").attr("stop-opacity", 1);
      grad.append("stop").attr("offset", "30%").attr("stop-color", color).attr("stop-opacity", 0.9);
      grad.append("stop").attr("offset", "50%").attr("stop-color", color).attr("stop-opacity", 0.45);
      grad.append("stop").attr("offset", "70%").attr("stop-color", color).attr("stop-opacity", 0.9);
      grad.append("stop").attr("offset", "75%").attr("stop-color", "#ffffff").attr("stop-opacity", 1);
      grad.append("stop").attr("offset", "80%").attr("stop-color", color).attr("stop-opacity", 0.9);
      grad.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0.45);

      grad.append("animate")
        .attr("attributeName", "x1")
        .attr("from", "0%")
        .attr("to", "100%")
        .attr("dur", isFast ? "1.5s" : "2.4s")
        .attr("repeatCount", "indefinite");

      grad.append("animate")
        .attr("attributeName", "x2")
        .attr("from", "100%")
        .attr("to", "200%")
        .attr("dur", isFast ? "1.5s" : "2.4s")
        .attr("repeatCount", "indefinite");

      return gradId;
    };

    // Helper to render 100% continuous multi-layer plasma & laser energy streams
    const renderContinuousEnergyStream = (
      parentG: d3.Selection<SVGGElement, unknown, null, undefined>,
      type: "line" | "path",
      attrs: Record<string, string | number>,
      color: string,
      streamId: string,
      isActive: boolean
    ) => {
      const gradId = getFlowGradientId(streamId, color, isActive);

      // Layer 1: Ambient soft conduit tube (continuous glow)
      const ambient = parentG.append(type)
        .attr("stroke", color)
        .attr("stroke-width", isActive ? 6 : 4.5)
        .attr("opacity", 0.22)
        .attr("filter", "url(#hyper-bloom)");

      // Layer 2: Core solid fiber line (crisp continuous neon)
      const coreFiber = parentG.append(type)
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round")
        .style("filter", `drop-shadow(0 0 6px ${color})`);

      // Layer 3: Continuous Animated Gradient Flow (100% uninterrupted luminous light wave)
      const gradStream = parentG.append(type)
        .attr("stroke", `url(#${gradId})`)
        .attr("stroke-width", isActive ? 3.4 : 2.6)
        .attr("stroke-linecap", "round")
        .attr("class", "continuous-plasma-beam")
        .style("filter", `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 16px ${color})`);

      // Layer 4: High-intensity continuous wave surge
      const waveSurge = parentG.append(type)
        .attr("stroke", color)
        .attr("stroke-width", isActive ? 2.8 : 2.2)
        .attr("opacity", 0.9)
        .attr("class", isActive ? "continuous-energy-wave-fast" : "continuous-energy-wave");

      // Layer 5: Thin white-hot center laser surge
      const laserSurge = parentG.append(type)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.2)
        .attr("opacity", 0.95)
        .attr("class", isActive ? "continuous-laser-core-fast" : "continuous-laser-core");

      if (type === "path") {
        [ambient, coreFiber, gradStream, waveSurge, laserSurge].forEach(elem => {
          elem.attr("d", String(attrs.d)).attr("fill", "none");
        });
      } else {
        [ambient, coreFiber, gradStream, waveSurge, laserSurge].forEach(elem => {
          elem
            .attr("x1", attrs.x1)
            .attr("y1", attrs.y1)
            .attr("x2", attrs.x2)
            .attr("y2", attrs.y2);
        });
      }
    };

    // 2. Draw Main Canon Baseline (Continuous Glowing Quantum Conduit)
    renderContinuousEnergyStream(
      g,
      "line",
      { x1: 0, y1: 0, x2: innerWidth, y2: 0 },
      mainColor,
      "canon",
      branchId === "canon"
    );

    // Invisible wide click hitbox for main canon baseline
    g.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", innerWidth)
      .attr("y2", 0)
      .attr("stroke", "transparent")
      .attr("stroke-width", 24)
      .attr("class", "cursor-pointer")
      .on("click", (e) => {
        e.stopPropagation();
        if (branchId !== "canon") setBranchId("canon");
        const [mouseX] = d3.pointer(e, g.node());
        const clickedSeq = Math.round(xScale.invert(mouseX));
        if (clickedSeq >= minSeq && clickedSeq <= effectiveMaxSeq) {
          setCurrentSequence(clickedSeq);
        }
      });

    // 3. Draw Paths for all Branches (Direct & Child) (Fluid Quantum Conduits)
    allBranches.forEach((b) => {
      const visual = branchVisualMap[b.id];
      if (!visual) return;

      const bEvents = branchMap[b.id] || [];
      const branchOnlyEvents = bEvents.filter(e => e.sequence >= b.divergence_sequence);
      if (branchOnlyEvents.length === 0) return;

      const divSeq = b.divergence_sequence;
      const startX = xScale(Math.max(minSeq, divSeq - 1));
      const endX = xScale(divSeq);
      const parentY = visual.parentY;
      const targetY = visual.yOffset;

      const curveD = `M ${startX} ${parentY} C ${startX + 24} ${parentY + (targetY - parentY) * 0.6}, ${endX - 12} ${targetY}, ${endX} ${targetY}`;

      // Continuous Fluid Energy Stream along divergence curve
      renderContinuousEnergyStream(
        g,
        "path",
        { d: curveD },
        visual.color,
        `${b.id}-curve`,
        b.id === branchId
      );

      // Invisible click hitbox for branch curve
      g.append("path")
        .attr("d", curveD)
        .attr("fill", "none")
        .attr("stroke", "transparent")
        .attr("stroke-width", 24)
        .attr("class", "cursor-pointer")
        .on("click", (e) => {
          e.stopPropagation();
          setBranchId(b.id);
          const [mouseX] = d3.pointer(e, g.node());
          const clickedSeq = Math.round(xScale.invert(mouseX));
          if (clickedSeq >= minSeq && clickedSeq <= effectiveMaxSeq) {
            setCurrentSequence(clickedSeq);
          }
        });

      const lastSeq = Math.max(...branchOnlyEvents.map(e => e.sequence));
      const branchLineX = xScale(lastSeq);

      // Continuous Fluid Energy Stream along horizontal branch line
      renderContinuousEnergyStream(
        g,
        "line",
        { x1: endX, y1: targetY, x2: branchLineX, y2: targetY },
        visual.color,
        `${b.id}-line`,
        b.id === branchId
      );

      // Invisible click hitbox for branch line
      g.append("line")
        .attr("x1", endX)
        .attr("y1", targetY)
        .attr("x2", branchLineX)
        .attr("y2", targetY)
        .attr("stroke", "transparent")
        .attr("stroke-width", 24)
        .attr("class", "cursor-pointer")
        .on("click", (e) => {
          e.stopPropagation();
          setBranchId(b.id);
          const [mouseX] = d3.pointer(e, g.node());
          const clickedSeq = Math.round(xScale.invert(mouseX));
          if (clickedSeq >= minSeq && clickedSeq <= effectiveMaxSeq) {
            setCurrentSequence(clickedSeq);
          }
        });
    });

    // 4. Knowledge Horizon vertical barrier positioned at the very top and extending to bottom
    const horizonSeqClamped = Math.max(minSeq, Math.min(currentSequence, effectiveMaxSeq));
    const horizonX = xScale(horizonSeqClamped);
    
    // Calculate topmost and bottom-most yOffsets among all branches
    const allYOffsets = Object.values(branchVisualMap).map(v => v.yOffset);
    const minYOffset = Math.min(...allYOffsets, 0); // Lowest numerical value = top-most visual position
    const maxYOffset = Math.max(...allYOffsets, 0);

    // Place HORIZON badge at the very top of the canvas viewport
    const topLimit = -centerY + 32;
    const badgeY = Math.min(topLimit, minYOffset - 85);
    const lineTopY = badgeY + 11;
    
    // Extend the line far below all branches and the canon baseline to the very bottom
    const bottomLimit = centerY - 28;
    const lineBottomY = Math.max(bottomLimit, maxYOffset + 85);

    const horizonGroup = g.append("g")
      .attr("class", "horizon-line")
      .attr("transform", `translate(${horizonX}, 0)`);

    // Ambient Laser Barrier Blur
    horizonGroup.append("line")
      .attr("y1", lineTopY)
      .attr("y2", lineBottomY)
      .attr("stroke", mainColor)
      .attr("stroke-width", 10)
      .attr("opacity", 0.35)
      .attr("filter", "url(#hyper-bloom)");

    // Core Laser Barrier Line
    horizonGroup.append("line")
      .attr("y1", lineTopY)
      .attr("y2", lineBottomY)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2.2)
      .style("filter", `drop-shadow(0 0 10px ${mainColor}) drop-shadow(0 0 20px ${mainColor})`);

    // Animated fast laser pulse traveling down the full vertical beam
    horizonGroup.append("line")
      .attr("y1", lineTopY)
      .attr("y2", lineBottomY)
      .attr("stroke", mainColor)
      .attr("stroke-width", 3)
      .attr("stroke-dasharray", "20 60")
      .attr("class", "laser-pulse-fast");

    // Top Horizon Badge Box
    horizonGroup.append("rect")
      .attr("x", -62)
      .attr("y", badgeY - 11)
      .attr("width", 124)
      .attr("height", 22)
      .attr("rx", 6)
      .attr("fill", isDarkMode ? "#09090b" : "#ffffff")
      .attr("stroke", mainColor)
      .attr("stroke-width", 2)
      .style("filter", `drop-shadow(0 0 14px ${mainColor})`);

    horizonGroup.append("text")
      .attr("x", 0)
      .attr("y", badgeY + 4)
      .attr("text-anchor", "middle")
      .attr("fill", mainColor)
      .attr("font-family", "monospace")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("letter-spacing", "0.5px")
      .text(`HORIZON: SEQ ${currentSequence}`);

    // Bottom decorative cyber beacon terminal pip
    horizonGroup.append("polygon")
      .attr("points", `0,${lineBottomY + 8} -5,${lineBottomY} 0,${lineBottomY - 4} 5,${lineBottomY}`)
      .attr("fill", mainColor)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1)
      .style("filter", `drop-shadow(0 0 8px ${mainColor})`);

    // 5. Draw Event Nodes with Shockwave Pulse Rings and Electric Glow
    interface NodeRenderItem {
      event: TimelineEvent;
      targetBranchId: string;
      yOffset: number;
      color: string;
      isFutureCanon: boolean;
      isActiveBranch: boolean;
    }

    const nodeRenderItems: NodeRenderItem[] = [];

    const sortedCanon = [...canonEvents].sort((a, b) => a.sequence - b.sequence);
    sortedCanon.forEach(ce => {
      const isFutureCanon = branchId !== "canon" && ce.sequence >= activeDivergenceSeq;
      nodeRenderItems.push({
        event: ce,
        targetBranchId: "canon",
        yOffset: 0,
        color: mainColor,
        isFutureCanon,
        isActiveBranch: branchId === "canon",
      });
    });

    allBranches.forEach((b) => {
      const visual = branchVisualMap[b.id];
      if (!visual) return;
      const bEvs = branchMap[b.id] || [];
      // STRICT FILTERING: Only render branch events at or after divergence sequence
      const branchEvents = bEvs.filter(e => e.sequence >= b.divergence_sequence);
      branchEvents.forEach(be => {
        nodeRenderItems.push({
          event: be,
          targetBranchId: b.id,
          yOffset: visual.yOffset,
          color: visual.color,
          isFutureCanon: false,
          isActiveBranch: b.id === branchId,
        });
      });
    });

    // Remove any parent/canon node render items on child branch lines if a divergent event exists at the same sequence beat
    const filteredNodeItems = nodeRenderItems.filter(item => {
      // Canon baseline always shows its canon nodes
      if (item.targetBranchId === "canon") return true;

      const bInfo = allBranches.find(b => b.id === item.targetBranchId);
      if (!bInfo) return true;

      // If this item represents a parent/canon event on a branch line, check if a divergent event exists at the same sequence on this branch
      const isParentEvent = item.event.branch_id !== item.targetBranchId;
      if (isParentEvent) {
        const hasDivergentEvent = nodeRenderItems.some(other =>
          other.targetBranchId === item.targetBranchId &&
          other.event.sequence === item.event.sequence &&
          other.event.branch_id === item.targetBranchId
        );
        if (hasDivergentEvent) return false; // Hide parent title & node on child branch line
      }
      return true;
    });

    const nodeGroups = g.selectAll(".event-node")
      .data(filteredNodeItems)
      .enter()
      .append("g")
      .attr("class", "event-node cursor-event")
      .attr("transform", d => `translate(${xScale(d.event.sequence)}, ${d.yOffset})`)
      .on("click", (e, d) => {
        e.stopPropagation();
        setBranchId(d.targetBranchId);
        setCurrentSequence(d.event.sequence);
        setSelectedEvent(d.event);
      });

    // Expanding Shockwave Pulse Ring for Selected Active Node
    nodeGroups.filter(d => d.event.sequence === currentSequence && d.isActiveBranch && !d.isFutureCanon)
      .append("circle")
      .attr("class", "active-shockwave")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("fill", "none")
      .attr("stroke", d => d.color)
      .style("filter", d => `drop-shadow(0 0 20px ${d.color}) drop-shadow(0 0 40px ${d.color})`);

    // Outer Neon Aura Circle
    nodeGroups.append("circle")
      .attr("r", d => d.event.sequence === currentSequence && d.isActiveBranch ? 20 : 13)
      .attr("fill", d => `${d.color}66`)
      .style("filter", d => `drop-shadow(0 0 15px ${d.color}) drop-shadow(0 0 30px ${d.color}) drop-shadow(0 0 45px ${d.color})`);

    // Core Node Circle
    nodeGroups.append("circle")
      .attr("r", d => d.event.sequence === currentSequence && d.isActiveBranch ? 13 : 9)
      .attr("fill", d => {
        if (d.isFutureCanon) return isDarkMode ? "#1f1f23" : "#e2e8f0";
        return d.event.sequence === currentSequence && d.isActiveBranch ? "#ffffff" : d.color;
      })
      .attr("stroke", d => d.color)
      .style("filter", d => `drop-shadow(0 0 12px ${d.color}) drop-shadow(0 0 24px #ffffff)`)
      .attr("opacity", d => d.isFutureCanon ? 0.35 : (d.event.sequence > currentSequence && !d.isActiveBranch ? 0.5 : 1));

    nodeGroups.append("text")
      .attr("y", 3)
      .attr("text-anchor", "middle")
      .attr("fill", d => {
        if (d.isFutureCanon) return isDarkMode ? "rgba(254, 240, 138, 0.5)" : "rgba(180, 83, 9, 0.6)";
        if (d.event.sequence <= currentSequence || d.isActiveBranch) return "#ffffff";
        return isDarkMode ? "#a1a1aa" : "#475569";
      })
      .attr("font-family", "monospace")
      .attr("font-size", "9px")
      .attr("font-weight", "bold")
      .text(d => d.event.sequence);

    // Event title labels: dynamically alternate top/bottom based on line yOffset to avoid overlap
    nodeGroups.append("text")
      .attr("y", (d) => {
        if (d.yOffset < 0) return -24; // Above line for upper branches
        if (d.yOffset > 0) return 32;  // Below line for lower branches
        return (d.event.sequence % 2 === 0 ? 32 : -24); // Alternate for main canon baseline
      })
      .attr("text-anchor", "middle")
      .attr("fill", d => {
        if (d.isFutureCanon) return isDarkMode ? "rgba(254, 240, 138, 0.45)" : "rgba(180, 83, 9, 0.5)";
        if (d.event.sequence === currentSequence && d.isActiveBranch) return isDarkMode ? "#ffffff" : "#0f172a";
        return isDarkMode ? "#f4f4f5" : "#0f172a";
      })
      .attr("font-family", "Candara, Optima, sans-serif")
      .attr("font-size", d => d.event.sequence === currentSequence && d.isActiveBranch ? "13px" : "11.5px")
      .attr("font-weight", d => d.event.sequence === currentSequence && d.isActiveBranch ? "bold" : "bold")
      .attr("opacity", d => d.isFutureCanon ? 0.45 : 1)
      .text(d => {
        const text = d.event.title || `Event ${d.event.sequence}`;
        return text.length > 22 ? text.substring(0, 22) + "…" : text;
      });
  };

  const renderNetworkView = (svg: d3.Selection<SVGGElement, unknown, null, undefined>, width: number, height: number) => {
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
      .attr("stroke", isDarkMode ? "#3f3f46" : "#cbd5e1")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(graphLinks)
      .enter().append("line")
      .attr("stroke-width", 1.5);

    const node = g.append("g")
      .selectAll("g")
      .data(graphNodes)
      .enter().append("g")
      .attr("class", d => d.type === "character" ? "cursor-character" : "cursor-event")
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
      .attr("stroke", isDarkMode ? "#ffffff" : "#0f172a")
      .attr("stroke-width", 1.5);

    node.append("text")
      .attr("dy", d => d.type === "character" ? 24 : 20)
      .attr("text-anchor", "middle")
      .attr("fill", isDarkMode ? "#f4f4f5" : "#0f172a")
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
    <div className="flex-1 min-h-0 w-full flex flex-col relative overflow-hidden bg-transparent">
      
      {/* Visualizer Controls Top Toolbar */}
      <div className={`flex-none px-6 py-3 border-b flex flex-wrap items-center justify-between gap-4 transition-colors z-20 ${
        isDarkMode 
          ? "border-white/10 bg-black/30 backdrop-blur-xl text-white shadow-md" 
          : "border-slate-200 bg-white/95 text-slate-900 shadow-sm"
      }`}>
        
        {/* Left: View Mode Toggle & Legend */}
        <div className="flex items-center gap-3">
          <div className={`flex border rounded-lg p-1 text-xs font-mono ${
            isDarkMode ? "bg-black/40 border-white/15" : "bg-slate-100 border-slate-300"
          }`}>
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                viewMode === "timeline"
                  ? (isDarkMode ? "bg-white/20 text-white font-bold border border-white/20" : "bg-slate-900 text-white font-bold")
                  : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")
              }`}
            >
              <Clock size={13} /> Chrono Timeline
            </button>
            <button
              onClick={() => setViewMode("network")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                viewMode === "network"
                  ? (isDarkMode ? "bg-white/20 text-white font-bold border border-white/20" : "bg-slate-900 text-white font-bold")
                  : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")
              }`}
            >
              <Layers size={13} /> Entity Network
            </button>
          </div>
        </div>

        {/* Right: Timeline Scrubber Slider */}
        <div className={`flex items-center gap-3 border px-3 py-1.5 rounded-lg ${
          isDarkMode ? "bg-black/40 border-white/15 text-slate-300" : "bg-slate-100 border-slate-300 text-slate-800"
        }`}>
          <Sliders size={14} className="text-canon" />
          <span className="text-xs font-mono">Sequence:</span>
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
      <div ref={containerRef} className="flex-1 w-full min-h-[300px] relative overflow-hidden bg-transparent cursor-timeline">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-10 font-mono text-xs text-primary-muted">
            Mapping narrative coordinates...
          </div>
        )}
        <svg ref={svgRef} className="w-full h-full block" />
      </div>

      {/* Event Details Drawer / Inspector Card */}
      {selectedEvent && (
        <div className={`flex-none p-3.5 border-t flex flex-col gap-1.5 transition-colors z-20 ${
          isDarkMode ? "border-white/10 bg-black/40 backdrop-blur-xl text-white shadow-lg" : "border-slate-200 bg-white/95 text-slate-900 shadow-md"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${
                selectedEvent.canonical
                  ? (isDarkMode ? 'bg-canon/10 text-canon border-canon/30' : 'bg-amber-100 text-amber-800 border-amber-300')
                  : (isDarkMode ? 'bg-generated/10 text-generated border-generated/30' : 'bg-purple-100 text-purple-800 border-purple-300')
              }`}>
                SEQ {selectedEvent.sequence} • {selectedEvent.canonical ? 'CANON BEAT' : 'DIVERGENT OUTCOME'}
              </span>
              <h3 className="font-serif font-bold text-xs sm:text-sm truncate">{selectedEvent.title}</h3>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {selectedEvent.participants.length > 0 && (
                <div className={`hidden md:flex items-center gap-1.5 text-xs font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  <Users size={12} />
                  <span className="truncate max-w-[220px]">{selectedEvent.participants.map(p => p.replace(/_/g, " ")).join(", ")}</span>
                </div>
              )}
              <button
                onClick={() => setShowEventDrawer(!showEventDrawer)}
                className={`p-1 rounded text-slate-400 hover:text-white transition-colors ${
                  isDarkMode ? "hover:bg-white/10" : "hover:bg-slate-200"
                }`}
                title={showEventDrawer ? "Collapse description" : "Expand description"}
              >
                {showEventDrawer ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
          </div>

          {showEventDrawer && (
            <p className={`text-xs font-serif leading-relaxed line-clamp-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              {selectedEvent.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

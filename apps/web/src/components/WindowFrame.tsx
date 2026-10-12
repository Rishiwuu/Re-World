"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppContext } from "./AppProvider";
import { Minus, Square, Copy, X } from "lucide-react";

export interface WindowState {
  id: string;
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}

interface WindowProps {
  win: WindowState;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onFocus: () => void;
  onUpdateBounds: (pos: { x: number; y: number }, size: { width: number; height: number }) => void;
  children: React.ReactNode;
}

export function WindowFrame({
  win,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  onUpdateBounds,
  children,
}: WindowProps) {
  const { isDarkMode } = useAppContext();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startW: number; startH: number; startX: number; startY: number }>({ mouseX: 0, mouseY: 0, startW: 0, startH: 0, startX: 0, startY: 0 });

  // Handle Dragging
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if (win.isMaximized) return;
    if ((e.target as HTMLElement).closest("button")) return;
    onFocus();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: win.position.x,
      startY: win.position.y,
    };
  };

  // Handle Resizing Mouse Down
  const handleMouseDownResize = (direction: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (win.isMaximized) return;
    onFocus();
    setIsResizing(direction);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: win.size.width,
      startH: win.size.height,
      startX: win.position.x,
      startY: win.position.y,
    };
  };

  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        if (isDragging) {
          const dx = e.clientX - dragStartRef.current.mouseX;
          const dy = e.clientY - dragStartRef.current.mouseY;
          const newX = Math.max(10, dragStartRef.current.startX + dx);
          const newY = Math.max(10, dragStartRef.current.startY + dy);
          onUpdateBounds({ x: newX, y: newY }, win.size);
        } else if (isResizing) {
          const dx = e.clientX - resizeStartRef.current.mouseX;
          const dy = e.clientY - resizeStartRef.current.mouseY;
          let newW = resizeStartRef.current.startW;
          let newH = resizeStartRef.current.startH;
          let newX = resizeStartRef.current.startX;
          let newY = resizeStartRef.current.startY;

          const MIN_W = 280;
          const MIN_H = 180;

          // East (Right)
          if (isResizing.includes("e")) {
            newW = Math.max(MIN_W, resizeStartRef.current.startW + dx);
          }
          // South (Bottom)
          if (isResizing.includes("s")) {
            newH = Math.max(MIN_H, resizeStartRef.current.startH + dy);
          }
          // West (Left)
          if (isResizing.includes("w")) {
            const possibleW = resizeStartRef.current.startW - dx;
            if (possibleW >= MIN_W) {
              newW = possibleW;
              newX = resizeStartRef.current.startX + dx;
            } else {
              newW = MIN_W;
              newX = resizeStartRef.current.startX + (resizeStartRef.current.startW - MIN_W);
            }
          }
          // North (Top)
          if (isResizing.includes("n")) {
            const possibleH = resizeStartRef.current.startH - dy;
            if (possibleH >= MIN_H) {
              newH = possibleH;
              newY = resizeStartRef.current.startY + dy;
            } else {
              newH = MIN_H;
              newY = resizeStartRef.current.startY + (resizeStartRef.current.startH - MIN_H);
            }
          }

          onUpdateBounds({ x: newX, y: newY }, { width: newW, height: newH });
        }
      });
    };

    const handleMouseUp = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setIsDragging(false);
      setIsResizing(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove, { passive: true });
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, win.size, onUpdateBounds]);

  if (!win.isOpen || win.isMinimized) return null;

  const style: React.CSSProperties = win.isMaximized
    ? {
        position: "absolute",
        top: "60px",
        left: "10px",
        right: "10px",
        bottom: "60px",
        zIndex: win.zIndex,
      }
    : {
        position: "absolute",
        top: `${win.position.y}px`,
        left: `${win.position.x}px`,
        width: `${win.size.width}px`,
        height: `${win.size.height}px`,
        zIndex: win.zIndex,
        willChange: isDragging || isResizing ? "top, left, width, height" : "auto",
      };

  return (
    <div
      onClick={onFocus}
      style={style}
      className={`group/win flex flex-col rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl backdrop-saturate-150 select-none ring-1 ring-inset ${
        isDragging ? "opacity-95 shadow-[0_30px_70px_rgba(0,0,0,0.8)]" : ""
      } ${
        isDarkMode
          ? "bg-[#080914]/40 hover:bg-[#080914]/50 border-white/20 text-white shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-white/15"
          : "bg-white/45 hover:bg-white/55 border-white/70 text-slate-900 shadow-[0_20px_45px_rgba(0,0,0,0.1)] ring-black/5"
      }`}
    >
      {/* Title bar / Window Header */}
      <div
        onMouseDown={handleMouseDownHeader}
        className={`flex-none px-3.5 py-2.5 border-b flex items-center justify-between cursor-grab active:cursor-grabbing transition-colors ${
          isDarkMode
            ? "border-white/10 bg-white/[0.08] text-slate-200 hover:bg-white/[0.12]"
            : "border-slate-200/60 bg-white/50 text-slate-800 hover:bg-white/70"
        }`}
      >
        {/* Left Icon & Title */}
        <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
          <span className="shrink-0 drop-shadow-sm">{win.icon}</span>
          <span className="font-serif font-bold text-xs truncate tracking-wide text-foreground">{win.title}</span>
        </div>

        {/* Right Window Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            className={`p-1 rounded-md transition-colors ${
              isDarkMode ? "hover:bg-white/15 text-slate-400 hover:text-white" : "hover:bg-slate-300 text-slate-600 hover:text-slate-900"
            }`}
            title="Minimize"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMaximize();
            }}
            className={`p-1 rounded-md transition-colors ${
              isDarkMode ? "hover:bg-white/15 text-slate-400 hover:text-white" : "hover:bg-slate-300 text-slate-600 hover:text-slate-900"
            }`}
            title={win.isMaximized ? "Restore Window" : "Maximize Window"}
          >
            {win.isMaximized ? <Copy size={12} /> : <Square size={12} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 rounded-md hover:bg-red-500/90 hover:text-white text-slate-400 transition-colors"
            title="Close Window"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col bg-transparent">{children}</div>

      {/* Resize Handles (8 directions with generous hitboxes) */}
      {!win.isMaximized && (
        <>
          {/* Edge Handles */}
          <div onMouseDown={(e) => handleMouseDownResize("n", e)} className="absolute -top-1 left-3 right-3 h-3 cursor-ns-resize z-50 hover:bg-amber-500/25 active:bg-amber-500/40" />
          <div onMouseDown={(e) => handleMouseDownResize("s", e)} className="absolute -bottom-1 left-3 right-3 h-3 cursor-ns-resize z-50 hover:bg-amber-500/25 active:bg-amber-500/40" />
          <div onMouseDown={(e) => handleMouseDownResize("w", e)} className="absolute -left-1 top-3 bottom-3 w-3 cursor-ew-resize z-50 hover:bg-amber-500/25 active:bg-amber-500/40" />
          <div onMouseDown={(e) => handleMouseDownResize("e", e)} className="absolute -right-1 top-3 bottom-3 w-3 cursor-ew-resize z-50 hover:bg-amber-500/25 active:bg-amber-500/40" />
          
          {/* Corner Handles */}
          <div onMouseDown={(e) => handleMouseDownResize("nw", e)} className="absolute -top-1 -left-1 w-5 h-5 cursor-nwse-resize z-50 hover:bg-amber-500/35 active:bg-amber-500/50 rounded-tl" />
          <div onMouseDown={(e) => handleMouseDownResize("ne", e)} className="absolute -top-1 -right-1 w-5 h-5 cursor-nesw-resize z-50 hover:bg-amber-500/35 active:bg-amber-500/50 rounded-tr" />
          <div onMouseDown={(e) => handleMouseDownResize("sw", e)} className="absolute -bottom-1 -left-1 w-5 h-5 cursor-nesw-resize z-50 hover:bg-amber-500/35 active:bg-amber-500/50 rounded-bl" />
          <div onMouseDown={(e) => handleMouseDownResize("se", e)} className="absolute -bottom-1 -right-1 w-5 h-5 cursor-nwse-resize z-50 hover:bg-amber-500/35 active:bg-amber-500/50 rounded-br" />
        </>
      )}

      {/* Overlay to prevent iframe/child interaction during drag or resize */}
      {(isDragging || isResizing) && (
        <div
          className={`fixed inset-0 z-[9999] ${
            isDragging
              ? "cursor-grabbing"
              : isResizing === "n" || isResizing === "s"
              ? "cursor-ns-resize"
              : isResizing === "e" || isResizing === "w"
              ? "cursor-ew-resize"
              : isResizing === "nw" || isResizing === "se"
              ? "cursor-nwse-resize"
              : "cursor-nesw-resize"
          }`}
        />
      )}
    </div>
  );
}

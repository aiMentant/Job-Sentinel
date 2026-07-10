"use client";

import React from 'react';
import { Cpu } from "lucide-react";

export default function Loading() {
  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label="Loading page content"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/50 backdrop-blur-md"
    >
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-card-border bg-card/85 shadow-2xl animate-in fade-in duration-300">
        <div className="relative w-16 h-16 flex items-center justify-center">
          {/* Inner pulsing circle */}
          <div className="absolute inset-2 rounded-full bg-indigo-600/20 dark:bg-indigo-400/20 animate-pulse" />
          {/* Spinning gradient ring */}
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-600 dark:border-t-indigo-400 animate-spin" />
          <Cpu className="w-6 h-6 text-indigo-600 dark:text-indigo-400 relative z-10 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">Syncing Sentinel Intelligence...</p>
          <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest mt-1">Autonomous Agent Routing</p>
        </div>
      </div>
    </div>
  );
}


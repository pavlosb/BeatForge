/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Upload, 
  Music, 
  Drum, 
  Volume2, 
  VolumeX, 
  Activity,
  ChevronRight,
  Settings2
} from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import { AudioEngine, DEFAULT_PATTERNS, BeatPattern } from './lib/audioEngine';

export default function App() {
  const [engine] = useState(() => new AudioEngine());
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasFile, setHasFile] = useState(false);
  const [fileName, setFileName] = useState("");
  const [trackVolume, setTrackVolume] = useState(0.8);
  const [beatVolume, setBeatVolume] = useState(0.5);
  const [selectedPattern, setSelectedPattern] = useState(DEFAULT_PATTERNS[0]);
  const [isHovering, setIsHovering] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const drawVisualizer = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = engine.getAnalyser();
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 1.5;
        
        // Indigo theme gradient
        const intensity = (dataArray[i] / 255) * 100;
        ctx.fillStyle = `hsla(234, 89%, ${50 + intensity / 2}%, 0.8)`;
        
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
  }, [engine]);

  useEffect(() => {
    drawVisualizer();
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawVisualizer]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setFileName(file.name);
      await engine.loadTrack(file);
      setHasFile(true);
    }
  };

  const togglePlayback = () => {
    engine.toggle();
    setIsPlaying(engine.getState().isPlaying);
  };

  const changePattern = (pattern: BeatPattern) => {
    setSelectedPattern(pattern);
    engine.setPattern(pattern);
  };

  const updateTrackVolume = (val: number) => {
    setTrackVolume(val);
    engine.setTrackVolume(val);
  };

  const updateBeatVolume = (val: number) => {
    setBeatVolume(val);
    engine.setBeatVolume(val);
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <nav className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900 shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">B</div>
            <span className="font-bold tracking-tight text-lg">BeatForge AI</span>
          </div>
          <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-400">
            <span className="text-white underline underline-offset-8 decoration-indigo-500">Editor</span>
            <span className="hover:text-slate-200 transition-colors cursor-pointer">Mixer</span>
            <span className="hover:text-slate-200 transition-colors cursor-pointer">Library</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button className="hidden sm:block px-4 py-1.5 text-xs font-semibold bg-slate-800 rounded border border-slate-700 hover:bg-slate-700 transition-all active:scale-95">
            Export MP3
          </button>
          <button className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all active:scale-95">
            Save Project
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-64 border-r border-slate-800 bg-slate-900 p-4 flex flex-col gap-6 shrink-0 hidden lg:flex">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 block">Project Stats</label>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400 flex items-center gap-2">
                  <Activity className="w-3 h-3" /> Tempo
                </span>
                <span className="font-mono text-indigo-400">{selectedPattern.bpm} BPM</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Key</span>
                <span className="font-mono text-indigo-400">Fixed</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Time Sig</span>
                <span className="font-mono text-indigo-400">4 / 4</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-800"></div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 block">Audio Layers</label>
            <div className="p-2 space-y-1 overflow-y-auto max-h-[300px]">
              {hasFile ? (
                <div className="p-3 bg-slate-800 rounded border border-indigo-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold truncate max-w-[120px]">{fileName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">03:42</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-500" 
                      initial={{ width: 0 }}
                      animate={{ width: isPlaying ? '100%' : '30%' }}
                      transition={{ duration: isPlaying ? 180 : 0.5, ease: "linear" }}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center text-center gap-2">
                  <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center">
                    <Music className="w-4 h-4 text-slate-500" />
                  </div>
                  <p className="text-[10px] text-slate-400">Upload a song to Layer</p>
                </div>
              )}

              <div className={`p-3 bg-slate-800/40 rounded border ${isPlaying ? 'border-indigo-400/50' : 'border-slate-700'} mt-2`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400">{selectedPattern.name}</span>
                  <span className={`text-[10px] ${isPlaying ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {isPlaying ? 'Active' : 'Standby'}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full w-1/2 bg-slate-500"></div>
                </div>
              </div>
            </div>
          </div>

          <label className="mt-auto block">
            <div className="p-4 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center text-center gap-2 group hover:border-indigo-500/50 transition-colors cursor-pointer">
              <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center group-hover:bg-indigo-600/20 transition-colors">
                <span className="text-xl">+</span>
              </div>
              <p className="text-[11px] text-slate-400 group-hover:text-slate-300">Drop another audio file or sample here</p>
            </div>
            <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />
          </label>
        </aside>

        {/* Main Editor Area */}
        <main className="flex-1 bg-slate-950 p-6 flex flex-col gap-6 overflow-y-auto">
          
          {/* Waveform Visualizer */}
          <div className="h-48 bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden shrink-0">
            <canvas 
              ref={canvasRef} 
              width={1000} 
              height={200} 
              className="absolute inset-0 w-full h-full object-cover opacity-40"
            />
            
            {!hasFile && (
              <div className="absolute inset-0 flex items-center justify-center">
                <button 
                  onClick={() => document.querySelector('input[type="file"]')?.dispatchEvent(new MouseEvent('click'))}
                  className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-lg text-sm font-bold shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
                >
                  LOAD INITIAL AUDIO
                </button>
              </div>
            )}

            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white shadow-[0_0_10px_white] z-10"></div>
            <div className="absolute bottom-3 left-3 bg-slate-800/80 px-2 py-1 rounded text-[10px] font-mono text-slate-300">
              00:42.500 / {hasFile ? '03:42.000' : '--:--.---'}
            </div>
          </div>

          {/* Step Sequencer / Patterns Grid */}
          <div className="flex-1 min-h-[400px] bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden">
            <div className="h-10 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-400 tracking-wider">BEAT SEQUENCER</span>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></div>
                  <span className="text-[10px] text-slate-500 uppercase">{isPlaying ? 'Live Sync Active' : 'Idle'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 p-6 flex gap-8 overflow-hidden">
              {/* Pattern Selector */}
              <div className="w-1/3 flex flex-col gap-2 overflow-y-auto pr-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase px-2 mb-2">Preset Patterns</label>
                {DEFAULT_PATTERNS.map((pattern) => (
                  <button
                    key={pattern.name}
                    onClick={() => changePattern(pattern)}
                    className={`text-left p-4 rounded-xl flex items-center justify-between transition-all group ${
                      selectedPattern.name === pattern.name 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                      : 'hover:bg-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="truncate">
                      <p className={`text-sm font-bold ${selectedPattern.name === pattern.name ? 'text-white' : 'text-slate-200'}`}>
                        {pattern.name}
                      </p>
                      <p className="text-[10px] font-mono opacity-60 uppercase">{pattern.bpm} BPM</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1 ${
                      selectedPattern.name === pattern.name ? 'text-white' : 'text-slate-600'
                    }`} />
                  </button>
                ))}
              </div>

              {/* Rows Visualization */}
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex flex-col gap-4 p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                  {/* Kick Row */}
                  <div className="flex items-center gap-4">
                    <span className="w-16 text-[10px] font-bold text-slate-500">KICK</span>
                    <div className="flex-1 grid grid-cols-16 gap-1.5">
                      {selectedPattern.steps.k.map((on, i) => (
                        <div key={i} className={`h-10 rounded-sm border ${on ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_8px_rgba(79,70,229,0.4)]' : 'bg-slate-800 border-transparent'}`} />
                      ))}
                    </div>
                  </div>
                  {/* Snare Row */}
                  <div className="flex items-center gap-4">
                    <span className="w-16 text-[10px] font-bold text-slate-500">SNARE</span>
                    <div className="flex-1 grid grid-cols-16 gap-1.5">
                      {selectedPattern.steps.s.map((on, i) => (
                        <div key={i} className={`h-10 rounded-sm border ${on ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_8px_rgba(79,70,229,0.4)]' : 'bg-slate-800 border-transparent'}`} />
                      ))}
                    </div>
                  </div>
                  {/* HiHat Row */}
                  <div className="flex items-center gap-4">
                    <span className="w-16 text-[10px] font-bold text-slate-500">HI-HAT</span>
                    <div className="flex-1 grid grid-cols-16 gap-1.5">
                      {selectedPattern.steps.h.map((on, i) => (
                        <div key={i} className={`h-10 rounded-sm border ${on ? 'bg-slate-700 border-slate-500' : 'bg-slate-800 border-transparent'}`} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Mixer Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Track Master</span>
                      <span className="text-xs font-mono text-indigo-400">{Math.round(trackVolume * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.01" value={trackVolume}
                      onChange={(e) => updateTrackVolume(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Beat Layer</span>
                      <span className="text-xs font-mono text-indigo-400">{Math.round(beatVolume * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.01" value={beatVolume}
                      onChange={(e) => updateBeatVolume(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Playback Controls (Sticky-ish bottom bar) */}
          <div className="h-24 bg-slate-900 rounded-xl border border-slate-800 flex items-center px-8 gap-8 md:gap-12 shadow-2xl shrink-0">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => {
                  engine.stop();
                  setIsPlaying(false);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <div className="w-8 h-8 flex items-center justify-center">⏮</div>
              </button>
              
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={togglePlayback}
                className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-600/40 hover:bg-indigo-500 transition-all"
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
              </motion.button>

              <button className="text-slate-400 hover:text-white transition-colors">
                <div className="w-8 h-8 flex items-center justify-center">⏭</div>
              </button>
            </div>
            
            <div className="flex-1 flex flex-col gap-2 max-w-md">
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>MASTER OUTPUT</span>
                <span>82%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full w-[82%] bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full"></div>
              </div>
            </div>

            <div className="flex items-center gap-4 border-l border-slate-800 pl-8">
              <div className="text-right hidden sm:block">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Metronome</div>
                <div className="text-xs text-indigo-400 font-mono">OFF</div>
              </div>
              <button className="w-10 h-10 bg-slate-800 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-colors">
                <Settings2 className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

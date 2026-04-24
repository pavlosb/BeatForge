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
  Settings2,
  Plus,
  Trash2,
  Timer,
  Clock,
  Layers
} from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import { AudioEngine, DEFAULT_PATTERNS, BeatPattern, TimelineEvent } from './lib/audioEngine';

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function App() {
  const [engine] = useState(() => new AudioEngine());
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasFile, setHasFile] = useState(false);
  const [fileName, setFileName] = useState("");
  const [trackVolume, setTrackVolume] = useState(0.8);
  const [beatVolume, setBeatVolume] = useState(0.5);
  const [patterns, setPatterns] = useState<BeatPattern[]>(DEFAULT_PATTERNS);
  const [selectedPattern, setSelectedPattern] = useState(DEFAULT_PATTERNS[0]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [bpm, setBpm] = useState(DEFAULT_PATTERNS[0].bpm.toString());
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // Sync engine state
  useEffect(() => {
    const timer = setInterval(() => {
      const state = engine.getState();
      setIsPlaying(state.isPlaying);
      setCurrentTime(state.currentTime);
      setDuration(state.duration);
    }, 100);
    return () => clearInterval(timer);
  }, [engine]);

  useEffect(() => {
    engine.setPatterns(patterns);
  }, [patterns, engine]);

  useEffect(() => {
    engine.setTimeline(timeline);
  }, [timeline, engine]);

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

      // Draw Beat Grid
      if (hasFile && duration > 0) {
        const bpmVal = parseFloat(bpm);
        if (!isNaN(bpmVal)) {
          const secondsPerBeat = 60 / bpmVal;
          const pixelPerSecond = canvas.width / duration;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 1;

          for (let t = 0; t < duration; t += secondsPerBeat) {
            const beatX = t * pixelPerSecond;
            ctx.beginPath();
            ctx.moveTo(beatX, 0);
            ctx.lineTo(beatX, canvas.height);
            ctx.stroke();
          }
        }
      }
    };
    draw();
  }, [engine, bpm, hasFile, duration]);

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
      
      // Auto analysis
      setIsAnalyzing(true);
      const detectedBpm = await engine.detectBPM();
      if (detectedBpm) {
        handleBpmChange(detectedBpm.toString());
      }
      setIsAnalyzing(false);
    }
  };

  const togglePlayback = () => {
    engine.toggle();
    const state = engine.getState();
    setIsPlaying(state.isPlaying);
  };

  const changePattern = (pattern: BeatPattern) => {
    setSelectedPattern(pattern);
    setBpm(pattern.bpm.toString());
    engine.setPattern(pattern);
  };

  const toggleStep = (instrument: 'k' | 's' | 'h', step: number) => {
    engine.toggleStep(instrument, step);
    // Get fresh state from engine to ensure React recognizes the change
    const state = engine.getState();
    const updatedPattern = { ...state.currentPattern };
    setSelectedPattern(updatedPattern);
    setPatterns(prev => prev.map(p => p.id === updatedPattern.id ? updatedPattern : p));
  };

  const handleBpmChange = (val: string) => {
    setBpm(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      engine.setBPM(num);
      setSelectedPattern(prev => ({ ...prev, bpm: num }));
      setPatterns(prev => prev.map(p => p.id === selectedPattern.id ? { ...p, bpm: num } : p));
    }
  };

  const addNewPattern = () => {
    const newPattern: BeatPattern = {
      id: generateId(),
      name: `Pattern ${patterns.length + 1}`,
      bpm: parseFloat(bpm) || 120,
      steps: {
        k: Array(16).fill(false),
        s: Array(16).fill(false),
        h: Array(16).fill(false),
      }
    };
    setPatterns([...patterns, newPattern]);
    changePattern(newPattern);
  };

  const updatePatternName = (id: string, name: string) => {
    setPatterns(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const deletePattern = (id: string) => {
    if (patterns.length <= 1) return;
    const newPatterns = patterns.filter(p => p.id !== id);
    setPatterns(newPatterns);
    if (selectedPattern.id === id) {
      changePattern(newPatterns[0]);
    }
  };

  const addToTimeline = (patternId: string) => {
    const newEvent: TimelineEvent = {
      id: generateId(),
      patternId,
      startTime: currentTime,
      endTime: Math.min(currentTime + 5, duration || currentTime + 5)
    };
    setTimeline([...timeline, newEvent]);
  };

  const removeTimelineEvent = (id: string) => {
    setTimeline(prev => prev.filter(e => e.id !== id));
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pos = x / rect.width;
    const seekTime = pos * duration;
    engine.seek(seekTime);
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
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      step="0.1"
                      value={bpm}
                      onChange={(e) => handleBpmChange(e.target.value)}
                      className="bg-slate-800 border-none text-indigo-400 font-mono text-right w-16 focus:ring-0 focus:outline-none rounded px-1"
                    />
                    <span className="text-[10px] text-slate-500">BPM</span>
                  </div>
                  <input 
                    type="range" min="40" max="220" step="0.1" value={bpm}
                    onChange={(e) => handleBpmChange(e.target.value)}
                    className="w-24 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                  />
                  {isAnalyzing && (
                    <span className="text-[8px] text-indigo-500 animate-pulse uppercase font-bold">Analyzing...</span>
                  )}
                </div>
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
          
          {/* Timeline View */}
          <div className="h-24 bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden shrink-0">
            <div className="h-6 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-950/30">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Clock className="w-2 h-2" /> Song Timeline
              </span>
              <span className="text-[9px] font-mono text-slate-500 uppercase">
                {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(2).padStart(5, '0')} / 
                {Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}
              </span>
            </div>
            <div 
              ref={timelineRef}
              className="flex-1 relative cursor-crosshair group"
              onClick={handleTimelineClick}
            >
              {/* Playhead */}
              {duration > 0 && (
                <div 
                  className="absolute top-0 bottom-0 w-px bg-white z-20 shadow-[0_0_8px_white]"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                />
              )}
              
              {/* Timeline Events */}
              {timeline.map(event => (
                <div 
                  key={event.id}
                  className="absolute top-1 bottom-1 bg-indigo-500/40 border border-indigo-400/50 rounded p-1 overflow-hidden flex items-center justify-between group/event"
                  style={{ 
                    left: `${(event.startTime / duration) * 100}%`,
                    width: `${((event.endTime - event.startTime) / duration) * 100}%`
                  }}
                >
                  <span className="text-[8px] font-bold text-indigo-100 truncate whitespace-nowrap">
                    {patterns.find(p => p.id === event.patternId)?.name}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeTimelineEvent(event.id); }}
                    className="opacity-0 group-hover/event:opacity-100 hover:text-red-400 transition-opacity"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}

              {/* Empty background with grid */}
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="h-full w-full" style={{ backgroundSize: '20px 100%', backgroundImage: 'linear-gradient(90deg, #fff 1px, transparent 0)' }}></div>
              </div>
            </div>
          </div>

          {/* Waveform Visualizer */}
          <div className="h-32 bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden shrink-0 cursor-pointer" onClick={handleTimelineClick}>
            <canvas 
              ref={canvasRef} 
              width={1000} 
              height={200} 
              className="absolute inset-0 w-full h-full object-cover opacity-40"
            />
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full h-px bg-white/10"></div>
            </div>
            
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

            <div className="absolute bottom-3 left-3 bg-slate-800/80 px-2 py-1 rounded text-[10px] font-mono text-slate-300">
              {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(3).padStart(6, '0')} / {duration ? `${Math.floor(duration / 60)}:${(duration % 60).toFixed(0).padStart(2, '0')}` : '--:--.---'}
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
                <div className="flex items-center justify-between px-2 mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Presets & Memory</label>
                  <button 
                    onClick={addNewPattern}
                    className="w-5 h-5 bg-slate-800 hover:bg-indigo-600 rounded flex items-center justify-center transition-colors group/add"
                  >
                    <Plus className="w-3 h-3 text-slate-400 group-hover/add:text-white" />
                  </button>
                </div>
                {patterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    className={`group relative rounded-xl transition-all ${
                      selectedPattern.id === pattern.id 
                      ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20' 
                      : 'hover:bg-slate-800 bg-slate-900/40'
                    }`}
                  >
                    <div className="w-full p-4 flex items-center justify-between">
                      <button
                        onClick={() => changePattern(pattern)}
                        className="truncate flex-1 text-left group/name focus:outline-none"
                      >
                        <input 
                          type="text"
                          value={pattern.name}
                          onChange={(e) => updatePatternName(pattern.id, e.target.value)}
                          className={`bg-transparent border-none p-0 text-sm font-bold w-full focus:ring-0 cursor-text ${
                            selectedPattern.id === pattern.id ? 'text-white' : 'text-slate-200'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <p className={`text-[10px] font-mono opacity-60 uppercase ${
                          selectedPattern.id === pattern.id ? 'text-indigo-100' : 'text-slate-500'
                        }`}>
                          {pattern.bpm} BPM
                        </p>
                      </button>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); addToTimeline(pattern.id); }}
                          className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 ${
                            selectedPattern.id === pattern.id ? 'text-white' : 'text-slate-400'
                          }`}
                          title="Add to Timeline"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deletePattern(pattern.id); }}
                          className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 hover:text-red-400 ${
                            selectedPattern.id === pattern.id ? 'text-white' : 'text-slate-400'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rows Visualization */}
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex flex-col gap-4 p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                  {/* Kick Row */}
                  <div className="flex items-center gap-4">
                    <span className="w-16 text-[10px] font-bold text-slate-500">KICK</span>
                    <div className="flex-1 grid grid-cols-[repeat(16,1fr)] gap-1">
                      {selectedPattern.steps.k.map((on, i) => (
                        <button 
                          key={i} 
                          onClick={() => toggleStep('k', i)}
                          className={`h-8 rounded-[2px] border transition-all ${on ? 'bg-indigo-500 border-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-800 border-transparent hover:bg-slate-700'}`} 
                        />
                      ))}
                    </div>
                  </div>
                  {/* Snare Row */}
                  <div className="flex items-center gap-4">
                    <span className="w-16 text-[10px] font-bold text-slate-500">SNARE</span>
                    <div className="flex-1 grid grid-cols-[repeat(16,1fr)] gap-1">
                      {selectedPattern.steps.s.map((on, i) => (
                        <button 
                          key={i} 
                          onClick={() => toggleStep('s', i)}
                          className={`h-8 rounded-[2px] border transition-all ${on ? 'bg-indigo-400 border-indigo-200 shadow-[0_0_10px_rgba(129,140,248,0.5)]' : 'bg-slate-800 border-transparent hover:bg-slate-700'}`} 
                        />
                      ))}
                    </div>
                  </div>
                  {/* HiHat Row */}
                  <div className="flex items-center gap-4">
                    <span className="w-16 text-[10px] font-bold text-slate-500">HI-HAT</span>
                    <div className="flex-1 grid grid-cols-[repeat(16,1fr)] gap-1">
                      {selectedPattern.steps.h.map((on, i) => (
                        <button 
                          key={i} 
                          onClick={() => toggleStep('h', i)}
                          className={`h-8 rounded-[2px] border transition-all ${on ? 'bg-slate-400 border-slate-200 shadow-[0_0_10px_rgba(148,163,184,0.4)]' : 'bg-slate-800 border-transparent hover:bg-slate-700'}`} 
                        />
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
                onClick={() => engine.seek(0)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <div className="w-8 h-8 flex items-center justify-center font-bold">⏮</div>
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

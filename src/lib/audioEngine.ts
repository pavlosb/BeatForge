/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { analyze } from 'web-audio-beat-detector';

export interface BeatPattern {
  id: string;
  name: string;
  bpm: number;
  steps: {
    k: boolean[];
    s: boolean[];
    h: boolean[];
  };
}

export interface TimelineEvent {
  id: string;
  startTime: number;
  endTime: number;
  patternId: string;
}

export const DEFAULT_PATTERNS: BeatPattern[] = [
  {
    id: "p1",
    name: "Classic 4/4",
    bpm: 120,
    steps: {
      k: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
      s: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
      h: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
    },
  },
  {
    id: "p2",
    name: "Hip Hop",
    bpm: 90,
    steps: {
      k: [true, false, false, true, false, false, false, false, true, false, true, false, false, false, false, false],
      s: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
      h: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, true],
    },
  },
  {
    id: "p3",
    name: "Techno",
    bpm: 128,
    steps: {
      k: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
      s: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
      h: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
    },
  },
];

export class AudioEngine {
  private ctx: AudioContext;
  private trackBuffer: AudioBuffer | null = null;
  private trackSource: AudioBufferSourceNode | null = null;
  private trackGain: GainNode;
  private beatGain: GainNode;
  private masterGain: GainNode;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private patterns: BeatPattern[] = [...DEFAULT_PATTERNS];
  private currentPattern: BeatPattern = DEFAULT_PATTERNS[0];
  private timeline: TimelineEvent[] = [];
  private nextStepTime: number = 0;
  private currentStep: number = 0;
  private schedulerTimer: number | null = null;
  private analyzer: AnalyserNode;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.trackGain = this.ctx.createGain();
    this.beatGain = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();
    this.analyzer = this.ctx.createAnalyser();

    this.trackGain.connect(this.masterGain);
    this.beatGain.connect(this.masterGain);
    this.masterGain.connect(this.analyzer);
    this.analyzer.connect(this.ctx.destination);

    this.masterGain.gain.value = 0.8;
  }

  async loadTrack(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    this.trackBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    return this.trackBuffer;
  }

  async detectBPM(): Promise<number> {
    if (!this.trackBuffer) return 0;
    try {
      const bpm = await analyze(this.trackBuffer);
      return Math.round(bpm * 10) / 10;
    } catch (e) {
      console.error("BPM detection failed", e);
      return 0;
    }
  }

  setPatterns(patterns: BeatPattern[]) {
    this.patterns = patterns;
  }

  setTimeline(timeline: TimelineEvent[]) {
    this.timeline = timeline;
  }

  setPattern(pattern: BeatPattern) {
    this.currentPattern = JSON.parse(JSON.stringify(pattern)); // Deep copy to allow local modifications
  }

  setBPM(bpm: number) {
    this.currentPattern.bpm = bpm;
  }

  toggleStep(instrument: 'k' | 's' | 'h', step: number) {
    this.currentPattern.steps[instrument][step] = !this.currentPattern.steps[instrument][step];
  }

  setTrackVolume(val: number) {
    this.trackGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
  }

  setBeatVolume(val: number) {
    this.beatGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
  }

  getAnalyser() {
    return this.analyzer;
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.play();
    }
  }

  public play(offset?: number) {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.trackBuffer) {
      if (this.trackSource) {
        this.trackSource.stop();
        this.trackSource = null;
      }
      this.trackSource = this.ctx.createBufferSource();
      this.trackSource.buffer = this.trackBuffer;
      this.trackSource.connect(this.trackGain);
      
      const playPos = offset !== undefined ? (offset % this.trackBuffer.duration) : (this.pauseTime % this.trackBuffer.duration);
      this.trackSource.start(0, playPos);
      this.startTime = this.ctx.currentTime - playPos;
      this.pauseTime = playPos;
    }

    this.isPlaying = true;
    
    // Calculate current step based on playPos and BPM
    const songTime = offset !== undefined ? offset : this.pauseTime;
    const beatDuration = 60 / this.currentPattern.bpm;
    const stepDuration = beatDuration / 4;
    this.currentStep = Math.floor((songTime % (stepDuration * 16)) / stepDuration);
    this.nextStepTime = this.ctx.currentTime;
    
    if (this.schedulerTimer) clearTimeout(this.schedulerTimer);
    this.scheduler();
  }

  public stop() {
    if (this.trackSource) {
      this.trackSource.stop();
      this.trackSource = null;
    }
    this.pauseTime = this.ctx.currentTime - this.startTime;
    this.isPlaying = false;
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  public seek(time: number) {
    const wasPlaying = this.isPlaying;
    this.stop();
    this.pauseTime = time;
    if (wasPlaying) {
      this.play(time);
    }
  }

  private scheduler() {
    const scheduleAheadTime = 0.1;
    while (this.nextStepTime < this.ctx.currentTime + scheduleAheadTime) {
      this.updateCurrentPatternFromTimeline();
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.nextStep();
    }
    this.schedulerTimer = window.setTimeout(() => this.scheduler(), 25);
  }

  private updateCurrentPatternFromTimeline() {
    const songTime = this.ctx.currentTime - this.startTime;
    const activeEvent = this.timeline.find(e => songTime >= e.startTime && songTime <= e.endTime);
    if (activeEvent) {
      const pattern = this.patterns.find(p => p.id === activeEvent.patternId);
      if (pattern && pattern.id !== this.currentPattern.id) {
        this.setPattern(pattern);
      }
    }
  }

  private nextStep() {
    const secondsPerStep = 60.0 / this.currentPattern.bpm / 4.0;
    this.nextStepTime += secondsPerStep;
    this.currentStep = (this.currentStep + 1) % 16;
  }

  private scheduleStep(step: number, time: number) {
    if (this.currentPattern.steps.k[step]) this.playKick(time);
    if (this.currentPattern.steps.s[step]) this.playSnare(time);
    if (this.currentPattern.steps.h[step]) this.playHiHat(time);
  }

  private playKick(time: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.beatGain);

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  private playSnare(time: number) {
    const noise = this.ctx.createBufferSource();
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;
    noise.connect(noiseFilter);

    const noiseGain = this.ctx.createGain();
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.beatGain);

    noiseGain.gain.setValueAtTime(1, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.connect(oscGain);
    oscGain.connect(this.beatGain);

    osc.frequency.setValueAtTime(100, time);
    oscGain.gain.setValueAtTime(0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    noise.start(time);
    osc.start(time);
    osc.stop(time + 0.1);
    noise.stop(time + 0.1);
  }

  private playHiHat(time: number) {
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 10000;
    
    const gain = this.ctx.createGain();
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.beatGain);

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  getState() {
    return {
      isPlaying: this.isPlaying,
      currentPattern: this.currentPattern,
      hasTrack: !!this.trackBuffer,
      currentTime: this.isPlaying ? (this.ctx.currentTime - this.startTime) : this.pauseTime,
      duration: this.trackBuffer?.duration || 0
    };
  }
}

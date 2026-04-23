/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BeatPattern {
  name: string;
  bpm: number;
  steps: {
    k: boolean[];
    s: boolean[];
    h: boolean[];
  };
}

export const DEFAULT_PATTERNS: BeatPattern[] = [
  {
    name: "Classic 4/4",
    bpm: 120,
    steps: {
      k: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
      s: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
      h: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
    },
  },
  {
    name: "Hip Hop",
    bpm: 90,
    steps: {
      k: [true, false, false, true, false, false, false, false, true, false, true, false, false, false, false, false],
      s: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
      h: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, true],
    },
  },
  {
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
  private currentPattern: BeatPattern = DEFAULT_PATTERNS[0];
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

  setPattern(pattern: BeatPattern) {
    this.currentPattern = pattern;
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

  public play() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.trackBuffer) {
      this.trackSource = this.ctx.createBufferSource();
      this.trackSource.buffer = this.trackBuffer;
      this.trackSource.connect(this.trackGain);
      
      const offset = this.pauseTime % this.trackBuffer.duration;
      this.trackSource.start(0, offset);
      this.startTime = this.ctx.currentTime - offset;
    }

    this.isPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime;
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

  private scheduler() {
    const scheduleAheadTime = 0.1;
    while (this.nextStepTime < this.ctx.currentTime + scheduleAheadTime) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.nextStep();
    }
    this.schedulerTimer = window.setTimeout(() => this.scheduler(), 25);
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
      hasTrack: !!this.trackBuffer
    };
  }
}

// Sound Manager singleton - inline implementation for better bundling
class SoundManager {
  constructor() {
    this.context = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
      console.log('🔊 Sound Manager initialized');
    } catch (error) {
      console.error('Web Audio API not supported:', error);
    }
  }

  generateClickSound() {
    if (!this.context) return null;

    const duration = 0.05; // 50ms - subtle click
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Generate subtle click with exponential decay
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      data[i] = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 50) * 0.1;
    }

    return buffer;
  }

  playClick() {
    if (!this.context || !this.initialized) return;

    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    const buffer = this.generateClickSound();
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    
    const gainNode = this.context.createGain();
    gainNode.gain.value = 0.2;
    
    source.connect(gainNode);
    gainNode.connect(this.context.destination);
    source.start(0);
  }
}

// Create singleton instance
const soundManager = new SoundManager();

// Export function to create hover sound handler
export const createHoverSoundHandler = () => {
  return () => {
    if (!soundManager.initialized) {
      soundManager.init();
    }
    soundManager.playClick();
  };
};

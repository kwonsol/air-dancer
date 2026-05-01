// ── MOTION DETECTOR ───────────────────────────────────────────────────────────
// Webcam-based motion detection using frame differencing.
// Divides the frame into zones and measures movement intensity per zone.

class MotionDetector {
  constructor(videoEl, displayCanvas) {
    this.video   = videoEl;
    this.display = displayCanvas; // optional: shows the processed feed

    // Internal processing canvas (small resolution for performance)
    this._proc   = document.createElement('canvas');
    this._proc.width  = 160;
    this._proc.height = 120;
    this._pctx   = this._proc.getContext('2d', { willReadFrequently: true });

    this._prevPixels = null;
    this._raf        = null;
    this.running     = false;

    // Smoothed output values
    this.left      = 0;
    this.right     = 0;
    this.tilt      = 0;
    this.intensity = 1;
    this.sensitivity = 1.0; // user-adjustable multiplier

    // Raw accumulator (before smoothing)
    this._rawLeft      = 0;
    this._rawRight     = 0;
    this._rawIntensity = 0;

    this._stream = null;
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────

  async start() {
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      this.video.srcObject = this._stream;
      this.video.muted     = true;
      await this.video.play();
      this.running = true;
      this._tick();
      return true;
    } catch (err) {
      console.error('[MotionDetector] Camera access failed:', err);
      return false;
    }
  }

  stop() {
    this.running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    this.video.srcObject = null;
    this._prevPixels = null;
    this.left = this.right = this.tilt = 0;
    this.intensity = 1;
  }

  getMotionData() {
    return {
      left:      this.left,
      right:     this.right,
      tilt:      this.tilt,
      intensity: this.intensity,
    };
  }

  // ── INTERNAL LOOP ──────────────────────────────────────────────────────────

  _tick() {
    if (!this.running) return;
    this._raf = requestAnimationFrame(() => this._tick());

    if (this.video.readyState < this.video.HAVE_ENOUGH_DATA) return;

    const pw = this._proc.width;
    const ph = this._proc.height;

    // Mirror the video feed
    this._pctx.save();
    this._pctx.scale(-1, 1);
    this._pctx.drawImage(this.video, -pw, 0, pw, ph);
    this._pctx.restore();

    const frame = this._pctx.getImageData(0, 0, pw, ph);
    const data  = frame.data;

    if (this._prevPixels) {
      this._analyze(data, this._prevPixels, pw, ph);
    }

    // Keep a copy for the next frame
    this._prevPixels = new Uint8ClampedArray(data);

    // Draw to display canvas if provided
    if (this.display) {
      const dctx = this.display.getContext('2d');
      dctx.save();
      dctx.scale(-1, 1);
      dctx.drawImage(this.video, -this.display.width, 0, this.display.width, this.display.height);
      dctx.restore();
      this._drawOverlay(dctx);
    }
  }

  _analyze(curr, prev, w, h) {
    let sumLeft = 0, sumRight = 0, sumMid = 0;
    let cntLeft = 0, cntRight = 0, cntMid = 0;

    // Only look at the upper 2/3 of the frame (where hands tend to be)
    const yLimit = Math.floor(h * 0.75);

    for (let y = 0; y < yLimit; y++) {
      for (let x = 0; x < w; x++) {
        const idx  = (y * w + x) * 4;
        const diff = (Math.abs(curr[idx]     - prev[idx]) +
                      Math.abs(curr[idx + 1] - prev[idx + 1]) +
                      Math.abs(curr[idx + 2] - prev[idx + 2])) / 765;

        const xRatio = x / w;
        // Frame is already mirrored, so left on screen = user's left hand
        if (xRatio < 0.33)       { sumLeft  += diff; cntLeft++;  }
        else if (xRatio > 0.67)  { sumRight += diff; cntRight++; }
        else                     { sumMid   += diff; cntMid++;   }
      }
    }

    const rawL = cntLeft  ? sumLeft  / cntLeft  : 0;
    const rawR = cntRight ? sumRight / cntRight : 0;
    const rawM = cntMid   ? sumMid   / cntMid   : 0;
    const rawT = rawL + rawR + rawM;

    // Exponential smoothing
    const α = 0.25;
    this._rawLeft      = this._rawLeft      * (1 - α) + rawL * α;
    this._rawRight     = this._rawRight     * (1 - α) + rawR * α;
    this._rawIntensity = this._rawIntensity * (1 - α) + rawT * α;

    const scale = 35 * this.sensitivity;
    this.left      = Math.min(1, this._rawLeft  * scale);
    this.right     = Math.min(1, this._rawRight * scale);
    this.intensity = Math.max(0.4, Math.min(2.2, 1 + this._rawIntensity * scale * 0.6));
    this.tilt      = Math.max(-1, Math.min(1, (this._rawLeft - this._rawRight) * scale));
  }

  _drawOverlay(ctx) {
    const w = this.display.width;
    const h = this.display.height;
    const α = 0.55;

    // Zone boundaries
    ctx.strokeStyle = `rgba(57,255,20,${α})`;
    ctx.lineWidth   = 1.5;

    // Left zone
    ctx.strokeRect(0, 0, w * 0.33, h * 0.75);
    // Right zone
    ctx.strokeRect(w * 0.67, 0, w * 0.33, h * 0.75);

    // Motion bars at bottom of each zone
    const barH = 8;
    const pad  = 3;

    // Left bar
    ctx.fillStyle = `rgba(57,255,20,0.8)`;
    ctx.fillRect(pad, h - barH - pad, (w * 0.33 - pad * 2) * this.left, barH);
    ctx.strokeStyle = `rgba(57,255,20,0.9)`;
    ctx.strokeRect(pad, h - barH - pad, w * 0.33 - pad * 2, barH);

    // Right bar
    ctx.fillRect(w * 0.67 + pad, h - barH - pad,
                 (w * 0.33 - pad * 2) * this.right, barH);
    ctx.strokeRect(w * 0.67 + pad, h - barH - pad, w * 0.33 - pad * 2, barH);

    // Labels
    ctx.fillStyle = 'rgba(57,255,20,0.9)';
    ctx.font      = 'bold 9px Courier New';
    ctx.fillText('L ARM', 4, h - barH - pad - 3);
    ctx.fillText('R ARM', w * 0.67 + 4, h - barH - pad - 3);
  }
}

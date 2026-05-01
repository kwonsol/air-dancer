// ── DANCER CONSTANTS ──────────────────────────────────────────────────────────

const DANCER_COLORS = [
  { name: 'NEON GREEN',    body: '#39FF14', face: '#000000' },
  { name: 'HOT PINK',      body: '#FF006E', face: '#000000' },
  { name: 'ELECTRIC BLUE', body: '#00BFFF', face: '#000000' },
  { name: 'VIVID ORANGE',  body: '#FF6B00', face: '#000000' },
  { name: 'CHROME',        body: '#C0C0C0', face: '#000000' },
  { name: 'ACID YELLOW',   body: '#F5FF00', face: '#000000' },
  { name: 'PURE WHITE',    body: '#FFFFFF', face: '#000000' },
  { name: 'VOID BLACK',    body: '#111111', face: '#39FF14' },
];

const HEAD_STYLES   = ['SQUARE', 'TRIANGLE', 'DIAMOND', 'WIDE', 'ANTENNA'];
const FACE_STYLES   = ['HAPPY', 'SUNGLASSES', 'WILD', 'MINIMAL', 'GRIN'];
const DECO_STYLES   = ['NONE', 'STRIPES', 'STARS', 'DOTS', 'ZIGZAG', 'CHECKS'];
const HAT_STYLES    = ['NONE', 'CAP', 'TOP HAT', 'CROWN', 'HEADPHONES'];

// ── AIRDANCER CLASS ───────────────────────────────────────────────────────────

class AirDancer {
  constructor(cfg = {}) {
    this.config = {
      colorIndex:  0,
      headStyle:   0,
      faceStyle:   0,
      decoration:  0,
      hatStyle:    0,
      bodyText:    '',
      name:        '',
      ...cfg
    };

    this.time      = 0;
    this.leftArm   = 0;   // -1..1
    this.rightArm  = 0;   // -1..1
    this.bodyTilt  = 0;   // -1..1
    this.intensity = 1;   // 0..2
  }

  get color() { return DANCER_COLORS[this.config.colorIndex] || DANCER_COLORS[0]; }

  setMotion({ left = 0, right = 0, tilt = 0, intensity = 1 }) {
    this.leftArm   = left;
    this.rightArm  = right;
    this.bodyTilt  = tilt;
    this.intensity = intensity;
  }

  update(dt) {
    this.time += dt;
  }

  // cx/baseY: canvas coords of the base point (bottom center of dancer)
  draw(ctx, cx, baseY, scale = 1) {
    ctx.save();
    ctx.translate(cx, baseY);
    ctx.scale(scale, scale);

    const color  = this.color;
    const joints = this._computeJoints();

    this._drawBase(ctx, color);
    this._drawBody(ctx, joints, color);
    this._drawArms(ctx, joints, color);
    this._drawHead(ctx, joints, color);

    ctx.restore();
  }

  // ── JOINTS ─────────────────────────────────────────────────────────────────

  _computeJoints() {
    const N      = 7;
    const segLen = 28;
    const t      = this.time;
    const amp    = 0.14 * Math.max(0.4, this.intensity);

    const joints = [{ x: 0, y: 0 }];

    for (let i = 0; i < N; i++) {
      const ratio = i / (N - 1);
      // Wave grows stronger toward top; phase shifts per segment
      const wave     = amp * Math.sin(t * 2.8 + i * 0.88) * (0.5 + ratio * 1.1);
      const tilt     = this.bodyTilt * 0.32 * ratio;
      const angle    = wave + tilt;

      const prev = joints[i];
      joints.push({
        x:        prev.x + Math.sin(angle) * segLen,
        y:        prev.y - Math.cos(angle) * segLen,
        segAngle: angle,
      });
    }
    return joints;
  }

  // ── BASE / FAN ──────────────────────────────────────────────────────────────

  _drawBase(ctx, color) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 2.5;

    // platform
    ctx.fillStyle = '#555';
    ctx.fillRect(-30, 0, 60, 10);
    ctx.strokeRect(-30, 0, 60, 10);

    // fan housing
    ctx.fillStyle = '#333';
    ctx.fillRect(-18, -6, 36, 8);
    ctx.strokeRect(-18, -6, 36, 8);
  }

  // ── BODY SEGMENTS ───────────────────────────────────────────────────────────

  _drawBody(ctx, joints, color) {
    const N = joints.length - 1;
    const baseW = 40, topW = 22;

    for (let i = 0; i < N; i++) {
      const ratio = i / (N - 1);
      const w0 = baseW - (baseW - topW) * (i / N);
      const w1 = baseW - (baseW - topW) * ((i + 1) / N);
      this._drawSegment(ctx, joints[i], joints[i + 1], w0, w1, color, i);
    }

    if (this.config.bodyText) this._drawBodyText(ctx, joints, color);
  }

  _drawSegment(ctx, j0, j1, w0, w1, color, segIndex) {
    const dx  = j1.x - j0.x;
    const dy  = j1.y - j0.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx  = -dy / len;
    const ny  =  dx / len;

    // Quadrilateral fill
    ctx.beginPath();
    ctx.moveTo(j0.x + nx * w0 / 2, j0.y + ny * w0 / 2);
    ctx.lineTo(j1.x + nx * w1 / 2, j1.y + ny * w1 / 2);
    ctx.lineTo(j1.x - nx * w1 / 2, j1.y - ny * w1 / 2);
    ctx.lineTo(j0.x - nx * w0 / 2, j0.y - ny * w0 / 2);
    ctx.closePath();
    ctx.fillStyle   = color.body;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    // Decoration overlay
    if (this.config.decoration > 0) {
      this._drawDecoration(ctx, j0, j1, w0, w1, len, nx, ny, segIndex, color);
    }
  }

  _drawDecoration(ctx, j0, j1, w0, w1, len, nx, ny, segIndex, color) {
    const mx    = (j0.x + j1.x) / 2;
    const my    = (j0.y + j1.y) / 2;
    const angle = Math.atan2(j1.y - j0.y, j1.x - j0.x) - Math.PI / 2;
    const w     = (w0 + w1) / 2;
    const h     = len;

    ctx.save();

    // Clip to segment shape
    ctx.beginPath();
    ctx.moveTo(j0.x + nx * w0 / 2, j0.y + ny * w0 / 2);
    ctx.lineTo(j1.x + nx * w1 / 2, j1.y + ny * w1 / 2);
    ctx.lineTo(j1.x - nx * w1 / 2, j1.y - ny * w1 / 2);
    ctx.lineTo(j0.x - nx * w0 / 2, j0.y - ny * w0 / 2);
    ctx.closePath();
    ctx.clip();

    ctx.translate(mx, my);
    ctx.rotate(angle);

    ctx.fillStyle   = color.face;
    ctx.strokeStyle = color.face;
    ctx.lineWidth   = 1.5;

    switch (this.config.decoration) {
      case 1: // STRIPES
        for (let y = -h / 2 + 4; y < h / 2; y += 7) {
          ctx.beginPath();
          ctx.moveTo(-w / 2, y);
          ctx.lineTo( w / 2, y);
          ctx.stroke();
        }
        break;

      case 2: // STARS
        for (let y = -h / 2 + 8; y < h / 2; y += 16) {
          const sx = (segIndex % 2 === 0) ? 0 : w / 6;
          ctx.save();
          ctx.translate(sx, y);
          this._drawStar(ctx, 4);
          ctx.restore();
        }
        break;

      case 3: // DOTS
        for (let y = -h / 2 + 7; y < h / 2; y += 11) {
          const xo = (segIndex % 2 === 0) ? -w / 6 : w / 6;
          ctx.beginPath();
          ctx.arc(xo, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 4: // ZIGZAG
        ctx.beginPath();
        let goRight = true;
        ctx.moveTo(-w / 3, -h / 2);
        for (let y = -h / 2 + 8; y <= h / 2; y += 8) {
          ctx.lineTo(goRight ? w / 3 : -w / 3, y);
          goRight = !goRight;
        }
        ctx.stroke();
        break;

      case 5: // CHECKS
        ctx.globalAlpha = 0.35;
        const sz = 7;
        for (let y = -h / 2; y < h / 2; y += sz) {
          for (let x = -w / 2; x < w / 2; x += sz) {
            if ((Math.floor(y / sz) + Math.floor(x / sz)) % 2 === 0) {
              ctx.fillRect(x, y, sz, sz);
            }
          }
        }
        ctx.globalAlpha = 1;
        break;
    }

    ctx.restore();
  }

  _drawStar(ctx, r) {
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a   = (k * Math.PI) / 4;
      const rad = k % 2 === 0 ? r : r * 0.45;
      ctx[k === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ── ARMS ────────────────────────────────────────────────────────────────────

  _drawArms(ctx, joints, color) {
    // Attach at joint[5] (upper body)
    const shoulder = joints[5];
    const armLen   = 52;
    const armW     = 13;
    const t        = this.time;

    ctx.save();
    ctx.translate(shoulder.x, shoulder.y);
    ctx.fillStyle   = color.body;
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 2.5;

    // Arm wave: each arm swings with slight delay
    const leftWave  = Math.sin(t * 3.1 + 0.5)  * 0.5 * this.intensity;
    const rightWave = Math.sin(t * 3.1 + 2.1) * 0.5 * this.intensity;

    // LEFT arm: extends to the left, base angle ~-120° (upper-left)
    const leftAngle = -Math.PI * 0.72 + leftWave + this.leftArm * 0.7;
    ctx.save();
    ctx.rotate(leftAngle);
    ctx.fillRect(0, -armW / 2, armLen, armW);
    ctx.strokeRect(0, -armW / 2, armLen, armW);
    // Arm "hand" end block
    ctx.fillRect(armLen - 2, -armW / 2 - 3, armW * 0.6, armW + 6);
    ctx.strokeRect(armLen - 2, -armW / 2 - 3, armW * 0.6, armW + 6);
    ctx.restore();

    // RIGHT arm: extends to the right, base angle ~-60° (upper-right)
    const rightAngle = -Math.PI * 0.28 + rightWave + this.rightArm * 0.7;
    ctx.save();
    ctx.rotate(rightAngle);
    ctx.fillRect(-armLen, -armW / 2, armLen, armW);
    ctx.strokeRect(-armLen, -armW / 2, armLen, armW);
    ctx.fillRect(-armLen - armW * 0.6 + 2, -armW / 2 - 3, armW * 0.6, armW + 6);
    ctx.strokeRect(-armLen - armW * 0.6 + 2, -armW / 2 - 3, armW * 0.6, armW + 6);
    ctx.restore();

    ctx.restore();
  }

  // ── HEAD ────────────────────────────────────────────────────────────────────

  _drawHead(ctx, joints, color) {
    const top    = joints[joints.length - 1];
    const wobble = Math.sin(this.time * 2.4 + 1) * 0.13;
    const angle  = top.segAngle + wobble;
    const hw     = 30;
    const hh     = 32;

    ctx.save();
    ctx.translate(top.x, top.y);
    ctx.rotate(angle);
    ctx.fillStyle   = color.body;
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 2.5;

    switch (this.config.headStyle) {
      case 0: // SQUARE
        ctx.fillRect(-hw / 2, -hh, hw, hh);
        ctx.strokeRect(-hw / 2, -hh, hw, hh);
        break;

      case 1: // TRIANGLE
        ctx.beginPath();
        ctx.moveTo(0, -hh * 1.25);
        ctx.lineTo(hw * 0.62, 0);
        ctx.lineTo(-hw * 0.62, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 2: // DIAMOND / HEXAGON
        ctx.beginPath();
        ctx.moveTo(0, -hh * 1.1);
        ctx.lineTo(hw * 0.55, -hh * 0.5);
        ctx.lineTo(hw * 0.55, -hh * 0.1);
        ctx.lineTo(0,  hh * 0.12);
        ctx.lineTo(-hw * 0.55, -hh * 0.1);
        ctx.lineTo(-hw * 0.55, -hh * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 3: // WIDE
        ctx.fillRect(-hw * 0.85, -hh * 0.58, hw * 1.7, hh * 0.58);
        ctx.strokeRect(-hw * 0.85, -hh * 0.58, hw * 1.7, hh * 0.58);
        break;

      case 4: // ANTENNA
        ctx.fillRect(-hw / 2, -hh, hw, hh);
        ctx.strokeRect(-hw / 2, -hh, hw, hh);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -hh);
        ctx.lineTo(0, -hh - 18);
        ctx.stroke();
        ctx.fillRect(-5, -hh - 26, 10, 10);
        ctx.strokeRect(-5, -hh - 26, 10, 10);
        break;
    }

    this._drawFace(ctx, hw, hh, color);
    this._drawHat(ctx, hw, hh, color);

    ctx.restore();
  }

  // ── FACE ────────────────────────────────────────────────────────────────────

  _drawFace(ctx, hw, hh, color) {
    ctx.fillStyle   = color.face;
    ctx.strokeStyle = color.face;
    const fy = -hh * 0.52; // vertical center of face

    switch (this.config.faceStyle) {
      case 0: // HAPPY
        ctx.lineWidth = 2;
        ctx.fillRect(-hw / 4 - 4, fy - 5, 8, 8);
        ctx.fillRect( hw / 4 - 4, fy - 5, 8, 8);
        ctx.beginPath();
        ctx.arc(0, fy + 7, hw * 0.28, 0.15, Math.PI - 0.15);
        ctx.stroke();
        break;

      case 1: // SUNGLASSES
        ctx.lineWidth = 2;
        ctx.fillRect(-hw / 2 + 3, fy - 7, hw - 6, 9);
        ctx.strokeRect(-hw / 2 + 3, fy - 7, hw - 6, 9);
        ctx.beginPath();
        ctx.moveTo(-hw / 2 + 3, fy - 2);
        ctx.lineTo( hw / 2 - 3, fy - 2);
        ctx.stroke();
        ctx.fillRect(-3, fy + 4, 6, 5);
        break;

      case 2: // WILD — X eyes
        ctx.lineWidth = 2.5;
        const ex = hw / 4;
        [[-ex, fy], [ex, fy]].forEach(([ox, oy]) => {
          ctx.beginPath();
          ctx.moveTo(ox - 5, oy - 5); ctx.lineTo(ox + 5, oy + 5);
          ctx.moveTo(ox + 5, oy - 5); ctx.lineTo(ox - 5, oy + 5);
          ctx.stroke();
        });
        ctx.beginPath();
        ctx.moveTo(-hw / 3, fy + 10);
        ctx.bezierCurveTo(-hw / 6, fy + 4, hw / 6, fy + 16, hw / 3, fy + 10);
        ctx.lineWidth = 2;
        ctx.stroke();
        break;

      case 3: // MINIMAL
        ctx.fillRect(-hw / 4 - 3, fy - 2, 6, 6);
        ctx.fillRect( hw / 4 - 3, fy - 2, 6, 6);
        break;

      case 4: // GRIN
        ctx.lineWidth = 2;
        ctx.fillRect(-hw / 4 - 4, fy - 5, 8, 8);
        ctx.fillRect( hw / 4 - 4, fy - 5, 8, 8);
        ctx.fillRect(-hw * 0.34, fy + 5, hw * 0.68, 8);
        ctx.strokeRect(-hw * 0.34, fy + 5, hw * 0.68, 8);
        break;
    }
  }

  // ── HAT ─────────────────────────────────────────────────────────────────────

  _drawHat(ctx, hw, hh, color) {
    if (this.config.hatStyle === 0) return;
    ctx.fillStyle   = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 2.5;

    switch (this.config.hatStyle) {
      case 1: // CAP
        ctx.fillRect(-hw * 0.6, -hh - 10, hw * 1.2, 10);
        ctx.fillRect(-hw * 0.85, -hh, hw * 0.6, 6);
        break;

      case 2: // TOP HAT
        ctx.fillRect(-hw * 0.38, -hh - 28, hw * 0.76, 28);
        ctx.strokeRect(-hw * 0.38, -hh - 28, hw * 0.76, 28);
        ctx.fillRect(-hw * 0.72, -hh, hw * 1.44, 7);
        ctx.strokeRect(-hw * 0.72, -hh, hw * 1.44, 7);
        break;

      case 3: // CROWN
        ctx.beginPath();
        const pts = [-hw * 0.55, -hw * 0.2, 0, hw * 0.2, hw * 0.55];
        const ys  = [-hh, -hh - 16, -hh - 22, -hh - 16, -hh];
        ctx.moveTo(pts[0], -hh);
        pts.forEach((px, k) => { if (k > 0) ctx.lineTo(px, ys[k]); });
        ctx.lineTo(hw * 0.55, -hh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 4: // HEADPHONES
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, -hh + 8, hw * 0.7, Math.PI, 0);
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.fillStyle = '#000';
        ctx.fillRect(-hw * 0.85, -hh, 10, 14);
        ctx.strokeRect(-hw * 0.85, -hh, 10, 14);
        ctx.fillRect(hw * 0.85 - 10, -hh, 10, 14);
        ctx.strokeRect(hw * 0.85 - 10, -hh, 10, 14);
        break;
    }
  }

  // ── BODY TEXT ───────────────────────────────────────────────────────────────

  _drawBodyText(ctx, joints, color) {
    const txt = this.config.bodyText.substring(0, 10).toUpperCase();
    if (!txt) return;

    const mid = joints[Math.floor(joints.length / 2)];
    ctx.save();
    ctx.translate(mid.x, mid.y);
    ctx.rotate(mid.segAngle || 0);
    ctx.fillStyle   = color.face;
    ctx.font        = 'bold 9px Courier New';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  }

  // ── SERIALIZATION ───────────────────────────────────────────────────────────

  toConfig() { return { ...this.config }; }

  static fromConfig(cfg) { return new AirDancer(cfg); }
}

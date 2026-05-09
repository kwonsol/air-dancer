/**
 * dancer.js  ─  Three.js 기반 3D 광고풍선인형 렌더러
 * =====================================================================
 *
 * [필요한 외부 라이브러리]
 *   Three.js r160  ←  각 HTML 파일에서 CDN으로 미리 로드해야 합니다.
 *   <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
 *   위 태그를 이 파일을 불러오는 <script> 태그보다 '앞에' 넣어야 합니다.
 *
 * [이 파일에 들어있는 클래스 3개]
 *   1. AirDancer   ─ 인형 한 마리의 3D 형태(메쉬)와 움직임(애니메이션)을 담당
 *   2. DancerScene ─ 인형 하나를 화면에 보여주는 Three.js 씬
 *                    create.html, dance.html 에서 사용
 *   3. PlazaScene  ─ 여러 인형을 광장처럼 나열하는 Three.js 씬
 *                    gallery.html 에서 사용
 *
 * [Three.js 기본 개념]
 *   Scene    : 3D 물체들이 놓이는 공간 (무대)
 *   Camera   : 어느 각도에서 볼 것인지 결정
 *   Renderer : Scene + Camera 를 실제 화면에 그리는 엔진
 *   Mesh     : 형태(Geometry) + 재질(Material) 의 조합 = 보이는 3D 오브젝트
 *   Group    : 여러 Mesh 를 하나로 묶는 빈 컨테이너
 */

// =============================================================================
// 섹션 1: 색깔·스타일 프리셋 상수들
// =============================================================================

/**
 * DANCER_COLORS
 * 인형이 선택할 수 있는 색깔 목록입니다.
 *
 * body    : Three.js 에서 쓰는 색깔 형식 (0x + 16진수)
 * bodyHex : HTML/CSS 에서 쓰는 색깔 형식 (#RRGGBB)  ← 색 선택 UI 에 사용
 * face    : 눈·입·몸통 글자 색
 */
const DANCER_COLORS = [
  { name: 'YELLOW',  body: 0xFFFF00, bodyHex: '#FFFF00', face: 0x333300 },
  { name: 'MAGENTA', body: 0xFF00FF, bodyHex: '#FF00FF', face: 0xFFFFFF },
  { name: 'GREEN',   body: 0x00FF00, bodyHex: '#00FF00', face: 0x003300 },
  { name: 'BLUE',    body: 0x0066FF, bodyHex: '#0066FF', face: 0xFFFFFF },
  { name: 'PURPLE',  body: 0x9900FF, bodyHex: '#9900FF', face: 0xFFFFFF },
  { name: 'ORANGE',  body: 0xFF6600, bodyHex: '#FF6600', face: 0xFFFFFF },
  { name: 'RED',     body: 0xFF0000, bodyHex: '#FF0000', face: 0xFFFFFF },
  { name: 'BLACK',   body: 0x000510, bodyHex: '#000510', face: 0xFFFF00 },
];

/**
 * EYE_IMAGES
 * 눈 디자인으로 사용할 PNG 파일 목록입니다.
 * 경로는 HTML 파일이 있는 루트 폴더 기준 상대경로입니다.
 * 파일 이름 순서가 eyeStyle 번호(0, 1, 2…)와 일치합니다.
 */
const EYE_IMAGES = [
  'Image/eyes/eye-02.png',
  'Image/eyes/eye-03.png',
  'Image/eyes/eye-04.png',
  'Image/eyes/eye-05.png',
  'Image/eyes/eye-06.png',
];

/** 몸통 장식 이미지 목록 (decoration: 1 = [0], 2 = [1], …) */
const DECO_IMAGES = [
  'Image/decoration/deco.png',
];

/** 모자 이미지 목록 (hatStyle: 1 = [0], 2 = [1], …) */
const HAT_IMAGES = [
  'Image/hat/hat-07.png',
  'Image/hat/hat-08.png',
  'Image/hat/hat-09.png',
];

/** 입 이미지 목록 (mouthStyle: 0 = 기본 토러스, 1 = [0], …) */
const MOUTH_IMAGES = [
  'Image/mouth/mouth.png',
];

// =============================================================================
// 섹션 2: AirDancer 클래스
// =============================================================================

/**
 * AirDancer
 *
 * 풍선인형 한 마리를 표현하는 클래스입니다.
 * - buildGroup()      : 3D 형태(메쉬)를 만들어 THREE.Group 을 반환합니다.
 * - update(dt)        : 매 프레임 호출해 애니메이션을 진행합니다.
 * - setMotion(obj)    : 웹캠 모션 데이터를 주입해 팔·몸통 움직임에 반영합니다.
 * - updateColor()     : 몸 색깔 변경 시 텍스처를 재생성합니다.
 * - updateArmColor()  : 팔 색깔만 바꿀 때 사용합니다.
 * - rebuild()         : 모자·장식·표정 등 형태가 바뀔 때 전체 재생성합니다.
 * - toConfig()        : 현재 설정을 일반 객체로 반환합니다 (저장용).
 */
class AirDancer {

  /**
   * @param {Object} cfg - 인형 설정값 (없으면 기본값 사용)
   */
  constructor(cfg = {}) {
    // 설정값 저장. ...cfg 로 전달된 값이 기본값을 덮어씁니다.
    this.config = {
      colorIndex:    0,   // 몸통 색깔 번호
      armColorIndex: 0,   // 팔 색깔 번호 (몸통과 별도 선택 가능)
      eyeStyle:      0,   // 눈 디자인 번호
      decoration:    0,   // 장식 번호 (0=없음, 1+=이미지)
      hatStyle:      0,   // 모자 번호 (0=없음, 1+=이미지)
      mouthStyle:    0,   // 입 번호 (0=기본 토러스, 1+=이미지)
      bodyText:      '',  // 몸통 글자
      name:          '',  // 인형 이름
      ...cfg
    };

    // ── 애니메이션 상태 변수 ──────────────────────────────────────
    this.time      = 0;   // 누적 시간(초) ← sin() 에 넣어 파도처럼 움직임

    // ── 웹캠 모션 입력값 (0 ~ 1 범위) ────────────────────────────
    this.motionLeft  = 0;   // 왼팔 움직임 강도
    this.motionRight = 0;   // 오른팔 움직임 강도
    this.motionTilt  = 0;   // 몸통 기울기
    this.intensity   = 1;   // 전체 움직임 세기 (0.4 ~ 2.0)

    // ── Three.js 오브젝트 참조 (buildGroup() 후 채워짐) ──────────
    this.group         = null;  // 모든 파트를 담는 최상위 Group
    this._bodyMesh     = null;  // 몸통 Mesh
    this._leftPivot    = null;  // 왼팔 회전 기준점 Group
    this._rightPivot   = null;  // 오른팔 회전 기준점 Group
    this._leftArmMesh  = null;  // 왼팔 Mesh
    this._rightArmMesh = null;  // 오른팔 Mesh
    this._faceGroup    = null;  // 얼굴·머리털·모자를 묶는 Group (몸통 꼭대기에 위치)
    this._decoGroup    = null;  // 장식 이미지를 담는 Group (몸통 하단에 위치)

    // 흐물거림 애니메이션을 위해 꼭짓점 원래 위치를 저장
    this._bodyOrigPos = null;
  }

  // ── 편의 getter ────────────────────────────────────────────────────────────

  /** 현재 선택된 몸통 색깔 프리셋 객체를 반환합니다. */
  get color() {
    return DANCER_COLORS[this.config.colorIndex] || DANCER_COLORS[0];
  }

  /** 현재 선택된 팔 색깔 프리셋 객체를 반환합니다. */
  get armColor() {
    // armColorIndex 가 없는 구형 데이터도 안전하게 처리합니다.
    return DANCER_COLORS[this.config.armColorIndex] || DANCER_COLORS[0];
  }

  // ── 웹캠 모션 수신 ─────────────────────────────────────────────────────────

  /**
   * 웹캠 MotionDetector 가 계산한 값을 받아 저장합니다.
   * @param {Object} data - { left, right, tilt, intensity }
   */
  setMotion({ left = 0, right = 0, tilt = 0, intensity = 1 } = {}) {
    this.motionLeft  = left;
    this.motionRight = right;
    this.motionTilt  = tilt;
    this.intensity   = Math.max(0.4, Math.min(2.2, intensity));
  }

  // ── 매 프레임 업데이트 ──────────────────────────────────────────────────────

  /**
   * requestAnimationFrame 루프에서 매 프레임 호출합니다.
   * @param {number} dt - 이전 프레임 이후 경과 시간 (초)
   */
  update(dt) {
    this.time += dt;
    if (!this.group) return;

    // 만약 저장된 모션 트랙이 있다면, 그 데이터로 모션 값을 강제로 덮어씌웁니다 (갤러리용 재생)
    if (this.config.motionTrack && this.config.motionTrack.length > 0) {
      const track = this.config.motionTrack;
      // 50ms (0.05초) 당 1프레임으로 가정하여 인덱스 계산
      const frameIndex = Math.floor((this.time * 1000) / 50) % track.length;
      const frame = track[frameIndex];
      if (frame) {
        this.motionLeft  = frame.left;
        this.motionRight = frame.right;
        this.motionTilt  = frame.tilt;
        this.intensity   = frame.intensity;
      }
    }

    this._animateBody();   // 몸통 꼭짓점 흐물거림
    this._animateArms();   // 팔 흔들기
    this._animateFace();   // 얼굴 그룹 독립 흔들기
  }

  // =============================================================================
  // 3D 형태 생성
  // =============================================================================

  /**
   * buildGroup()
   *
   * 인형의 3D 형태 전체를 만들고 this.group(THREE.Group)에 담습니다.
   * 씬(Scene)에 추가하려면 scene.add(dancer.group) 을 호출하세요.
   *
   * @returns {THREE.Group}
   */
  buildGroup() {
    if (this.group) this._disposeGroup();

    this.group = new THREE.Group();

    this._buildBase();       // 받침대 (검은 팬 부분)
    this._buildBody();       // 몸통 (긴 색깔 원통 + 글자 텍스처)
    this._buildArms();       // 팔 두 개
    this._buildFaceGroup();  // 얼굴(눈·입)·머리털·모자 ← 별도 구 없이 몸통 위에 직접
    this._buildBuilding();   // (신규) 인형 뒤 빌딩

    return this.group;
  }

  // ── 받침대 ─────────────────────────────────────────────────────────────────

  _buildBase() {
    const geo = new THREE.CylinderGeometry(0.30, 0.40, 0.55, 20, 1);
    const mat = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 60 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y  = 0.275;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  // ── 빌딩 (웹사이트 링크 맵핑) ──────────────────────────────────────────────────
  _buildBuilding() {
    // URL이나 이미지가 하나라도 있으면 빌딩을 생성합니다.
    if (!this.config.buildingUrl && !this.config.buildingImage) return;

    // 빌딩 크기: 화면 예시에 맞게 넓고 높게 설정 (너비 3.2, 높이 5.0, 깊이 0.2)
    const width = 3.2;
    const height = 5.0;
    const depth = 0.2;
    const geo = new THREE.BoxGeometry(width, height, depth);

    // 기본 콘크리트/회색 재질
    const defaultMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
    
    // 정면(Front Face)을 위한 재질 생성
    const frontMat = new THREE.MeshPhongMaterial({ color: 0x222222 });

    // BoxGeometry의 면 순서: [오른쪽, 왼쪽, 위, 아래, 앞, 뒤]
    const materials = [
      defaultMat, // Right
      defaultMat, // Left
      defaultMat, // Top
      defaultMat, // Bottom
      frontMat,   // Front (여기에 업로드한 이미지 맵핑)
      defaultMat  // Back
    ];

    const mesh = new THREE.Mesh(geo, materials);
    
    // 인형의 우측 약간 뒤쪽으로 이동 (사진의 보라색 박스 위치 참고)
    mesh.position.set(2.1, height / 2, -0.6);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 클릭 시 링크를 열기 위해 userData에 url 저장
    if (this.config.buildingUrl) {
      mesh.userData = { url: this.config.buildingUrl, isBuilding: true };
    }

    this.group.add(mesh);

    // 업로드한 이미지가 있으면 텍스처로 로드 (Base64 데이터)
    if (this.config.buildingImage) {
      const loader = new THREE.TextureLoader();
      loader.load(
        this.config.buildingImage,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          frontMat.map = texture;
          frontMat.color.setHex(0xffffff); // 텍스처 본연의 색상을 위해 흰색으로 변경
          frontMat.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn('빌딩 썸네일 로드 실패:', err);
        }
      );
    }
  }

  // ── 몸통 ──────────────────────────────────────────────────────────────────

  /**
   * 인형의 메인 몸통을 만듭니다.
   *
   * 1단계 변경점:
   *   - 몸통 표면에 캔버스 텍스처를 입힙니다.
   *   - 캔버스에 배경색(= 몸통 색)을 깔고, 글자를 세로로 씁니다.
   *   - rotation.y = Math.PI 로 회전시켜 텍스처 중앙(u=0.5)이
   *     카메라 정면(+Z 방향)에 오도록 합니다.
   *   - 기존의 별도 텍스트 스프라이트(_buildBodyTextSprite)는 삭제했습니다.
   */
  _buildBody() {
    const TOP_R  = 0.22;
    const BOT_R  = 0.31;
    const HEIGHT = 3.8;
    const SEG_R  = 20;
    const SEG_H  = 40;  // 세로 분할 ← 흐물거림에 필요

    const geo = new THREE.CylinderGeometry(TOP_R, BOT_R, HEIGHT, SEG_R, SEG_H, false);

    // 원래 꼭짓점 위치 복사 (매 프레임 변형 기준점)
    this._bodyOrigPos = geo.attributes.position.clone();

    // ── 캔버스 텍스처 생성 ──────────────────────────────────────────────────
    // 텍스처 하나로 몸통 색 + 글자를 동시에 표현합니다.
    const texture = this._makeBodyTexture();

    // 뫸스 재질: emissive를 강하게 설정해 스포이드 색상이 그대로 출력되도록
    // emissiveIntensity=0.60 → 기본 색상의 60%를 자체발광으로 보장
    // diffuse 컴포넌트가 조명에 의한 음영·하이라이트를 더함
    const mat = new THREE.MeshPhongMaterial({
      color:             0xFFFFFF,
      map:               texture,
      shininess:         350,         // 매우 좌은 하이라이트 반점 (plastic/balloon)
      specular:          0xffffff,    // 순수 흰 하이라이트
      emissive:          new THREE.Color(0x111111),
      emissiveMap:       texture,
      emissiveIntensity: 0.60,        // 스포이드 색상의 60% 항상 보장
    });

    this._bodyMesh           = new THREE.Mesh(geo, mat);
    this._bodyMesh.position.y = 0.55 + HEIGHT / 2;   // 받침대 위부터 시작

    // ★ 핵심: Y축 기준 180도 회전
    //   Three.js CylinderGeometry 는 theta=0(u=0 솔기)이 +Z 방향(카메라 정면)에서 시작합니다.
    //   180도 돌리면 솔기가 뒤(-Z)로 가고, u=0.5(캔버스 가로 중앙)이 정면에 옵니다.
    //   따라서 캔버스 가로 중앙에 그린 글자가 카메라 정면에 나타납니다.
    this._bodyMesh.rotation.y = Math.PI;
    this._bodyMesh.castShadow  = true;

    this.group.add(this._bodyMesh);

    // 장식
    if (this.config.decoration > 0) {
      this._buildDecoration();
    }
  }

  /**
   * _makeBodyTexture()
   *
   * 캔버스(512×1024)에 몸통 배경색을 깔고 글자를 세로로 써서
   * Three.js 텍스처로 반환합니다.
   *
   * [UV → 실린더 표면 매핑 원리]
   *   u(가로 0~1) → 원통 둘레 방향
   *   v(세로 0~1) → 원통 높이 방향 (v=0=아래, v=1=위)
   *   캔버스 x=0   → u=0 (솔기, 몸통 뒷면)
   *   캔버스 x=W/2 → u=0.5 (몸통 앞면, 카메라 정면) ← 글자 위치
   *   캔버스 x=W   → u=1 (다시 솔기)
   *
   * @returns {THREE.CanvasTexture}
   */
  _makeBodyTexture() {
    const W = 512;
    const H = 1024;

    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 배경
    ctx.fillStyle = this.color.bodyHex;
    ctx.fillRect(0, 0, W, H);

    const text = (this.config.bodyText || '').substring(0, 10).toUpperCase();

    if (text) {
      const faceHex = '#' + this.color.face.toString(16).padStart(6, '0');
      ctx.fillStyle    = faceHex;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      const chars = text.split('');
      const n     = chars.length;

      // ── 텍스트 영역 경계 ─────────────────────────────────────────────────
      // 캔버스 y=0 = 몸통 위, y=H = 몸통 아래 (flipY 매핑)
      // 상단: 눈·입 아래 (20%)   하단: 장식 위 (63%) 또는 없을 때 (68%)
      const startRatio = 0.20;
      const endRatio   = (this.config.decoration > 0) ? 0.63 : 0.68;

      const startY    = H * startRatio;
      const textAreaH = H * (endRatio - startRatio);

      // ── 1열 or 2열 자동 선택 ─────────────────────────────────────────────
      // 1열에서 폰트 크기가 MIN_FONT 미만이면 2열로 전환
      const MIN_FONT = 52;

      const slotH1    = textAreaH / n;
      const fontSize1 = Math.min(Math.floor(slotH1 * 0.75), 110);

      if (fontSize1 >= MIN_FONT || n <= 2) {
        // ── 1열 배치 ───────────────────────────────────────────────────────
        ctx.font = `bold ${fontSize1}px "Courier New", Courier, monospace`;
        chars.forEach((ch, i) => {
          ctx.fillText(ch, W / 2, startY + (i + 0.5) * slotH1);
        });

      } else {
        // ── 2열 배치 ───────────────────────────────────────────────────────
        // 절반씩 왼쪽·오른쪽 열로 분배
        const half       = Math.ceil(n / 2);
        const leftChars  = chars.slice(0, half);
        const rightChars = chars.slice(half);
        const rows       = Math.max(leftChars.length, rightChars.length);

        const slotH2    = textAreaH / rows;
        const fontSize2 = Math.min(Math.floor(slotH2 * 0.75), 110);
        ctx.font = `bold ${fontSize2}px "Courier New", Courier, monospace`;

        // 두 열 사이 간격: 폰트 크기 기준으로 동적 조정
        const colOffset = Math.max(fontSize2 * 0.55, 36);

        leftChars.forEach((ch, i) => {
          ctx.fillText(ch, W / 2 - colOffset, startY + (i + 0.5) * slotH2);
        });
        rightChars.forEach((ch, i) => {
          ctx.fillText(ch, W / 2 + colOffset, startY + (i + 0.5) * slotH2);
        });
      }
    }

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * _loadEyeTexture(src, callback)
   *
   * Image 객체를 사용하여 이미지를 로드한 뒤 Three.js 텍스처로 변환합니다.
   * file:// 프로토콜 등 로컬 환경에서도 더 안정적으로 동작합니다.
   *
   * @param {string}   src      - 이미지 URL
   * @param {Function} callback - (THREE.Texture) => void
   */
  _loadEyeTexture(src, callback) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const texture = new THREE.Texture(img);
      texture.needsUpdate = true;
      // r160 이상에서는 sRGB 색상 공간을 명시하는 것이 좋습니다.
      if (typeof THREE.SRGBColorSpace !== 'undefined') {
        texture.colorSpace = THREE.SRGBColorSpace;
      }
      callback(texture);
    };
    img.onerror = () => {
      console.warn('[AirDancer] 눈 이미지 로드 실패:', src);
      // 로드 실패 시 빈 텍스처 전달
      const fallback = new THREE.DataTexture(new Uint8Array([0,0,0,0]), 1, 1);
      fallback.needsUpdate = true;
      callback(fallback);
    };
    img.src = src;
  }

  // ── 팔 ──────────────────────────────────────────────────────────────────────

  /**
   * 왼팔과 오른팔을 만들어 붙입니다.
   *
   * 1단계 변경점:
   *   - 팔 색깔을 몸통과 별도(armColor)로 분리했습니다.
   *   - 피벗 X 위치를 몸통 표면 반지름(0.24)에 정확히 맞춰 틈을 없앴습니다.
   *
   * [구조]
   *   _leftPivot (Group) ← 어깨 위치(몸통 표면)에 배치
   *     └─ _leftArmMesh (Cylinder) ← 피벗에서 왼쪽으로 뻗음
   *
   * 피벗을 어깨(몸통 표면)에 두고 피벗을 회전시키면
   * 팔이 어깨 기준으로 자연스럽게 흔들립니다.
   */
  _buildArms() {
    const ARM_LEN = 1.65;   // 팔 길이
    const ARM_TR  = 0.085;  // 팔 끝(손) 반지름
    const ARM_BR  = 0.115;  // 팔 시작(어깨) 반지름
    const ARM_SR  = 14;     // 가로 분할
    const ARM_SH  = 22;     // 세로 분할 (팔도 약간 흐물거림)

    // 어깨 Y 위치: 받침대(0.55) + 몸통 높이(3.8)의 78% 지점
    const SHOULDER_Y = 0.55 + 3.8 * 0.78;   // ≈ 3.514

    // 어깨 높이에서 몸통 반지름 계산
    //   BOT_R=0.31(아래), TOP_R=0.22(위), 78% 지점:
    //   r = 0.31 - (0.31 - 0.22) × 0.78 ≈ 0.24
    const SHOULDER_R = 0.24;

    // 팔 재질: armColor 를 사용합니다 (몸통 색과 다를 수 있음)
    const armMatL = new THREE.MeshPhongMaterial({
      color:     this.armColor.body,
      shininess: 90,
      specular:  0x444444,
    });
    const armMatR = new THREE.MeshPhongMaterial({
      color:     this.armColor.body,
      shininess: 90,
      specular:  0x444444,
    });

    // ── 왼팔 ──────────────────────────────────────────────────────────────
    this._leftPivot = new THREE.Group();
    // 피벗을 몸통 표면(x = -SHOULDER_R)에 정확히 배치 → 팔이 몸통과 자연스럽게 연결
    this._leftPivot.position.set(-SHOULDER_R, SHOULDER_Y, 0);

    const leftGeo = new THREE.CylinderGeometry(ARM_TR, ARM_BR, ARM_LEN, ARM_SR, ARM_SH);
    this._leftArmMesh = new THREE.Mesh(leftGeo, armMatL);

    // 팔 중심을 피벗 기준으로 왼쪽 ARM_LEN/2 에 배치합니다.
    // 이렇게 하면 팔의 어깨 끝이 피벗(= 몸통 표면)에 딱 붙습니다.
    this._leftArmMesh.position.x = -(ARM_LEN / 2);

    // CylinderGeometry는 기본 Y축 세로. Z축으로 90도 회전 → X축 수평으로 눕힘
    this._leftArmMesh.rotation.z  = Math.PI / 2;
    this._leftArmMesh.castShadow  = true;

    this._leftPivot.add(this._leftArmMesh);
    this.group.add(this._leftPivot);

    // ── 오른팔 (왼팔을 X축 대칭) ──────────────────────────────────────────
    this._rightPivot = new THREE.Group();
    this._rightPivot.position.set(SHOULDER_R, SHOULDER_Y, 0);

    const rightGeo = new THREE.CylinderGeometry(ARM_TR, ARM_BR, ARM_LEN, ARM_SR, ARM_SH);
    this._rightArmMesh = new THREE.Mesh(rightGeo, armMatR);

    this._rightArmMesh.position.x = ARM_LEN / 2;
    this._rightArmMesh.rotation.z = -Math.PI / 2;
    this._rightArmMesh.castShadow  = true;

    this._rightPivot.add(this._rightArmMesh);
    this.group.add(this._rightPivot);
  }

  // ── 얼굴·머리털·모자 (몸통 위에 직접) ─────────────────────────────────────

  /**
   * _buildFaceGroup()
   *
   * 1단계 변경점:
   *   기존에는 별도의 구(Sphere)를 머리로 썼습니다.
   *   이제 머리 구를 없애고, 얼굴 요소(눈·입)를 몸통 위쪽 표면에 직접 붙입니다.
   *
   * [구조]
   *   _faceGroup (Group, position.y = 4.35 = 몸통 꼭대기)
   *     ├─ 눈 두 개   (y = -0.35, z = +0.22 = 몸통 앞면)
   *     ├─ 입          (y = -0.65, z = +0.22)
   *     ├─ 머리털 7개  (y = 0 ~ 0.4 = 몸통 꼭대기 위)
   *     └─ 모자        (hatStyle > 0 일 때)
   *
   *   _faceGroup 의 pivot 이 몸통 꼭대기(y=4.35)에 있으므로
   *   이 그룹을 약간 회전시키면 얼굴이 자연스럽게 흔들립니다.
   */
  _buildFaceGroup() {
    this._faceGroup = new THREE.Group();

    // 몸통 꼭대기 Y = 받침대(0.55) + 몸통 높이(3.8)
    const BODY_TOP_Y = 0.55 + 3.8;   // = 4.35

    // faceGroup 의 pivot 을 몸통 꼭대기에 배치합니다.
    // 이후 자식 오브젝트들은 이 그룹 기준의 '상대 좌표'로 위치를 지정합니다.
    this._faceGroup.position.y = BODY_TOP_Y;

    // 몸통 최상단 반지름 = 0.22
    const TOP_R = 0.22;

    // 얼굴 요소의 Z 좌표: 몸통 앞면 표면(+Z 방향)에 올려놓습니다.
    // 카메라가 +Z 방향에 있으므로 +Z = 정면입니다.
    const FACE_Z = TOP_R + 0.01;

    // ── 눈 (PNG 이미지 텍스처를 평면에 붙입니다) ──────────────────────────
    const eyeY = -0.35;   // faceGroup 기준 Y (세계 좌표: 4.35 - 0.35 = 4.0)

    // eyeStyle 범위를 벗어나면 안전하게 0번 이미지를 씁니다.
    const eyeIdx  = Math.max(0, Math.min(EYE_IMAGES.length - 1,
                      this.config.eyeStyle || 0));
    const eyePath = EYE_IMAGES[eyeIdx];

    // 먼저 투명한 메쉬를 생성해 faceGroup에 추가해둡니다 (레이아웃 확보)
    const eyePlane = new THREE.PlaneGeometry(0.46, 0.28);
    const eyeMat   = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity:     0,     // 텍스처 로드 전에는 숨김
      side:        THREE.DoubleSide,
      depthWrite:  false,
      depthTest:   false,  // 몸통이 앞으로 나와도 눈이 항상 위에 렌더링
    });
    const eyeMesh = new THREE.Mesh(eyePlane, eyeMat);
    eyeMesh.renderOrder = 999;  // 항상 다른 메쉬 위에 그려짐
    // 몸통 앞면(+Z) 에 충분히 떠있게 배치합니다 (Z-fighting 방지)
    eyeMesh.position.set(0, eyeY, FACE_Z + 0.04);
    this._faceGroup.add(eyeMesh);

    // 텍스처를 로드하여 메쉬에 적용합니다.
    this._loadEyeTexture(eyePath, (eyeTex) => {
      if (!eyeMesh) return;
      eyeMat.map     = eyeTex;
      eyeMat.opacity = 1;
      eyeMat.needsUpdate = true;
    });

    // ── 입 ─────────────────────────────────────────────────────────────────
    const mouthY  = -0.62;
    const mouthSt = Math.max(0, this.config.mouthStyle || 0);

    if (mouthSt > 0 && mouthSt <= MOUTH_IMAGES.length) {
      // 이미지 입
      const mPlane = new THREE.PlaneGeometry(0.42, 0.22);
      const mMat   = new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false, depthTest: false,
      });
      const mMesh = new THREE.Mesh(mPlane, mMat);
      mMesh.renderOrder = 999;
      mMesh.position.set(0, mouthY, FACE_Z + 0.04);
      this._faceGroup.add(mMesh);
      this._loadEyeTexture(MOUTH_IMAGES[mouthSt - 1], tex => {
        if (!mMesh) return;
        mMat.map = tex; mMat.opacity = 1; mMat.needsUpdate = true;
      });
    } else {
      // 기본 토러스 입
      const faceColor = this.color.face;
      const mouthMat  = new THREE.MeshPhongMaterial({
        color: faceColor, emissive: faceColor, emissiveIntensity: 0.2,
        depthTest: false,
      });
      const mGeo  = new THREE.TorusGeometry(0.068, 0.016, 8, 16, Math.PI);
      const mouth = new THREE.Mesh(mGeo, mouthMat);
      mouth.renderOrder = 999;
      mouth.position.set(0, mouthY, FACE_Z * 0.92);
      mouth.rotation.z = Math.PI;
      this._faceGroup.add(mouth);
    }

    // ── 머리털 ─────────────────────────────────────────────────────────────
    // 머리털 제거 (검은 그래픽 없애기)

    // ── 모자 ───────────────────────────────────────────────────────────────
    if (this.config.hatStyle > 0) {
      this._buildHat(TOP_R);
    }

    this.group.add(this._faceGroup);
  }

  // ── 머리털 ────────────────────────────────────────────────────────────────

  /**
   * 몸통 꼭대기에서 위로 삐죽삐죽 나온 머리털을 만듭니다.
   * _faceGroup 에 추가됩니다 (y=0 = 몸통 꼭대기).
   *
   * @param {number} topR  몸통 최상단 반지름 (0.22)
   */
  _buildHair(topR) {
    const COUNT   = 7;
    const hairMat = new THREE.MeshPhongMaterial({ color: 0x111111 });

    for (let i = 0; i < COUNT; i++) {
      const angle  = (i / COUNT) * Math.PI * 2;
      const spread = topR * 0.62;   // 반지름의 62% 범위로 퍼뜨림

      const hairGeo = new THREE.CylinderGeometry(0.016, 0.028, 0.38, 6, 1);
      const hair    = new THREE.Mesh(hairGeo, hairMat);

      // y = 0.19: 머리털 길이(0.38)의 절반만큼 몸통 꼭대기 위로
      hair.position.set(
        Math.sin(angle) * spread,
        0.19,
        Math.cos(angle) * spread
      );
      // 약간 바깥쪽으로 기울어지도록
      hair.rotation.x =  Math.cos(angle) * 0.30;
      hair.rotation.z =  Math.sin(angle) * 0.30;

      this._faceGroup.add(hair);
    }

    // 머리띠 (흰색 토러스 링 — 몸통 꼭대기를 두름)
    const ringGeo = new THREE.TorusGeometry(topR * 0.86, 0.024, 8, 20);
    const ringMat = new THREE.MeshPhongMaterial({ color: 0xFFFFFF, shininess: 60 });
    const ring    = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.0;     // 몸통 꼭대기 y=0 에 위치
    ring.rotation.x = Math.PI / 2;   // 수평으로 눕힘
    this._faceGroup.add(ring);
  }

  // ── 모자 ──────────────────────────────────────────────────────────────────

  /**
   * 선택된 hatStyle 에 맞는 모자를 만듭니다.
   * _faceGroup 에 추가됩니다 (y=0 = 몸통 꼭대기).
   *
   * @param {number} topR  몸통 최상단 반지름 (0.22)
   */
  _buildHat(topR) {
    const idx = this.config.hatStyle - 1;
    if (idx < 0 || idx >= HAT_IMAGES.length) return;

    const hatPlane = new THREE.PlaneGeometry(0.58, 0.48);  // 지전보다 조금 작게
    const hatMat   = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false, depthTest: false,
    });
    const hatMesh = new THREE.Mesh(hatPlane, hatMat);
    hatMesh.renderOrder = 999;
    // y=0.10: 몸통 꼭대기 바로 위 (지전보다 낙추고 작아짐)
    hatMesh.position.set(0, 0.10, topR + 0.05);
    this._faceGroup.add(hatMesh);

    this._loadEyeTexture(HAT_IMAGES[idx], tex => {
      if (!hatMesh) return;
      hatMat.map = tex; hatMat.opacity = 1; hatMat.needsUpdate = true;
    });
  }

  // ── 몸통 장식 ─────────────────────────────────────────────────────────────

  /** 몸통 하단에 장식 이미지를 원본 비율로 배치합니다. */
  _buildDecoration() {
    const idx = this.config.decoration - 1;
    if (idx < 0 || idx >= DECO_IMAGES.length) return;

    const BODY_BOT_Y = 0.55;  // 받침대 위 = 몸통 기준점
    const BODY_H     = 3.8;

    // 장식 중심을 몸통 하단 20% 높이에 배치
    const DECO_HR     = 0.18;  // 모든 물체 중 가장 아래에 가까운 파도
    const decoWorldY  = BODY_BOT_Y + BODY_H * DECO_HR;

    this._decoGroup = new THREE.Group();
    this._decoGroup.position.set(0, decoWorldY, 0);
    this.group.add(this._decoGroup);

    // 이미지 로드 후 원본 비율로 plane 생성
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!this._decoGroup) return;

      const aspect = img.naturalWidth / img.naturalHeight;
      // 높이를 1.0 기준으로 고정하고 너비를 비율로 계산
      const planeH = 1.0;
      const planeW = planeH * aspect;

      const texture = new THREE.Texture(img);
      texture.needsUpdate = true;
      if (typeof THREE.SRGBColorSpace !== 'undefined') {
        texture.colorSpace = THREE.SRGBColorSpace;
      }

      const dPlane = new THREE.PlaneGeometry(planeW, planeH);
      const dMat   = new THREE.MeshBasicMaterial({
        map:         texture,
        transparent: true,
        side:        THREE.DoubleSide,
        depthWrite:  false,
        depthTest:   false,
      });
      const dMesh = new THREE.Mesh(dPlane, dMat);
      dMesh.renderOrder = 999;
      // 몸통 쥜(world +z 방향) 바로 앞에 배치 (body radius ≈ 0.30 이하)
      dMesh.position.set(0, 0, 0.38);
      this._decoGroup.add(dMesh);
    };
    img.onerror = () => {
      console.warn('[AirDancer] 장식 이미지 로드 실패:', DECO_IMAGES[idx]);
    };
    img.src = DECO_IMAGES[idx];
  }

  // =============================================================================
  // 애니메이션
  // =============================================================================

  /**
   * _animateBody()
   *
   * 매 프레임 몸통 꼭짓점(vertex)을 sin 파도로 이동시킵니다.
   * 아래에서 위로 갈수록 더 크게 흔들려 풍선처럼 보입니다.
   *
   * [핵심 개선]
   *   - 꼭짓점 변형과 동일한 파도 공식으로 각 높이의 X/Z 오프셋을 계산합니다.
   *   - 몸통 꼭대기(hr=1.0)의 오프셋 → faceGroup 위치에 반영
   *   - 어깨 높이(hr=0.78)의 오프셋 → 팔 피벗 위치에 반영
   *   이렇게 하면 팔/얼굴/모자가 몸통에 딱 붙어 같이 움직입니다.
   */
  _animateBody() {
    if (!this._bodyMesh || !this._bodyOrigPos) return;

    const pos    = this._bodyMesh.geometry.attributes.position;
    const orig   = this._bodyOrigPos;
    const t      = this.time;
    const HEIGHT = 3.8;
    const baseY  = -HEIGHT / 2;   // 실린더 로컬 좌표 최솟값 (-1.9)
    const amp    = 0.13 * Math.max(0.4, this.intensity);
    
    // 몸통 기울임을 훨씬 강하게 반영 (0.20 -> 1.5)
    // 사용자가 좌우로 크게 움직일 때 몸통이 뚜렷하게 기울도록 함
    const tilt   = this.motionTilt * 1.5;

    for (let i = 0; i < pos.count; i++) {
      const ox = orig.getX(i);
      const oy = orig.getY(i);
      const oz = orig.getZ(i);

      // 높이 비율: 0(아래) ~ 1(위)
      const hr    = Math.max(0, (oy - baseY) / HEIGHT);
      
      // 기울기(tilt)는 위로 갈수록 더 큰 영향을 미치도록 hr 적용
      const waveX = Math.sin(t * 2.8 + oy * 2.0) * amp * hr + tilt * hr;
      const waveZ = Math.sin(t * 2.1 + oy * 1.6 + 1.4) * amp * 0.45 * hr;

      pos.setXYZ(i, ox + waveX, oy, oz + waveZ);
    }

    // GPU 에 변경된 꼭짓점 업로드 신호
    pos.needsUpdate = true;
    // 꼭짓점 이동 후 조명 계산용 법선 재계산
    this._bodyMesh.geometry.computeVertexNormals();

    // ── 얼굴/팔 위치를 몸통 파도에 맞게 동기화 ────────────────────────────
    // 몸통 꼭대기 높이(로컬 y = HEIGHT/2)에서의 X/Z 오프셋 계산
    const topLocalY  = HEIGHT / 2;   // 실린더 로컬 y 최상단
    const hrTop      = 1.0;
    const topWaveX   = Math.sin(t * 2.8 + topLocalY * 2.0) * amp * hrTop + tilt * hrTop;
    const topWaveZ   = Math.sin(t * 2.1 + topLocalY * 1.6 + 1.4) * amp * 0.45 * hrTop;

    // 어깨 높이(hr = 0.78) 에서의 X/Z 오프셋
    const shoulderLocalY = baseY + HEIGHT * 0.78;
    const hrShoulder     = 0.78;
    const shoulderWaveX  = Math.sin(t * 2.8 + shoulderLocalY * 2.0) * amp * hrShoulder + tilt * hrShoulder;
    const shoulderWaveZ  = Math.sin(t * 2.1 + shoulderLocalY * 1.6 + 1.4) * amp * 0.45 * hrShoulder;

    // faceGroup / 팔 피벗 월드 공간 동기화
    // ★ _bodyMesh.rotation.y = Math.PI 이므로 로컬 공간의 X/Z 변위가
    //    월드 공간에서는 부호가 반전됩니다: 로컬 +waveX → 월드 -waveX
    //    따라서 faceGroup/pivot 위치에는 음수를 더해야 몸통 움직임과 일치합니다.
    if (this._faceGroup) {
      this._faceGroup.position.x = -topWaveX;
      this._faceGroup.position.z = -topWaveZ;
    }

    const SHOULDER_R = 0.24;
    if (this._leftPivot) {
      this._leftPivot.position.x  = -SHOULDER_R - shoulderWaveX;
      this._leftPivot.position.z  = -shoulderWaveZ;
    }
    if (this._rightPivot) {
      this._rightPivot.position.x = SHOULDER_R - shoulderWaveX;
      this._rightPivot.position.z = -shoulderWaveZ;
    }

    // 장식 위치 동기화 (hr=DECO_HR 높이)
    const DECO_HR      = 0.18;
    const decoLocalY   = baseY + HEIGHT * DECO_HR;
    const decoWaveX    = Math.sin(t * 2.8 + decoLocalY * 2.0) * amp * DECO_HR + tilt * DECO_HR;
    const decoWaveZ    = Math.sin(t * 2.1 + decoLocalY * 1.6 + 1.4) * amp * 0.45 * DECO_HR;
    if (this._decoGroup) {
      this._decoGroup.position.x = -decoWaveX;
      this._decoGroup.position.z = -decoWaveZ;
    }
  }

  /**
   * _animateArms()
   *
   * 팔 피벗을 회전시켜 팔을 흔듭니다.
   * motionLeft/Right (웹캠 모션) 값이 클수록 팔이 더 높이 올라갑니다.
   * 위치는 _animateBody()에서 몸통 파도에 맞게 이미 설정됩니다.
   */
  _animateArms() {
    if (!this._leftPivot || !this._rightPivot) return;

    const t     = this.time;
    // 자동 스윙(혼자 흔들리는 정도)을 완전히 최소화하여 기본적으로 차렷/가만히 있는 상태로 만듦
    // 숨쉬는 정도의 미세한 흔들림만 남김
    const swing = 0.05 * Math.max(0.4, this.intensity);

    // motionLeft, motionRight 값이 팔을 들어올리는 주된 요인이 됨 (0 ~ 1 범위 -> 각도로 매핑)
    // -1.0 (기본 차렷 자세와 유사한 각도) ~ 2.5 (팔을 번쩍 든 각도) 정도로 매핑
    const leftAngle  =  Math.sin(t * 3.1 + 0.4) * swing - 0.5 + this.motionLeft * 2.8;
    this._leftPivot.rotation.z  =  leftAngle;

    // 오른쪽 팔은 대칭이므로 각도 반전
    const rightAngle = Math.sin(t * 3.1 + Math.PI + 0.4) * swing + 0.5 - this.motionRight * 2.8;
    this._rightPivot.rotation.z = rightAngle;
  }

  /**
   * _animateFace()
   *
   * 얼굴 그룹의 미세한 독립 움직임.
   * 위치 동기화는 _animateBody()에서 처리하므로
   * 여기서는 작은 회전만 추가합니다.
   */
  _animateFace() {
    if (!this._faceGroup) return;
    const t = this.time;
    // 회전만 추가 (위치는 _animateBody에서 동기화)
    this._faceGroup.rotation.z = Math.sin(t * 2.15 + 0.9) * 0.04;
    this._faceGroup.rotation.x = Math.sin(t * 1.75)       * 0.03;
  }

  // =============================================================================
  // 실시간 업데이트 헬퍼
  // =============================================================================

  /**
   * updateColor()
   *
   * 몸통 색깔(colorIndex)이 바뀔 때 호출합니다.
   * 몸통 텍스처를 새로 만들어 교체합니다 (형태 재생성 없음).
   */
  updateColor() {
    if (this._bodyMesh) {
      if (this._bodyMesh.material.map) {
        this._bodyMesh.material.map.dispose();
      }
      const newTex = this._makeBodyTexture();
      this._bodyMesh.material.map         = newTex;
      this._bodyMesh.material.emissiveMap = newTex;  // emissive에도 동일 텍스처 적용
      this._bodyMesh.material.needsUpdate = true;
    }
    this.updateArmColor();
  }

  /**
   * updateArmColor()
   *
   * 팔 색깔(armColorIndex)이 바뀔 때 호출합니다.
   * 팔 메쉬의 재질 색만 바꿉니다 (형태 재생성 없음).
   */
  updateArmColor() {
    const c = this.armColor.body;
    if (this._leftArmMesh)  this._leftArmMesh.material.color.setHex(c);
    if (this._rightArmMesh) this._rightArmMesh.material.color.setHex(c);
  }

  /**
   * rebuild()
   *
   * 표정·모자·장식 등 형태가 바뀌면 전체를 재생성합니다.
   * 씬에 이미 추가된 경우 씬 연결을 유지하면서 교체합니다.
   */
  rebuild() {
    if (!this.group) return;
    const parent = this.group.parent;   // 현재 씬 참조 보관
    if (parent) parent.remove(this.group);
    this._disposeGroup();
    this.buildGroup();
    if (parent) parent.add(this.group);
  }

  // =============================================================================
  // 메모리 정리
  // =============================================================================

  /**
   * Three.js 의 Geometry 와 Material 은 JS 가비지 컬렉터가 자동으로 처리하지 못합니다.
   * dispose() 를 직접 호출해야 GPU 메모리가 해제됩니다.
   */
  _disposeGroup() {
    if (!this.group) return;

    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      }
    });

    this.group         = null;
    this._bodyMesh     = null;
    this._leftPivot    = this._rightPivot   = null;
    this._leftArmMesh  = this._rightArmMesh = null;
    this._faceGroup    = null;
    this._decoGroup    = null;
    this._bodyOrigPos  = null;
  }

  // =============================================================================
  // 직렬화 (저장 / 불러오기)
  // =============================================================================

  toConfig() {
    return { ...this.config };
  }

  static fromConfig(cfg) {
    return new AirDancer(cfg);
  }
}

// =============================================================================
// 섹션 3: DancerScene 클래스
// =============================================================================

/**
 * DancerScene
 *
 * 인형 한 마리를 화면에 표시하는 Three.js 씬입니다.
 * create.html 과 dance.html 에서 사용됩니다.
 */
class DancerScene {

  constructor(containerEl) {
    this.container = containerEl;
    this.dancer    = null;
    this._rafId    = null;

    try {
      if (typeof THREE === 'undefined') {
        throw new Error('Three.js 가 로드되지 않았습니다. CDN 스크립트 태그를 확인하세요.');
      }
      this._initRenderer();
      this._initScene();
      this._initCamera();
      this._initLights();
      this._initFloor();
      this._watchResize();
    } catch (err) {
      console.error('[DancerScene] 초기화 실패:', err);
      containerEl.innerHTML =
        `<div style="color:#ff4444;padding:24px;font-family:monospace;">
           ⚠ 3D 렌더링 오류: ${err.message}
         </div>`;
    }
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const w = this.container.clientWidth  || 300;
    const h = this.container.clientHeight || 450;
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    this.scene.fog = new THREE.Fog(0xffffff, 14, 32);
  }

  _initCamera() {
    const w = this.container.clientWidth  || 300;
    const h = this.container.clientHeight || 450;
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 60);
    this.camera.position.set(0, 2.2, 8.5);
    this.camera.lookAt(0, 2.8, 0);
  }

  _initLights() {
    // 앱비언트: 아주 약하게 유지해서 그림자 영역이 진하게 보이도록
    const ambient = new THREE.AmbientLight(0xffffff, 0.08);
    this.scene.add(ambient);

    // 메인: 좌상단 강한 직사광 — 하이라이트 생성
    const mainLight = new THREE.DirectionalLight(0xffffff, 2.8);
    mainLight.position.set(3.5, 10, 6);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width  = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near   = 1;
    mainLight.shadow.camera.far    = 30;
    mainLight.shadow.bias          = -0.002;
    this.scene.add(mainLight);

    // 림 라이트: 우측 뒤에서 실루엣 강조 — 양감의 핵심
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
    rimLight.position.set(-4, 5, -7);
    this.scene.add(rimLight);

    // 보조 필: 아주 약하게만 바닥 수직 방향
    const fillLight = new THREE.DirectionalLight(0xccddff, 0.25);
    fillLight.position.set(-2, 1, 3);
    this.scene.add(fillLight);
  }

  _initFloor() {
    // 화이트 바닥 평면
    const planeGeo = new THREE.PlaneGeometry(20, 20);
    const planeMat = new THREE.MeshStandardMaterial({
      color:     0xf8f8f8,
      roughness: 0.55,
      metalness: 0.0,
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x    = -Math.PI / 2;
    plane.receiveShadow = true;
    this.scene.add(plane);

    // 미세한 그리드 선 (gray, 화이트 바닥에 녹아들)
    const grid = new THREE.GridHelper(20, 28, 0xdddddd, 0xe8e8e8);
    grid.position.y = 0.002;
    this.scene.add(grid);
  }

  _watchResize() {
    window.addEventListener('resize', () => {
      if (!this.container || !this.renderer) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w === 0 || h === 0) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  setDancer(dancer) {
    if (this.dancer && this.dancer.group) {
      this.scene.remove(this.dancer.group);
    }
    this.dancer = dancer;
    if (!dancer.group) dancer.buildGroup();
    this.scene.add(dancer.group);
  }

  start() {
    if (this._rafId) return;
    let last = performance.now();

    const loop = (now) => {
      this._rafId = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (this.dancer) this.dancer.update(dt);
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };

    requestAnimationFrame(loop);
  }

  stop() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  dispose() {
    this.stop();
    if (this.dancer) this.dancer._disposeGroup();
    if (this.renderer) this.renderer.dispose();
  }
}

// =============================================================================
// 섹션 4: PlazaScene 클래스
// =============================================================================

/**
 * PlazaScene
 *
 * 여러 인형을 X축 방향으로 나열하고 드래그로 카메라를 이동시키는 갤러리 씬입니다.
 * gallery.html 에서 사용됩니다.
 */
class PlazaScene {

  constructor(containerEl) {
    this.container  = containerEl;
    this._rafId     = null;
    this._entries   = [];
    this.selectedId = null;
    this.onSelect   = null;
    this.placeMode  = false;
    this.onPlace    = null;

    this._camTargetX  = 0;
    this._camCurrentX = 0;
    this._dragging    = false;
    this._dragStartX  = 0;
    this._dragStartCamX = 0;

    try {
      if (typeof THREE === 'undefined') throw new Error('Three.js 가 로드되지 않았습니다.');
      this._initRenderer();
      this._initScene();
      this._initCamera();
      this._initLights();
      this._initFloor();
      this._initInteraction();
      this._watchResize();
    } catch (err) {
      console.error('[PlazaScene] 초기화 실패:', err);
      containerEl.innerHTML =
        `<div style="color:#ff4444;padding:24px;font-family:monospace;">
           ⚠ 갤러리 렌더링 오류: ${err.message}
         </div>`;
    }
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const w = this.container.clientWidth  || 800;
    const h = this.container.clientHeight || 400;
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    this.scene.fog = new THREE.FogExp2(0xffffff, 0.025);
  }

  _initCamera() {
    const w = this.container.clientWidth  || 800;
    const h = this.container.clientHeight || 400;
    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 80);
    this.camera.position.set(0, 4.5, 9.5);
    this.camera.lookAt(0, 2, 0);
  }

  _initLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.08);
    this.scene.add(ambient);

    const main = new THREE.DirectionalLight(0xffffff, 2.8);
    main.position.set(4, 10, 6);
    main.castShadow = true;
    main.shadow.camera.left   = -25;
    main.shadow.camera.right  =  25;
    main.shadow.camera.top    =  15;
    main.shadow.camera.bottom = -5;
    main.shadow.mapSize.set(2048, 2048);
    main.shadow.bias = -0.002;
    this.scene.add(main);

    const rim = new THREE.DirectionalLight(0xffffff, 1.2);
    rim.position.set(-4, 5, -7);
    this.scene.add(rim);

    const fill = new THREE.DirectionalLight(0xccddff, 0.25);
    fill.position.set(-2, 1, 3);
    this.scene.add(fill);
  }

  _initFloor() {
    const planeGeo = new THREE.PlaneGeometry(100, 18);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0xf8f8f8, roughness: 0.55, metalness: 0.0,
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x    = -Math.PI / 2;
    plane.receiveShadow = true;
    this.scene.add(plane);

    const grid = new THREE.GridHelper(100, 50, 0xdddddd, 0xe8e8e8);
    grid.position.y = 0.002;
    this.scene.add(grid);
  }

  _initInteraction() {
    const el = this.renderer.domElement;

    el.addEventListener('mousedown', (e) => {
      this._dragging      = true;
      this._dragStartX    = e.clientX;
      this._dragStartCamX = this._camTargetX;
      this._dragMoved     = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._dragStartX;
      if (Math.abs(dx) > 3) this._dragMoved = true;
      this._camTargetX = this._dragStartCamX - dx * 0.016;
    });

    document.addEventListener('mouseup', (e) => {
      if (this._dragging && !this._dragMoved) this._handleClick(e);
      this._dragging = false;
    });

    el.addEventListener('touchstart', (e) => {
      this._dragging      = true;
      this._dragStartX    = e.touches[0].clientX;
      this._dragStartCamX = this._camTargetX;
      this._dragMoved     = false;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!this._dragging) return;
      const dx = e.touches[0].clientX - this._dragStartX;
      if (Math.abs(dx) > 5) this._dragMoved = true;
      this._camTargetX = this._dragStartCamX - dx * 0.016;
    }, { passive: true });

    document.addEventListener('touchend', () => { this._dragging = false; });

    el.addEventListener('wheel', (e) => {
      this._camTargetX += e.deltaY * 0.009;
    }, { passive: true });
  }

  _handleClick(e) {
    const el   = this.renderer.domElement;
    const rect = el.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  *  2 - 1,
      ((e.clientY - rect.top)  / rect.height) * -2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    if (this.placeMode) {
      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const target     = new THREE.Vector3();
      raycaster.ray.intersectPlane(floorPlane, target);
      if (this.onPlace) this.onPlace(target.x);
      return;
    }

    const meshes = [];
    this._entries.forEach(entry => {
      if (entry.dancer.group) {
        entry.dancer.group.traverse(obj => { if (obj.isMesh) meshes.push(obj); });
      }
    });

    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length > 0) {
      const hitObj = hits[0].object;

      // 만약 빌딩을 클릭했다면 링크를 새 탭으로 엽니다.
      if (hitObj.userData && hitObj.userData.isBuilding && hitObj.userData.url) {
        window.open(hitObj.userData.url, '_blank');
        // 빌딩 클릭 시 인형 선택도 같이 처리하려면 아래 로직을 계속 타게 둡니다.
      }

      const entry  = this._entries.find(en => {
        let found = false;
        if (en.dancer.group) en.dancer.group.traverse(o => { if (o === hitObj) found = true; });
        return found;
      });
      if (entry) {
        this.selectedId = entry.id;
        if (this.onSelect) this.onSelect(entry);
      }
    } else {
      this.selectedId = null;
      if (this.onSelect) this.onSelect(null);
    }
  }

  _watchResize() {
    window.addEventListener('resize', () => {
      if (!this.container || !this.renderer) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w === 0 || h === 0) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  loadDancers(configs) {
    this._entries.forEach(e => {
      if (e.dancer.group) this.scene.remove(e.dancer.group);
    });
    this._entries = [];

    configs.forEach((cfg, idx) => {
      const dancer = new AirDancer(cfg);
      dancer.buildGroup();
      const x = cfg.x !== undefined ? cfg.x / 55 : idx * 4.5 - configs.length * 2;
      dancer.group.position.set(x, 0, 0);
      dancer.time = idx * 0.65;
      this.scene.add(dancer.group);
      this._entries.push({ dancer, config: cfg, x, id: cfg.id });
    });
  }

  addDancer(cfg) {
    const dancer = new AirDancer(cfg);
    dancer.buildGroup();
    const x = cfg.x !== undefined ? cfg.x / 55 : 0;
    dancer.group.position.set(x, 0, 0);
    this.scene.add(dancer.group);
    this._entries.push({ dancer, config: cfg, x, id: cfg.id });
  }

  updateDancerPosition(id, worldX) {
    const entry = this._entries.find(e => e.id === id);
    if (entry && entry.dancer.group) {
      const x3d = worldX / 55;
      entry.dancer.group.position.x = x3d;
      entry.x = x3d;
    }
  }

  focusOnDancer(id) {
    const entry = this._entries.find(e => e.id === id);
    if (entry) this._camTargetX = entry.x;
  }

  get _camLimits() {
    if (this._entries.length === 0) return { min: -8, max: 8 };
    const xs = this._entries.map(e => e.x);
    return { min: Math.min(...xs) - 5, max: Math.max(...xs) + 5 };
  }

  start() {
    if (this._rafId) return;
    let last = performance.now();

    const loop = (now) => {
      this._rafId = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      this._entries.forEach(e => e.dancer.update(dt));

      const lim = this._camLimits;
      this._camTargetX  = Math.max(lim.min, Math.min(lim.max, this._camTargetX));
      this._camCurrentX += (this._camTargetX - this._camCurrentX) * 0.08;

      this.camera.position.x = this._camCurrentX;
      this.camera.lookAt(this._camCurrentX, 2.2, 0);

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };

    requestAnimationFrame(loop);
  }

  stop() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  dispose() {
    this.stop();
    this._entries.forEach(e => e.dancer._disposeGroup());
    if (this.renderer) this.renderer.dispose();
  }
}

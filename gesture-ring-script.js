/* ===================================
   GESTURE RING — MAIN JAVASCRIPT
   =================================== */

// ============================================
// GLOBAL STATE
// ============================================

const DEFAULT_GESTURE_MAP = {
    media: {
        'rotate-cw':  'VOL_UP',
        'rotate-ccw': 'VOL_DOWN',
        'tap-single': 'PLAY_PAUSE',
        'tap-double': 'NEXT',
        'tap-triple': 'PREV',
        'long-press': 'MODE_PRESENTATION'
    },
    presentation: {
        'rotate-cw':  'SLIDE_NEXT',
        'rotate-ccw': 'SLIDE_PREV',
        'tap-single': 'SELECT',
        'tap-double': 'NEXT',
        'tap-triple': 'PREV',
        'long-press': 'MODE_DEFAULT'
    }
};

const AppState = {
    currentSection: 'landing',
    currentView: 'live',
    currentContext: 'media',
    currentGesture: 'idle',
    timeline: [],
    ringScene: null,
    liveRingScene: null,
    bleDevice: null,
    bleCharacteristic: null,
    isBleConnected: false,
    simulationInterval: null,
    gestureResetTimer: null,
    heroResizeHandler: null,
    liveResizeHandler: null,
    gestureMap: JSON.parse(JSON.stringify(DEFAULT_GESTURE_MAP))
};

const BLE_CONFIG = {
    deviceName: 'SmartRing',
    serviceUUID: '12345678-1234-1234-1234-123456789abc',
    characteristicUUID: 'abcd1234-ab12-ab12-ab12-abcdef123456'
};

const MEDIA_BRIDGE_URL = 'http://localhost:3199/command';

// Firmware sends these fixed tokens. This table maps each token to which
// gestureMap input key it corresponds to, so we can look up the user's
// current remapped action instead of using a hardcoded action.
//
// THE CORE FIX for "remapping not working":
// Previously handleCommand() had its own hardcoded cmdToGesture table and
// hardcoded mediaCmds list — these completely bypassed AppState.gestureMap.
// Now every inbound BLE token is resolved through the gestureMap, so
// whatever the user remapped in the UI is actually what gets executed.
const FIRMWARE_TOKEN_TO_INPUT = {
    // Media mode tokens
    VOL_UP:     'rotate-cw',
    VOL_DOWN:   'rotate-ccw',
    PLAY_PAUSE: 'tap-single',
    NEXT:       'tap-double',
    PREV:       'tap-triple',
    // Presentation mode tokens (same button actions, different context)
    SLIDE_NEXT: 'rotate-cw',
    SLIDE_PREV: 'rotate-ccw',
    SELECT:     'tap-single'
};

const COMMAND_LABELS = {
    VOL_UP:            'Volume Up',
    VOL_DOWN:          'Volume Down',
    PLAY_PAUSE:        'Play / Pause',
    NEXT:              'Next Track',
    PREV:              'Previous Track',
    SELECT:            'Select',
    SLIDE_NEXT:        'Next Slide',
    SLIDE_PREV:        'Previous Slide',
    MODE_DEFAULT:      'Switch to Media Mode',
    MODE_PRESENTATION: 'Switch to Presentation Mode',
    SCROLL_UP:         'Scroll Up',
    SCROLL_DOWN:       'Scroll Down'
};

// Maps a remapped action command to what the media bridge expects.
// Some web-app actions (SLIDE_NEXT) become scroll keys at the OS level.
const ACTION_TO_BRIDGE = {
    VOL_UP:            'VOL_UP',
    VOL_DOWN:          'VOL_DOWN',
    PLAY_PAUSE:        'PLAY_PAUSE',
    NEXT:              'NEXT',
    PREV:              'PREV',
    SELECT:            'PLAY_PAUSE',   // closest OS key
    SLIDE_NEXT:        'SCROLL_UP',
    SLIDE_PREV:        'SCROLL_DOWN'
};

// Visual gesture name to show in the ring animation when an action fires
const ACTION_TO_VISUAL = {
    VOL_UP:            'rotate-right',
    VOL_DOWN:          'rotate-left',
    SLIDE_NEXT:        'rotate-right',
    SLIDE_PREV:        'rotate-left',
    PLAY_PAUSE:        'tap',
    SELECT:            'tap',
    NEXT:              'swipe-right',
    PREV:              'swipe-left',
    MODE_DEFAULT:      'mode',
    MODE_PRESENTATION: 'mode'
};

const COMMAND_ICONS = {
    VOL_UP:'🔊', VOL_DOWN:'🔉', PLAY_PAUSE:'⏯️', NEXT:'⏭️', PREV:'⏮️',
    SELECT:'✅', SLIDE_NEXT:'📄', SLIDE_PREV:'📄',
    MODE_DEFAULT:'🎛️', MODE_PRESENTATION:'🎛️',
    SCROLL_UP:'⬆️', SCROLL_DOWN:'⬇️'
};

let lastRotationTime = 0;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initParticleBackground();
    initHero3DRing();
    setupNavigation();
    initBleControls();
    setupContextSwitching();
    renderGestureMapEditor();
    renderLiveMappingBadges();
    setupNavScrollShrink();
});

// ============================================
// NAVBAR RESIZING ON SCROLL
// ============================================

function setupNavScrollShrink() {
    const mainInterface = document.getElementById('main-interface');
    const topNav = document.querySelector('.top-nav');
    
    if (!mainInterface || !topNav) return;

    mainInterface.addEventListener('scroll', () => {
        if (mainInterface.scrollTop > 50) {
            topNav.classList.add('shrink');
        } else {
            topNav.classList.remove('shrink');
        }
    });

    // Also check window scroll, in case the scrolling cascades differently on mobile
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            topNav.classList.add('shrink');
        } else {
            topNav.classList.remove('shrink');
        }
    });
}

// ============================================
// PARTICLE BACKGROUND
// ============================================

function initParticleBackground() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const particles = [];
    for (let i = 0; i < 100; i++) particles.push(newParticle(canvas));

    function newParticle(cv) {
        return {
            x: Math.random() * cv.width,
            y: Math.random() * cv.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            r:  Math.random() * 2 + 1,
            o:  Math.random() * 0.5 + 0.2
        };
    }

    (function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(99,102,241,${p.o})`;
            ctx.fill();
        });
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const d  = Math.sqrt(dx*dx + dy*dy);
                if (d < 150) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(99,102,241,${0.15*(1-d/150)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    })();
}

// ============================================
// 3D RING — HERO
// ============================================

function initHero3DRing() {
    const container = document.getElementById('ring-container-3d');
    if (!container) return;

    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    camera.position.z = 8;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pl1 = new THREE.PointLight(0x6366f1, 2, 100); pl1.position.set(5,5,5); scene.add(pl1);
    const pl2 = new THREE.PointLight(0xa78bfa, 1.5, 100); pl2.position.set(-5,-5,5); scene.add(pl2);

    const ringGroup = new THREE.Group();
    const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(2, 0.3, 32, 100),
        new THREE.MeshStandardMaterial({ color:0x6366f1, metalness:0.8, roughness:0.2, emissive:0x4f46e5, emissiveIntensity:0.3 })
    );
    const glowRing = new THREE.Mesh(
        new THREE.TorusGeometry(2, 0.35, 32, 100),
        new THREE.MeshBasicMaterial({ color:0xa78bfa, transparent:true, opacity:0.3 })
    );
    const sensingZone = new THREE.Mesh(
        new THREE.SphereGeometry(3.5, 32, 32),
        new THREE.MeshBasicMaterial({ color:0x6366f1, transparent:true, opacity:0.05, wireframe:true })
    );
    ringGroup.add(outerRing, glowRing, sensingZone);
    scene.add(ringGroup);
    AppState.ringScene = { scene, camera, renderer, ringGroup, glowRing };

    let time = 0;
    (function animate() {
        requestAnimationFrame(animate);
        time += 0.01;
        ringGroup.rotation.x = Math.sin(time * 0.5) * 0.3;
        ringGroup.rotation.y += 0.01;
        glowRing.material.opacity = 0.2 + Math.sin(time * 2) * 0.1;
        sensingZone.scale.setScalar(1 + Math.sin(time * 1.5) * 0.05);
        renderer.render(scene, camera);
    })();

    if (!AppState.heroResizeHandler) {
        AppState.heroResizeHandler = () => {
            if (container.offsetWidth > 0) {
                camera.aspect = container.offsetWidth / container.offsetHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.offsetWidth, container.offsetHeight);
            }
        };
        window.addEventListener('resize', AppState.heroResizeHandler);
    }
    simulateGestureDetection();
}

// ============================================
// 3D RING — LIVE VIEW
// ============================================

function initLiveRing() {
    const container = document.getElementById('live-ring-container');
    if (!container || AppState.liveRingScene) return;

    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    camera.position.z = 6;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pl = new THREE.PointLight(0x6366f1, 2, 100); pl.position.set(3,3,3); scene.add(pl);

    const ringGroup = new THREE.Group();
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.5, 0.25, 32, 100),
        new THREE.MeshStandardMaterial({ color:0x6366f1, metalness:0.9, roughness:0.1, emissive:0x4f46e5, emissiveIntensity:0.5 })
    );
    ringGroup.add(ring);

    const posArr = new Float32Array(150);
    for (let i = 0; i < 150; i++) posArr[i] = (Math.random() - 0.5) * 5;
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color:0xa78bfa, size:0.05, transparent:true, opacity:0.6 }));
    scene.add(particles, ringGroup);

    AppState.liveRingScene = { scene, camera, renderer, ringGroup, ring, particles };

    (function animate() {
        requestAnimationFrame(animate);
        ringGroup.rotation.y += 0.005;
        particles.rotation.y -= 0.002;
        renderer.render(scene, camera);
    })();

    if (!AppState.liveResizeHandler) {
        AppState.liveResizeHandler = () => {
            if (container.offsetWidth > 0) {
                camera.aspect = container.offsetWidth / container.offsetHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.offsetWidth, container.offsetHeight);
            }
        };
        window.addEventListener('resize', AppState.liveResizeHandler);
    }
}

function disposeLiveRing() {
    if (!AppState.liveRingScene) return;
    AppState.liveRingScene.renderer.dispose();
    const c = document.getElementById('live-ring-container');
    if (c) c.innerHTML = '';
    AppState.liveRingScene = null;
}

// ============================================
// HERO ANIMATION SIMULATION
// ============================================

function simulateGestureDetection() {
    const gestures = ['swipe-left','swipe-right','tap','rotate','idle'];
    let idx = 0;
    if (AppState.simulationInterval) clearInterval(AppState.simulationInterval);
    AppState.simulationInterval = setInterval(() => {
        if (AppState.currentSection !== 'landing') return;
        idx = (idx + 1) % gestures.length;
        const g = gestures[idx];
        if (g !== 'idle') triggerHeroGestureEffect(g);
    }, 4000);
}

function triggerHeroGestureEffect(gesture) {
    if (!AppState.ringScene) return;
    const { ringGroup, glowRing } = AppState.ringScene;
    switch (gesture) {
        case 'swipe-left':  animateSwipe(ringGroup, -1); break;
        case 'swipe-right': animateSwipe(ringGroup, 1);  break;
        case 'tap':         animateTap(glowRing);         break;
        case 'rotate':      animateRotate(ringGroup);     break;
    }
}

// ============================================
// ANIMATION HELPERS
// ============================================

function animateSwipe(ringGroup, dir) {
    ringGroup.rotation.z = 0;
    const target = dir * Math.PI / 4;
    const t0 = Date.now();
    (function go() {
        const p = Math.min((Date.now()-t0)/500,1);
        ringGroup.rotation.z = target * easeOutCubic(p);
        if (p < 1) { requestAnimationFrame(go); return; }
        setTimeout(() => {
            const t1 = Date.now();
            (function back() {
                const p2 = Math.min((Date.now()-t1)/500,1);
                ringGroup.rotation.z = target*(1-easeOutCubic(p2));
                if (p2 < 1) requestAnimationFrame(back); else ringGroup.rotation.z = 0;
            })();
        }, 200);
    })();
}

function animateTap(glowRing) {
    const base = glowRing.material.opacity;
    const t0 = Date.now();
    (function go() {
        const p = Math.min((Date.now()-t0)/300,1);
        glowRing.material.opacity = p < 0.5 ? base+(0.8-base)*(p*2) : 0.8-(0.8-base)*((p-0.5)*2);
        if (p < 1) requestAnimationFrame(go);
    })();
}

function animateRotate(ringGroup) {
    const s = ringGroup.rotation.y, t = s + Math.PI;
    const t0 = Date.now();
    (function go() {
        const p = Math.min((Date.now()-t0)/1000,1);
        ringGroup.rotation.y = s+(t-s)*easeInOutCubic(p);
        if (p < 1) requestAnimationFrame(go);
    })();
}

function animateJump(ringGroup) {
    const sy = ringGroup.position.y;
    const t0 = Date.now();
    (function go() {
        const p = Math.min((Date.now()-t0)/400,1);
        ringGroup.position.y = sy + Math.sin(p*Math.PI)*0.5;
        if (p < 1) requestAnimationFrame(go); else ringGroup.position.y = sy;
    })();
}

function animateSpin(ringGroup) {
    const s = ringGroup.rotation.y, t = s + Math.PI*2;
    const t0 = Date.now();
    (function go() {
        const p = Math.min((Date.now()-t0)/800,1);
        ringGroup.rotation.y = s+(t-s)*easeInOutCubic(p);
        if (p < 1) requestAnimationFrame(go);
    })();
}

function easeOutCubic(t)   { return 1-Math.pow(1-t,3); }
function easeInOutCubic(t) { return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }

// ============================================
// NAVIGATION
// ============================================

function enterExperience() {
    document.getElementById('landing-page').classList.remove('active');
    setTimeout(() => {
        document.getElementById('main-interface').classList.add('active');
        AppState.currentSection = 'main';
        if (AppState.simulationInterval) { clearInterval(AppState.simulationInterval); AppState.simulationInterval = null; }
        initLiveRing();
    }, 300);
}

function backToLanding() {
    document.getElementById('main-interface').classList.remove('active');
    setTimeout(() => {
        document.getElementById('landing-page').classList.add('active');
        AppState.currentSection = 'landing';
        simulateGestureDetection();
        disposeLiveRing();
    }, 300);
}

function setupNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => tab.addEventListener('click', () => {
        const v = tab.getAttribute('data-view');
        switchView(v);
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    }));
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const t = document.getElementById(`${viewName}-view`);
    if (!t) return;
    t.classList.add('active');
    AppState.currentView = viewName;
    if (viewName === 'live') setTimeout(() => initLiveRing(), 100);
    else disposeLiveRing();
}

// ============================================
// CONTEXT MODE SWITCHING
// ============================================

function setupContextSwitching() {
    document.querySelectorAll('.context-btn').forEach(btn =>
        btn.addEventListener('click', () => switchContext(btn.getAttribute('data-context')))
    );
    document.querySelectorAll('.live-mode-btn').forEach(btn =>
        btn.addEventListener('click', () => switchContext(btn.getAttribute('data-context')))
    );
    switchContext(AppState.currentContext);
}

function switchContext(contextName) {
    AppState.currentContext = contextName;

    // Sync all mode toggle buttons
    document.querySelectorAll('.context-btn,.live-mode-btn').forEach(b =>
        b.classList.toggle('active', b.getAttribute('data-context') === contextName)
    );

    // Sync context panels
    document.querySelectorAll('.context-panel').forEach(p => p.classList.remove('active'));
    const panel = document.querySelector(`.context-panel[data-panel="${contextName}"]`);
    if (panel) panel.classList.add('active');

    renderLiveMappingBadges();

    // Tell the firmware which mode it should be in so button presses fire
    // the correct token (VOL_UP vs SLIDE_NEXT etc.)
    if (AppState.isBleConnected && AppState.bleCharacteristic) {
        const cmd = contextName === 'media' ? 'MODE_DEFAULT' : 'MODE_PRESENTATION';
        sendBLE(cmd);
    }
}

function cycleContextMode() {
    const order = ['media','presentation'];
    switchContext(order[(order.indexOf(AppState.currentContext)+1)%order.length]);
}

// ============================================
// GESTURE MAP EDITOR
// ============================================

const ASSIGNABLE_ACTIONS = {
    media:        ['VOL_UP','VOL_DOWN','PLAY_PAUSE','NEXT','PREV','MODE_PRESENTATION'],
    presentation: ['SLIDE_NEXT','SLIDE_PREV','SELECT','NEXT','PREV','MODE_DEFAULT']
};

const GESTURE_INPUT_LABELS = {
    'rotate-cw':  'Rotate Clockwise',
    'rotate-ccw': 'Rotate Counter-clockwise',
    'tap-single': 'Single Tap',
    'tap-double': 'Double Tap',
    'tap-triple': 'Triple Tap',
    'long-press': 'Long Press'
};

function renderGestureMapEditor() {
    ['media','presentation'].forEach(ctx => {
        const container = document.getElementById(`map-editor-${ctx}`);
        if (!container) return;
        container.innerHTML = '';
        const map     = AppState.gestureMap[ctx];
        const actions = ASSIGNABLE_ACTIONS[ctx];

        Object.entries(GESTURE_INPUT_LABELS).forEach(([inputKey, inputLabel]) => {
            const row = document.createElement('div');
            row.className = 'map-editor-row';

            const lbl = document.createElement('span');
            lbl.className   = 'map-editor-label';
            lbl.textContent = inputLabel;

            const sel = document.createElement('select');
            sel.className = 'map-editor-select';

            actions.forEach(action => {
                const opt = document.createElement('option');
                opt.value       = action;
                opt.textContent = COMMAND_LABELS[action] || action;
                if (map[inputKey] === action) opt.selected = true;
                sel.appendChild(opt);
            });

            sel.addEventListener('change', () => {
                // Update the in-memory map immediately — all subsequent BLE
                // commands from the ring will now use this updated map.
                AppState.gestureMap[ctx][inputKey] = sel.value;
                renderLiveMappingBadges();
                // No need to send to firmware — firmware sends fixed tokens,
                // the web app resolves them through gestureMap at receive time.
            });

            row.appendChild(lbl);
            row.appendChild(sel);
            container.appendChild(row);
        });
    });
}

function resetGestureMap() {
    AppState.gestureMap = JSON.parse(JSON.stringify(DEFAULT_GESTURE_MAP));
    renderGestureMapEditor();
    renderLiveMappingBadges();
}

function renderLiveMappingBadges() {
    const ctx       = AppState.currentContext;
    const map       = AppState.gestureMap[ctx];
    const container = document.getElementById('live-mapping-badges');
    if (!container) return;
    container.innerHTML = '';
    Object.entries(map).forEach(([input, action]) => {
        const badge = document.createElement('div');
        badge.className = 'live-badge';
        badge.innerHTML = `
            <span class="live-badge-input">${GESTURE_INPUT_LABELS[input]}</span>
            <span class="live-badge-arrow">→</span>
            <span class="live-badge-action">${COMMAND_LABELS[action] || action}</span>`;
        container.appendChild(badge);
    });
}

// ============================================
// RING TESTER
// ============================================

// Fires a gesture through the full pipeline using the CURRENT gestureMap,
// so the tester always reflects whatever mapping is active.
function testGesture(inputKey) {
    const ctx    = AppState.currentContext;
    const action = AppState.gestureMap[ctx][inputKey];
    if (!action) return;

    const visual = ACTION_TO_VISUAL[action] || 'tap';
    processGestureInput(visual, action, 'tester');

    // Send to OS bridge as well so tester is useful even without hardware
    const bridgeCmd = ACTION_TO_BRIDGE[action];
    if (bridgeCmd) sendSystemMediaCommand(bridgeCmd);
}

// ============================================
// GESTURE PROCESSING — CORE PIPELINE
// ============================================

// processGestureInput now takes an explicit `action` string so the response
// card, icon, and timeline always show the *remapped* action, not a guess.
function processGestureInput(visualGesture, action, source) {
    AppState.currentGesture = visualGesture;
    updateGestureDisplay(visualGesture);
    animateConfidence();

    if (AppState.liveRingScene) triggerLiveRingGesture(visualGesture);

    updateResponseCard(action);
    flashGestureUI();
    addToTimeline(visualGesture, action, source || 'ring');

    clearTimeout(AppState.gestureResetTimer);
    AppState.gestureResetTimer = setTimeout(() => {
        AppState.currentGesture = 'idle';
        const cg = document.getElementById('current-gesture');
        const cf = document.getElementById('confidence-fill');
        const cv = document.getElementById('confidence-value');
        if (cg) cg.textContent = 'Idle';
        if (cf) cf.style.width = '0%';
        if (cv) cv.textContent = '0%';
    }, 3000);
}

function flashGestureUI() {
    const card = document.querySelector('.response-card');
    if (!card) return;
    card.style.transform = 'scale(1.05)';
    card.style.boxShadow = '0 0 25px rgba(99,102,241,0.6)';
    setTimeout(() => { card.style.transform='scale(1)'; card.style.boxShadow=''; }, 150);
}

function updateGestureDisplay(gesture) {
    const el = document.getElementById('current-gesture');
    if (!el) return;
    const names = {
        'swipe-left':'Swipe Left','swipe-right':'Swipe Right','tap':'Tap',
        'rotate':'Rotate','rotate-left':'Rotate Left','rotate-right':'Rotate Right',
        'mode':'Mode Switch'
    };
    el.textContent = names[gesture] || gesture;
}

function animateConfidence() {
    const fill = document.getElementById('confidence-fill');
    const val  = document.getElementById('confidence-value');
    if (!fill || !val) return;
    const target = 85 + Math.random()*15;
    const t0     = Date.now();
    (function go() {
        const p = Math.min((Date.now()-t0)/500,1);
        const c = target*easeOutCubic(p);
        fill.style.width  = `${c}%`;
        val.textContent   = `${Math.round(c)}%`;
        if (p < 1) requestAnimationFrame(go);
    })();
}

function triggerLiveRingGesture(gesture) {
    if (!AppState.liveRingScene) return;
    const { ringGroup, ring } = AppState.liveRingScene;
    const orig = ring.material.color.getHex();
    ring.material.color.setHex(0xa78bfa);
    ring.material.emissiveIntensity = 1;
    setTimeout(() => { ring.material.color.setHex(orig); ring.material.emissiveIntensity = 0.5; }, 500);
    switch (gesture) {
        case 'swipe-left':
        case 'rotate-left':  animateSwipe(ringGroup,-1); break;
        case 'swipe-right':
        case 'rotate-right': animateSwipe(ringGroup,1);  break;
        case 'tap':          animateJump(ringGroup);      break;
        case 'rotate':
        case 'mode':         animateSpin(ringGroup);      break;
    }
}

// updateResponseCard now receives the resolved action directly
function updateResponseCard(action) {
    const card     = document.getElementById('response-display');
    const iconEl   = card ? card.querySelector('.response-icon') : null;
    const textEl   = card ? card.querySelector('.response-text') : null;
    const actionEl = document.getElementById('current-action');
    const modeEl   = document.getElementById('current-mode');
    const ctx      = AppState.currentContext;

    const label = COMMAND_LABELS[action] || action;
    const icon  = COMMAND_ICONS[action] || '🤚';

    if (iconEl)   iconEl.textContent   = icon;
    if (textEl)   textEl.textContent   = label;
    if (actionEl) actionEl.textContent = label;
    if (modeEl)   modeEl.textContent   = ctx.charAt(0).toUpperCase() + ctx.slice(1);

    if (card) {
        card.classList.add('active');
        setTimeout(() => card.classList.remove('active'), 2500);
    }
}

function addToTimeline(gesture, action, source) {
    const timeline = document.getElementById('timeline-items');
    if (!timeline) return;
    const ts    = new Date().toLocaleTimeString();
    const gName = { 'swipe-left':'Swipe Left','swipe-right':'Swipe Right','tap':'Tap',
                    'rotate':'Rotate','rotate-left':'Rotate Left','rotate-right':'Rotate Right','mode':'Mode Switch' };
    const item  = document.createElement('div');
    item.className = 'timeline-item';
    item.innerHTML = `<span class="timeline-time">${ts}</span><span class="timeline-content">${gName[gesture]||gesture} → ${COMMAND_LABELS[action]||action} (${source})</span>`;
    timeline.insertBefore(item, timeline.firstChild);
    while (timeline.children.length > 10) timeline.removeChild(timeline.lastChild);
}

// ============================================
// BLE
// ============================================

function initBleControls() {
    const btn = document.getElementById('connect-ring-btn');
    if (btn) {
        btn.addEventListener('click', (e) => {
            // Magic UI Ripple Effect
            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            
            btn.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);

            handleConnect();
        });
    }
    setConnected(false);
}

function setConnectionStatus(state, label) {
    const el  = document.getElementById('ble-connection-status');
    const btn = document.getElementById('connect-ring-btn');
    if (!el || !btn) return;
    el.textContent = label;
    el.classList.remove('disconnected','connecting','connected');
    el.classList.add(state);
    if (state === 'connected')       { btn.textContent = 'Disconnect Ring'; btn.disabled = false; }
    else if (state === 'connecting') { btn.textContent = 'Connecting…';     btn.disabled = true;  }
    else                             { btn.textContent = 'Connect Ring';    btn.disabled = false; }
}

function setConnected(state) {
    AppState.isBleConnected = state;
    setConnectionStatus(
        state ? 'connected' : 'disconnected',
        state ? 'Connected ✅' : 'Disconnected ❌'
    );
}

async function handleConnect() {
    if (AppState.isBleConnected) { disconnectBLE(); return; }
    if (!navigator.bluetooth) { alert('Web Bluetooth not supported. Use Chrome or Edge over HTTPS.'); return; }
    try {
        setConnectionStatus('connecting', 'Connecting…');
        AppState.bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{ name: BLE_CONFIG.deviceName }],
            optionalServices: [BLE_CONFIG.serviceUUID]
        });
        AppState.bleDevice.addEventListener('gattserverdisconnected', onDisconnected);
        const server   = await AppState.bleDevice.gatt.connect();
        const service  = await server.getPrimaryService(BLE_CONFIG.serviceUUID);
        AppState.bleCharacteristic = await service.getCharacteristic(BLE_CONFIG.characteristicUUID);
        await AppState.bleCharacteristic.startNotifications();
        AppState.bleCharacteristic.addEventListener('characteristicvaluechanged', onBLEData);
        setConnected(true);
        // Sync current mode to firmware on connect
        await sendBLE(AppState.currentContext === 'media' ? 'MODE_DEFAULT' : 'MODE_PRESENTATION');
    } catch (err) {
        console.error('BLE connect failed:', err);
        setConnected(false);
    }
}

function disconnectBLE() {
    if (AppState.bleDevice && AppState.bleDevice.gatt.connected) AppState.bleDevice.gatt.disconnect();
}

function onDisconnected() {
    if (!AppState.isBleConnected) return;
    setConnected(false);
}

function onBLEData(event) {
    const cmd = new TextDecoder('utf-8').decode(event.target.value).trim();
    handleCommand(cmd);
}

// ─── handleCommand — THE CORE FIX ────────────────────────────────────────────
//
// Previously this function had hardcoded logic:
//   const mediaCmds = ['PLAY_PAUSE','NEXT','PREV','VOL_UP','VOL_DOWN'];
//   if (context === 'media' && mediaCmds.includes(cmd)) sendSystemMediaCommand(cmd);
// This completely bypassed AppState.gestureMap, so remapping in the UI had
// no effect on what actually happened when the ring fired a command.
//
// New flow:
//  1. Firmware sends a fixed token (e.g. "VOL_UP")
//  2. FIRMWARE_TOKEN_TO_INPUT maps it to the gestureMap input key ("rotate-cw")
//  3. gestureMap[context]["rotate-cw"] gives the user's remapped action (e.g. "NEXT")
//  4. ACTION_TO_BRIDGE maps that action to the OS-level command sent to the bridge
//  5. ACTION_TO_VISUAL gives the 3D animation style
//
// Now changing a dropdown in the Gesture Mapping view immediately affects what
// the OS receives the next time the ring fires that gesture.
function handleCommand(cmd) {
    // Mode switches are firmware→web sync events, not remappable gestures
    if (cmd === 'MODE_DEFAULT') {
        AppState.currentContext = 'media';
        switchContext('media');
        processGestureInput('mode', 'MODE_DEFAULT', 'ring');
        return;
    }
    if (cmd === 'MODE_PRESENTATION') {
        AppState.currentContext = 'presentation';
        switchContext('presentation');
        processGestureInput('mode', 'MODE_PRESENTATION', 'ring');
        return;
    }

    // Step 1: firmware token → gestureMap input key
    const inputKey = FIRMWARE_TOKEN_TO_INPUT[cmd];
    if (!inputKey) {
        console.warn('[BLE] Unknown command:', cmd);
        return;
    }

    // Step 2: gestureMap input key → user's remapped action
    const ctx    = AppState.currentContext;
    const action = AppState.gestureMap[ctx][inputKey];
    if (!action) {
        console.warn('[BLE] No mapping for', inputKey, 'in', ctx);
        return;
    }

    // Step 3: send remapped action to OS via bridge
    const bridgeCmd = ACTION_TO_BRIDGE[action];
    if (bridgeCmd) {
        sendSystemMediaCommand(bridgeCmd);
    }

    // Rotation rate-limit (UI visual only — bridge already fired above)
    if (inputKey === 'rotate-cw' || inputKey === 'rotate-ccw') {
        const now = Date.now();
        if (now - lastRotationTime < 200) return;
        lastRotationTime = now;
    }

    // Step 4: show visual + timeline using the resolved action
    const visual = ACTION_TO_VISUAL[action] || 'tap';
    processGestureInput(visual, action, 'ring');
}

async function sendSystemMediaCommand(command) {
    try {
        await fetch(MEDIA_BRIDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
        });
    } catch (e) {
        console.error('Media bridge error:', e);
    }
}

async function sendBLE(message) {
    if (!AppState.bleCharacteristic) return;
    try {
        await AppState.bleCharacteristic.writeValueWithResponse(new TextEncoder().encode(message));
    } catch (e) {
        console.error('BLE write failed:', e);
    }
}

// ============================================
// WINDOW EXPORTS
// ============================================

window.enterExperience  = enterExperience;
window.backToLanding    = backToLanding;
window.switchView       = switchView;
window.switchContext    = switchContext;
window.cycleContextMode = cycleContextMode;
window.connectRing      = handleConnect;
window.testGesture      = testGesture;
window.resetGestureMap  = resetGestureMap;

/* ===================================
   GESTURE RING - MAIN JAVASCRIPT
   Three.js 3D Ring + Interaction Logic
   =================================== */

// ============================================
// GLOBAL STATE MANAGEMENT
// ============================================

const AppState = {
    currentSection: 'landing',
    currentView: 'live',
    currentContext: 'presentation',
    currentGesture: 'idle',
    gestureConfidence: 0,
    currentMode: 'General',
    timeline: [],
    ring3D: null,
    ringScene: null,
    liveRingScene: null
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Gesture Ring System Initializing...');
    
    // Initialize landing page components
    initParticleBackground();
    initHero3DRing();
    
    // Set up navigation
    setupNavigation();
    
    // Set up context switching
    setupContextSwitching();
    
    console.log('✅ System Ready');
});

// ============================================
// PARTICLE BACKGROUND (Landing Page)
// ============================================

function initParticleBackground() {
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Particle system
    const particles = [];
    const particleCount = 100;
    
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.radius = Math.random() * 2 + 1;
            this.opacity = Math.random() * 0.5 + 0.2;
        }
        
        update() {
            this.x += this.vx;
            this.y += this.vy;
            
            // Wrap around edges
            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width) this.x = 0;
            if (this.y < 0) this.y = canvas.height;
            if (this.y > canvas.height) this.y = 0;
        }
        
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(99, 102, 241, ${this.opacity})`;
            ctx.fill();
        }
    }
    
    // Create particles
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
    
    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        // Draw connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 150) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 * (1 - distance / 150)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

// ============================================
// 3D RING VISUALIZATION (Three.js)
// ============================================

function initHero3DRing() {
    const container = document.getElementById('ring-container-3d');
    if (!container) return;
    
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    camera.position.z = 8;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const pointLight1 = new THREE.PointLight(0x6366f1, 2, 100);
    pointLight1.position.set(5, 5, 5);
    scene.add(pointLight1);
    
    const pointLight2 = new THREE.PointLight(0xa78bfa, 1.5, 100);
    pointLight2.position.set(-5, -5, 5);
    scene.add(pointLight2);
    
    // Create Ring
    const ringGroup = new THREE.Group();
    
    // Outer ring (main body)
    const outerRingGeometry = new THREE.TorusGeometry(2, 0.3, 32, 100);
    const outerRingMaterial = new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0x4f46e5,
        emissiveIntensity: 0.3
    });
    const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
    ringGroup.add(outerRing);
    
    // Inner glow ring
    const glowRingGeometry = new THREE.TorusGeometry(2, 0.35, 32, 100);
    const glowRingMaterial = new THREE.MeshBasicMaterial({
        color: 0xa78bfa,
        transparent: true,
        opacity: 0.3
    });
    const glowRing = new THREE.Mesh(glowRingGeometry, glowRingMaterial);
    ringGroup.add(glowRing);
    
    // Gesture sensing zone (sphere)
    const sensingZoneGeometry = new THREE.SphereGeometry(3.5, 32, 32);
    const sensingZoneMaterial = new THREE.MeshBasicMaterial({
        color: 0x6366f1,
        transparent: true,
        opacity: 0.05,
        wireframe: true
    });
    const sensingZone = new THREE.Mesh(sensingZoneGeometry, sensingZoneMaterial);
    ringGroup.add(sensingZone);
    
    scene.add(ringGroup);
    
    // Store references
    AppState.ringScene = { scene, camera, renderer, ringGroup, glowRing };
    
    // Animation loop
    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.01;
        
        // Rotate ring
        ringGroup.rotation.x = Math.sin(time * 0.5) * 0.3;
        ringGroup.rotation.y += 0.01;
        
        // Pulse glow
        glowRing.material.opacity = 0.2 + Math.sin(time * 2) * 0.1;
        
        // Pulse sensing zone
        sensingZone.scale.setScalar(1 + Math.sin(time * 1.5) * 0.05);
        
        renderer.render(scene, camera);
    }
    animate();
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (container.offsetWidth > 0) {
            camera.aspect = container.offsetWidth / container.offsetHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.offsetWidth, container.offsetHeight);
        }
    });
    
    // Simulate gesture detection
    simulateGestureDetection();
}

// ============================================
// LIVE RING VISUALIZATION (Main Interface)
// ============================================

function initLiveRing() {
    const container = document.getElementById('live-ring-container');
    if (!container || AppState.liveRingScene) return;
    
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    camera.position.z = 6;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0x6366f1, 2, 100);
    pointLight.position.set(3, 3, 3);
    scene.add(pointLight);
    
    // Create Ring
    const ringGroup = new THREE.Group();
    
    const ringGeometry = new THREE.TorusGeometry(1.5, 0.25, 32, 100);
    const ringMaterial = new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0x4f46e5,
        emissiveIntensity: 0.5
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ringGroup.add(ring);
    
    // Gesture feedback particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 5;
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const particlesMaterial = new THREE.PointsMaterial({
        color: 0xa78bfa,
        size: 0.05,
        transparent: true,
        opacity: 0.6
    });
    
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);
    
    scene.add(ringGroup);
    
    // Store references
    AppState.liveRingScene = { scene, camera, renderer, ringGroup, ring, particles };
    
    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        
        ringGroup.rotation.y += 0.005;
        particles.rotation.y -= 0.002;
        
        renderer.render(scene, camera);
    }
    animate();
    
    // Handle resize
    window.addEventListener('resize', () => {
        if (container.offsetWidth > 0) {
            camera.aspect = container.offsetWidth / container.offsetHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.offsetWidth, container.offsetHeight);
        }
    });
}

// ============================================
// GESTURE SIMULATION & DETECTION
// ============================================

function simulateGestureDetection() {
    const gestures = ['swipe-left', 'swipe-right', 'tap', 'rotate', 'idle'];
    let currentIndex = 0;
    
    setInterval(() => {
        if (AppState.currentSection === 'landing') {
            currentIndex = (currentIndex + 1) % gestures.length;
            const gesture = gestures[currentIndex];
            
            if (gesture !== 'idle') {
                triggerGestureEffect(gesture);
            }
        }
    }, 4000);
}

function triggerGestureEffect(gesture) {
    if (!AppState.ringScene) return;
    
    const { ringGroup, glowRing } = AppState.ringScene;
    
    // Visual feedback based on gesture
    switch(gesture) {
        case 'swipe-left':
            animateSwipe(ringGroup, -1);
            break;
        case 'swipe-right':
            animateSwipe(ringGroup, 1);
            break;
        case 'tap':
            animateTap(glowRing);
            break;
        case 'rotate':
            animateRotate(ringGroup);
            break;
    }
}

function animateSwipe(ringGroup, direction) {
    const startRotation = ringGroup.rotation.z;
    const targetRotation = startRotation + (direction * Math.PI / 4);
    const duration = 500;
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);
        
        ringGroup.rotation.z = startRotation + (targetRotation - startRotation) * eased;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Reset
            setTimeout(() => {
                const resetStart = Date.now();
                function reset() {
                    const elapsed = Date.now() - resetStart;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = easeOutCubic(progress);
                    
                    ringGroup.rotation.z = targetRotation - (targetRotation - startRotation) * eased;
                    
                    if (progress < 1) {
                        requestAnimationFrame(reset);
                    }
                }
                reset();
            }, 200);
        }
    }
    animate();
}

function animateTap(glowRing) {
    const startOpacity = glowRing.material.opacity;
    const duration = 300;
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        if (progress < 0.5) {
            glowRing.material.opacity = startOpacity + (0.8 - startOpacity) * (progress * 2);
        } else {
            glowRing.material.opacity = 0.8 - (0.8 - startOpacity) * ((progress - 0.5) * 2);
        }
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    animate();
}

function animateRotate(ringGroup) {
    const startRotation = ringGroup.rotation.y;
    const targetRotation = startRotation + Math.PI;
    const duration = 1000;
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(progress);
        
        ringGroup.rotation.y = startRotation + (targetRotation - startRotation) * eased;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    animate();
}

// Easing functions
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ============================================
// NAVIGATION & SECTION SWITCHING
// ============================================

function enterExperience() {
    console.log('🎯 Entering main interface...');
    
    // Hide landing page
    const landingPage = document.getElementById('landing-page');
    const mainInterface = document.getElementById('main-interface');
    
    landingPage.classList.remove('active');
    setTimeout(() => {
        mainInterface.classList.add('active');
        AppState.currentSection = 'main';
        
        // Initialize live ring if not already done
        initLiveRing();
    }, 300);
}

function backToLanding() {
    console.log('🏠 Returning to landing page...');
    
    const landingPage = document.getElementById('landing-page');
    const mainInterface = document.getElementById('main-interface');
    
    mainInterface.classList.remove('active');
    setTimeout(() => {
        landingPage.classList.add('active');
        AppState.currentSection = 'landing';
    }, 300);
}

function setupNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const viewName = tab.getAttribute('data-view');
            switchView(viewName);
            
            // Update active tab
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });
}

function switchView(viewName) {
    console.log(`📱 Switching to ${viewName} view`);
    
    // Hide all views
    const views = document.querySelectorAll('.view');
    views.forEach(view => view.classList.remove('active'));
    
    // Show selected view
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.add('active');
        AppState.currentView = viewName;
        
        // Initialize live ring when switching to live view
        if (viewName === 'live') {
            setTimeout(() => initLiveRing(), 100);
        }
    }
}

// ============================================
// GESTURE SIMULATION (User Interaction)
// ============================================

function simulateGesture(gestureType) {
    console.log(`👆 Simulating gesture: ${gestureType}`);
    
    // Update gesture status
    AppState.currentGesture = gestureType;
    updateGestureDisplay(gestureType);
    
    // Animate confidence
    animateConfidence();
    
    // Trigger visual feedback in 3D ring
    if (AppState.liveRingScene) {
        triggerLiveRingGesture(gestureType);
    }
    
    // Update response card
    updateResponseCard(gestureType);
    
    // Add to timeline
    addToTimeline(gestureType);
    
    // Reset after delay
    setTimeout(() => {
        AppState.currentGesture = 'idle';
        document.getElementById('current-gesture').textContent = 'Idle';
        document.getElementById('confidence-fill').style.width = '0%';
        document.getElementById('confidence-value').textContent = '0%';
    }, 3000);
}

function updateGestureDisplay(gesture) {
    const gestureDisplay = document.getElementById('current-gesture');
    const gestureNames = {
        'swipe-left': 'Swipe Left 👈',
        'swipe-right': 'Swipe Right 👉',
        'tap': 'Tap 👆',
        'rotate': 'Rotate 🔄'
    };
    
    gestureDisplay.textContent = gestureNames[gesture] || gesture;
}

function animateConfidence() {
    const confidenceFill = document.getElementById('confidence-fill');
    const confidenceValue = document.getElementById('confidence-value');
    
    let confidence = 0;
    const targetConfidence = 85 + Math.random() * 15; // 85-100%
    const duration = 500;
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);
        
        confidence = targetConfidence * eased;
        confidenceFill.style.width = `${confidence}%`;
        confidenceValue.textContent = `${Math.round(confidence)}%`;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    animate();
}

function triggerLiveRingGesture(gesture) {
    const { ringGroup, ring } = AppState.liveRingScene;
    
    // Change ring color temporarily
    const originalColor = ring.material.color.getHex();
    ring.material.color.setHex(0xa78bfa);
    ring.material.emissiveIntensity = 1;
    
    setTimeout(() => {
        ring.material.color.setHex(originalColor);
        ring.material.emissiveIntensity = 0.5;
    }, 500);
    
    // Gesture-specific animations
    switch(gesture) {
        case 'swipe-left':
            animateSwipe(ringGroup, -1);
            break;
        case 'swipe-right':
            animateSwipe(ringGroup, 1);
            break;
        case 'tap':
            animateJump(ringGroup);
            break;
        case 'rotate':
            animateSpin(ringGroup);
            break;
    }
}

function animateJump(ringGroup) {
    const startY = ringGroup.position.y;
    const duration = 400;
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        if (progress < 0.5) {
            ringGroup.position.y = startY + Math.sin(progress * Math.PI) * 0.5;
        } else {
            ringGroup.position.y = startY + Math.sin(progress * Math.PI) * 0.5;
        }
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            ringGroup.position.y = startY;
        }
    }
    animate();
}

function animateSpin(ringGroup) {
    const startRotation = ringGroup.rotation.y;
    const targetRotation = startRotation + Math.PI * 2;
    const duration = 800;
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(progress);
        
        ringGroup.rotation.y = startRotation + (targetRotation - startRotation) * eased;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    animate();
}

function updateResponseCard(gesture) {
    const responseCard = document.getElementById('response-display');
    const responseIcon = responseCard.querySelector('.response-icon');
    const responseText = responseCard.querySelector('.response-text');
    const currentAction = document.getElementById('current-action');
    const currentMode = document.getElementById('current-mode');
    
    // Gesture mappings based on context
    const actions = {
        'presentation': {
            'swipe-left': { icon: '📊', text: 'Previous Slide', action: 'Navigate Back' },
            'swipe-right': { icon: '📊', text: 'Next Slide', action: 'Navigate Forward' },
            'tap': { icon: '🎯', text: 'Highlight Active', action: 'Toggle Pointer' },
            'rotate': { icon: '🔍', text: 'Zoom Adjusted', action: 'Zoom In/Out' }
        },
        'media': {
            'swipe-left': { icon: '⏮️', text: 'Previous Track', action: 'Media Control' },
            'swipe-right': { icon: '⏭️', text: 'Next Track', action: 'Media Control' },
            'tap': { icon: '⏯️', text: 'Play/Pause', action: 'Toggle Playback' },
            'rotate': { icon: '🔊', text: 'Volume Changed', action: 'Volume Control' }
        },
        'accessibility': {
            'swipe-left': { icon: '🔊', text: 'Previous Item', action: 'Speak Previous' },
            'swipe-right': { icon: '🔊', text: 'Next Item', action: 'Speak Next' },
            'tap': { icon: '📢', text: 'Reading Aloud', action: 'Text-to-Speech' },
            'rotate': { icon: '⚡', text: 'Speed Adjusted', action: 'Speech Rate' }
        },
        'general': {
            'swipe-left': { icon: '👈', text: 'Swipe Left Detected', action: 'Generic Back' },
            'swipe-right': { icon: '👉', text: 'Swipe Right Detected', action: 'Generic Forward' },
            'tap': { icon: '👆', text: 'Tap Detected', action: 'Generic Select' },
            'rotate': { icon: '🔄', text: 'Rotation Detected', action: 'Generic Adjust' }
        }
    };
    
    const context = AppState.currentContext || 'general';
    const mapping = actions[context]?.[gesture] || actions['general'][gesture];
    
    if (mapping) {
        responseIcon.textContent = mapping.icon;
        responseText.textContent = mapping.text;
        currentAction.textContent = mapping.action;
        currentMode.textContent = context.charAt(0).toUpperCase() + context.slice(1);
        
        // Add active state
        responseCard.classList.add('active');
        setTimeout(() => {
            responseCard.classList.remove('active');
        }, 2500);
    }
}

function addToTimeline(gesture) {
    const timeline = document.getElementById('timeline-items');
    const timestamp = new Date().toLocaleTimeString();
    
    const gestureNames = {
        'swipe-left': 'Swipe Left',
        'swipe-right': 'Swipe Right',
        'tap': 'Tap',
        'rotate': 'Rotate'
    };
    
    const timelineItem = document.createElement('div');
    timelineItem.className = 'timeline-item';
    timelineItem.innerHTML = `
        <span class="timeline-time">${timestamp}</span>
        <span class="timeline-content">${gestureNames[gesture]} → Action executed successfully</span>
    `;
    
    // Add to top
    timeline.insertBefore(timelineItem, timeline.firstChild);
    
    // Keep only last 10 items
    while (timeline.children.length > 10) {
        timeline.removeChild(timeline.lastChild);
    }
    
    // Add to state
    AppState.timeline.unshift({
        timestamp,
        gesture,
        action: gestureNames[gesture]
    });
}

// ============================================
// CONTEXT MODE SWITCHING
// ============================================

function setupContextSwitching() {
    const contextButtons = document.querySelectorAll('.context-btn');
    
    contextButtons.forEach(button => {
        button.addEventListener('click', () => {
            const context = button.getAttribute('data-context');
            switchContext(context);
            
            // Update active button
            contextButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
}

function switchContext(contextName) {
    console.log(`🎭 Switching to ${contextName} context`);
    
    AppState.currentContext = contextName;
    
    // Hide all context panels
    const panels = document.querySelectorAll('.context-panel');
    panels.forEach(panel => panel.classList.remove('active'));
    
    // Show selected panel
    const targetPanel = document.querySelector(`.context-panel[data-panel="${contextName}"]`);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Format time
function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString();
}

// Log system events
function logEvent(event, details) {
    console.log(`[${formatTime()}] ${event}:`, details);
}

// ============================================
// EXPORT TO WINDOW (for HTML onclick handlers)
// ============================================

window.enterExperience = enterExperience;
window.backToLanding = backToLanding;
window.simulateGesture = simulateGesture;
window.switchView = switchView;
window.switchContext = switchContext;

// ============================================
// HCI PRINCIPLES LOGGER
// ============================================

// Log HCI principles being demonstrated
console.log(`
╔═══════════════════════════════════════════════════════════╗
║           GESTURE RING - HCI PRINCIPLES                   ║
╠═══════════════════════════════════════════════════════════╣
║ ✓ Visibility of System Status                            ║
║   → Real-time gesture display & confidence levels         ║
║                                                            ║
║ ✓ Immediate Feedback                                      ║
║   → Visual, animated feedback within 100-200ms            ║
║                                                            ║
║ ✓ Natural Mapping                                         ║
║   → Gestures map to physical metaphors                    ║
║                                                            ║
║ ✓ Minimal Cognitive Load                                  ║
║   → Only 4 core gestures to learn                         ║
║                                                            ║
║ ✓ Consistency                                             ║
║   → Same gestures work across all contexts                ║
║                                                            ║
║ ✓ Learnability                                            ║
║   → Visual demonstrations & practice mode                 ║
║                                                            ║
║ ✓ Accessibility                                           ║
║   → Touchless control for motor accessibility             ║
║                                                            ║
║ ✓ Error Prevention                                        ║
║   → Confidence thresholds & clear feedback                ║
╚═══════════════════════════════════════════════════════════╝
`);

console.log('🎨 Design Philosophy: Gesture-first, calm, intuitive, premium');
console.log('🚀 Ready for HCI evaluation and viva demonstration');

/* ===== MAFIA WARS — 3D Emblem (logo finale) =====
   Big rotating logo before the footer. Auto-rotates + reacts to scroll velocity. */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

(function () {
    if (window.__MAFIA_EMBLEM_LOADED) return;
    window.__MAFIA_EMBLEM_LOADED = true;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const container = document.getElementById('emblem-3d');
    if (!container) return;

    // ---- Renderer ----
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // ---- Scene + Camera ----
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 0, 6.5);
    camera.lookAt(0, 0, 0);

    // ---- Lights ----
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 3, 5);
    scene.add(key);

    const rim1 = new THREE.DirectionalLight(0xe21a1a, 3.0);
    rim1.position.set(-3, 2, -3);
    scene.add(rim1);

    const rim2 = new THREE.DirectionalLight(0xff4444, 1.8);
    rim2.position.set(3, -2, -2);
    scene.add(rim2);

    const top = new THREE.PointLight(0xffffff, 0.7, 8);
    top.position.set(0, 3, 2);
    scene.add(top);

    // ---- Root group ----
    const root = new THREE.Group();
    scene.add(root);

    // Loading overlay
    const loadingEl = document.createElement('div');
    loadingEl.className = 'emblem-loading';
    loadingEl.innerHTML = '<div class="char-load-bar"><div class="char-load-fill"></div></div><div class="char-load-text">LOADING EMBLEM</div>';
    container.appendChild(loadingEl);
    const loadFill = loadingEl.querySelector('.char-load-fill');
    const loadText = loadingEl.querySelector('.char-load-text');

    let model = null;

    // ---- Load GLB ----
    const loader = new GLTFLoader();
    loader.load(
        'mafia-emblem.glb',
        (gltf) => {
            model = gltf.scene;

            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // Scale to fit ~2.5 units in largest dimension
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2.5 / maxDim;
            model.scale.setScalar(scale);

            // Center on origin
            model.position.set(
                -center.x * scale,
                -center.y * scale,
                -center.z * scale
            );

            model.traverse((obj) => {
                if (obj.isMesh && obj.material) {
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                    mats.forEach(mat => {
                        if (mat.map && 'colorSpace' in mat.map && THREE.SRGBColorSpace) {
                            mat.map.colorSpace = THREE.SRGBColorSpace;
                        }
                        mat.envMapIntensity = 1.2;
                        mat.needsUpdate = true;
                    });
                }
            });

            root.add(model);
            loadingEl.classList.add('done');
            setTimeout(() => loadingEl.remove(), 600);
            container.classList.add('ready');
        },
        (xhr) => {
            if (xhr.lengthComputable) {
                const pct = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
                loadFill.style.width = pct + '%';
            }
        },
        (err) => {
            console.error('[mafia-emblem] load failed:', err);
            loadText.textContent = 'LOAD FAILED';
        }
    );

    // ---- Sizing ----
    function resize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    resize();

    let rPending = false;
    window.addEventListener('resize', () => {
        if (rPending) return;
        rPending = true;
        requestAnimationFrame(() => { resize(); rPending = false; });
    }, { passive: true });

    // ---- Scroll velocity → spin speed ----
    let lastScrollY = window.scrollY;
    let scrollVel = 0;
    window.addEventListener('scroll', () => {
        scrollVel = window.scrollY - lastScrollY;
        lastScrollY = window.scrollY;
    }, { passive: true });

    // ---- Mouse parallax ----
    let mouseX = 0, mouseY = 0;
    let lookX = 0, lookY = 0;
    container.addEventListener('mousemove', (e) => {
        const r = container.getBoundingClientRect();
        mouseX = ((e.clientX - r.left) / r.width) - 0.5;
        mouseY = ((e.clientY - r.top) / r.height) - 0.5;
    });
    container.addEventListener('mouseleave', () => { mouseX = 0; mouseY = 0; });

    // ---- Render loop ----
    const clock = new THREE.Clock();
    let raf;
    let spinSpeed = 0.5; // base spin

    function animate() {
        const dt = clock.getDelta();
        const t = clock.getElapsedTime();

        // Base spin + scroll-velocity bump
        scrollVel *= 0.9; // decay
        const targetSpin = 0.5 + Math.abs(scrollVel) * 0.05;
        spinSpeed += (targetSpin - spinSpeed) * 0.06;

        if (model && !prefersReduced) {
            root.rotation.y += spinSpeed * dt;
            // Subtle wobble
            root.rotation.x = Math.sin(t * 0.7) * 0.08;
            root.rotation.z = Math.cos(t * 0.5) * 0.04;
        }

        // Mouse parallax — lean toward cursor
        lookX += (mouseX * 0.3 - lookX) * 0.06;
        lookY += (-mouseY * 0.2 - lookY) * 0.06;
        camera.position.x = lookX;
        camera.position.y = lookY;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
    }
    animate();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && raf) { cancelAnimationFrame(raf); raf = null; }
        else if (!document.hidden && !raf) animate();
    });
})();

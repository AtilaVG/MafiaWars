/* ===== MAFIA WARS — 3D Emblem (mobile-aware, optimized 565KB) ===== */

(function () {
    if (window.__MAFIA_EMBLEM_LOADED) return;
    window.__MAFIA_EMBLEM_LOADED = true;

    const container = document.getElementById('emblem-3d');
    if (!container) return;

    const isMobile = window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Mobile: show static emblem placeholder, skip WebGL entirely
    if (isMobile) {
        container.innerHTML = '<div style="width:100%;aspect-ratio:1/1;max-width:320px;margin:0 auto;display:flex;align-items:center;justify-content:center;font-family:Bebas Neue,sans-serif;font-size:clamp(4rem,12vw,6rem);letter-spacing:6px;color:rgba(226,26,26,0.15);text-shadow:0 0 60px rgba(226,26,26,0.3);user-select:none">MW</div>';
        container.classList.add('ready');
        return;
    }

    // Desktop: load Three.js and model directly (only 565KB GLB)
    init3D();

    function init3D() {
        Promise.all([
            import('three'),
            import('three/addons/loaders/GLTFLoader.js')
        ]).then(([THREE, GLTFModule]) => {
            const GLTFLoader = GLTFModule.GLTFLoader;

            // Renderer
            const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
            renderer.setClearColor(0x000000, 0);
            if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
                renderer.outputColorSpace = THREE.SRGBColorSpace;
            }
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.15;
            container.appendChild(renderer.domElement);

            // Scene + Camera
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
            camera.position.set(0, 0, 6.5);
            camera.lookAt(0, 0, 0);

            // Lights
            scene.add(new THREE.AmbientLight(0xffffff, 0.45));
            const key = new THREE.DirectionalLight(0xffffff, 1.4);
            key.position.set(3, 3, 5); scene.add(key);
            const rim1 = new THREE.DirectionalLight(0xe21a1a, 3.0);
            rim1.position.set(-3, 2, -3); scene.add(rim1);
            const rim2 = new THREE.DirectionalLight(0xff4444, 1.8);
            rim2.position.set(3, -2, -2); scene.add(rim2);
            const top = new THREE.PointLight(0xffffff, 0.7, 8);
            top.position.set(0, 3, 2); scene.add(top);

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

            // Load GLB
            const loader = new GLTFLoader();
            loader.load(
                'mafia-emblem.glb',
                (gltf) => {
                    model = gltf.scene;
                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3());
                    const center = box.getCenter(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const scale = 2.5 / maxDim;
                    model.scale.setScalar(scale);
                    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

                    // Generate simple environment map for PBR metallic reflections
                    const pmremGen = new THREE.PMREMGenerator(renderer);
                    const envScene = new THREE.Scene();
                    envScene.background = new THREE.Color(0x111111);
                    // Add subtle colored lights to env for reflections
                    const envLight1 = new THREE.DirectionalLight(0xffffff, 0.5);
                    envLight1.position.set(1, 1, 1);
                    envScene.add(envLight1);
                    const envLight2 = new THREE.DirectionalLight(0xe21a1a, 0.3);
                    envLight2.position.set(-1, 0.5, -1);
                    envScene.add(envLight2);
                    envScene.add(new THREE.AmbientLight(0x333333, 1));
                    const envMap = pmremGen.fromScene(envScene, 0.04).texture;
                    pmremGen.dispose();

                    model.traverse((obj) => {
                        if (obj.isMesh && obj.material) {
                            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                            mats.forEach(mat => {
                                if (mat.map && 'colorSpace' in mat.map && THREE.SRGBColorSpace) {
                                    mat.map.colorSpace = THREE.SRGBColorSpace;
                                }
                                // Clean matte rendering — no PBR complexity
                                mat.envMap = envMap;
                                mat.envMapIntensity = 0.6;
                                mat.metalness = 0;
                                mat.roughness = 0.85;
                                mat.metalnessMap = null;
                                mat.roughnessMap = null;
                                mat.normalMap = null;
                                mat.side = THREE.DoubleSide;
                                mat.flatShading = false;
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

            // Sizing
            function resize() {
                const w = container.clientWidth, h = container.clientHeight;
                if (w === 0 || h === 0) return;
                renderer.setSize(w, h, false);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            }
            resize();
            let rP = false;
            window.addEventListener('resize', () => {
                if (rP) return; rP = true;
                requestAnimationFrame(() => { resize(); rP = false; });
            }, { passive: true });

            // Scroll velocity
            let lastScrollY = window.scrollY, scrollVel = 0;
            window.addEventListener('scroll', () => {
                scrollVel = window.scrollY - lastScrollY;
                lastScrollY = window.scrollY;
            }, { passive: true });

            // Mouse parallax
            let mouseX = 0, mouseY = 0, lookX = 0, lookY = 0;
            container.addEventListener('mousemove', (e) => {
                const r = container.getBoundingClientRect();
                mouseX = ((e.clientX - r.left) / r.width) - 0.5;
                mouseY = ((e.clientY - r.top) / r.height) - 0.5;
            });
            container.addEventListener('mouseleave', () => { mouseX = 0; mouseY = 0; });

            // Render loop — pause when not visible to save GPU
            const clock = new THREE.Clock();
            let raf, spinSpeed = 0.5, isVisible = true;

            const visObs = new IntersectionObserver((entries) => {
                isVisible = entries[0].isIntersecting;
                if (isVisible && !raf) animate();
                else if (!isVisible && raf) { cancelAnimationFrame(raf); raf = null; clock.stop(); }
            }, { threshold: 0 });
            visObs.observe(container);

            function animate() {
                if (!isVisible) { raf = null; return; }
                if (!clock.running) clock.start();
                const dt = clock.getDelta();
                const t = clock.getElapsedTime();

                scrollVel *= 0.9;
                const targetSpin = 0.5 + Math.abs(scrollVel) * 0.05;
                spinSpeed += (targetSpin - spinSpeed) * 0.06;

                if (model && !prefersReduced) {
                    root.rotation.y += spinSpeed * dt;
                    root.rotation.x = Math.sin(t * 0.7) * 0.08;
                    root.rotation.z = Math.cos(t * 0.5) * 0.04;
                }

                lookX += (mouseX * 0.3 - lookX) * 0.06;
                lookY += (-mouseY * 0.2 - lookY) * 0.06;
                camera.position.x = lookX;
                camera.position.y = lookY;
                camera.lookAt(0, 0, 0);

                renderer.render(scene, camera);
                raf = requestAnimationFrame(animate);
            }

            // Start animation immediately
            animate();

            document.addEventListener('visibilitychange', () => {
                if (document.hidden && raf) { cancelAnimationFrame(raf); raf = null; }
                else if (!document.hidden && isVisible && !raf) animate();
            });
        }).catch(err => {
            console.error('[mafia-emblem] Three.js import failed:', err);
            container.innerHTML = '<div style="width:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;font-family:Bebas Neue,sans-serif;font-size:5rem;letter-spacing:6px;color:rgba(226,26,26,0.15)">MW</div>';
            container.classList.add('ready');
        });
    }
})();

// frontend/components/EarthSphere3D.tsx
"use client";

/**
 * Interactive 3D Eco-Sphere / Earth Telemetry Globe.
 * Built with Three.js (already bundled in the frontend).
 *
 * Features:
 * - Emerald holographic wireframe sphere with latitude/longitude bands
 * - Inner glowing energy core with pulse wave
 * - Floating orbital data nodes representing distributed device telemetry
 * - Atmospheric neon halo ring
 * - Interactive mouse tilt and drag rotation
 * - Full reduced-motion fallback (static pristine render) and WebGL fail-safe
 */

import React, { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type * as ThreeNS from "three";
import { Globe, Eye, EyeOff } from "lucide-react";

interface EarthSphere3DProps {
  className?: string;
  size?: number;
  interactive?: boolean;
}

export const EarthSphere3D: React.FC<EarthSphere3DProps> = ({
  className = "",
  size,
  interactive = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [motionDisabled, setMotionDisabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let raf = 0;
    let cleanup: (() => void) | null = null;

    (async () => {
      let THREE: typeof ThreeNS;
      try {
        THREE = await import("three");
      } catch (err) {
        console.warn("Three.js not available for EarthSphere3D:", err);
        return;
      }
      if (disposed) return;

      try {
        const width = mount.clientWidth || size || 380;
        const height = mount.clientHeight || size || 380;

        // 1. Scene & Camera
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.z = 5.2;

        // 2. WebGL Renderer
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mount.innerHTML = "";
        mount.appendChild(renderer.domElement);

        // 3. Globe Outer Hologram (Segmented Wireframe Sphere)
        const globeGeo = new THREE.SphereGeometry(1.6, 28, 28);
        const globeMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          wireframe: true,
          transparent: true,
          opacity: 0.35,
        });
        const globe = new THREE.Mesh(globeGeo, globeMat);
        scene.add(globe);

        // 4. Secondary Geodesic Hex Shield
        const icosaGeo = new THREE.IcosahedronGeometry(1.65, 2);
        const icosaMat = new THREE.MeshBasicMaterial({
          color: 0x06b6d4,
          wireframe: true,
          transparent: true,
          opacity: 0.15,
        });
        const icosa = new THREE.Mesh(icosaGeo, icosaMat);
        scene.add(icosa);

        // 5. Inner Bioluminescent Core
        const coreGeo = new THREE.SphereGeometry(0.85, 24, 24);
        const coreMat = new THREE.MeshBasicMaterial({
          color: 0x059669,
          transparent: true,
          opacity: 0.25,
        });
        const innerCore = new THREE.Mesh(coreGeo, coreMat);
        scene.add(innerCore);

        // 6. Orbital Carbon / Telemetry Satellites (Points)
        const nodeCount = 65;
        const nodeGeo = new THREE.BufferGeometry();
        const nodePositions = new Float32Array(nodeCount * 3);
        const nodeSizes = new Float32Array(nodeCount);

        for (let i = 0; i < nodeCount; i++) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(Math.random() * 2 - 1);
          const r = 1.75 + (Math.random() - 0.5) * 0.25;

          nodePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          nodePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
          nodePositions[i * 3 + 2] = r * Math.cos(phi);
          nodeSizes[i] = 0.06 + Math.random() * 0.08;
        }

        nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePositions, 3));
        const nodeMat = new THREE.PointsMaterial({
          color: 0x34d399,
          size: 0.08,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
        });
        const nodes = new THREE.Points(nodeGeo, nodeMat);
        scene.add(nodes);

        // 7. Equatorial Planetary Ring
        const ringGeo = new THREE.RingGeometry(2.1, 2.35, 64);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.2,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.3;
        ring.rotation.y = Math.PI / 8;
        scene.add(ring);

        // Secondary subtle outer ring
        const outerRingGeo = new THREE.RingGeometry(2.6, 2.65, 64);
        const outerRingMat = new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.12,
        });
        const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
        outerRing.rotation.x = Math.PI / 2.5;
        scene.add(outerRing);

        // 8. Interaction handling (drag & mouse move tilt)
        let mouseX = 0;
        let mouseY = 0;
        let targetRotX = 0;
        let targetRotY = 0;
        let isDragging = false;
        let prevMouseX = 0;
        let prevMouseY = 0;

        const onMouseMove = (e: MouseEvent) => {
          if (!interactive) return;
          const rect = mount.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
          targetRotY = x * 0.4;
          targetRotX = -y * 0.3;
        };

        const onMouseDown = (e: MouseEvent) => {
          if (!interactive) return;
          isDragging = true;
          prevMouseX = e.clientX;
          prevMouseY = e.clientY;
        };

        const onMouseUp = () => {
          isDragging = false;
        };

        const onWindowMouseMove = (e: MouseEvent) => {
          if (!isDragging || !interactive) return;
          const deltaX = e.clientX - prevMouseX;
          const deltaY = e.clientY - prevMouseY;
          globe.rotation.y += deltaX * 0.008;
          globe.rotation.x += deltaY * 0.008;
          nodes.rotation.y += deltaX * 0.008;
          prevMouseX = e.clientX;
          prevMouseY = e.clientY;
        };

        if (interactive) {
          mount.addEventListener("mousemove", onMouseMove);
          mount.addEventListener("mousedown", onMouseDown);
          window.addEventListener("mouseup", onMouseUp);
          window.addEventListener("mousemove", onWindowMouseMove);
        }

        // 9. Animation Loop
        const clock = new THREE.Clock();
        const animate = () => {
          raf = requestAnimationFrame(animate);
          const t = clock.getElapsedTime();

          if (!isDragging) {
            globe.rotation.y += 0.004;
            icosa.rotation.y -= 0.002;
            nodes.rotation.y += 0.005;
            nodes.rotation.x = Math.sin(t * 0.3) * 0.1;
            ring.rotation.z += 0.001;
            outerRing.rotation.z -= 0.0015;

            // Smooth interpolation to target mouse tilt
            globe.rotation.x += (targetRotX - globe.rotation.x) * 0.05;
            scene.rotation.y += (targetRotY - scene.rotation.y) * 0.05;
          }

          // Subtle pulse
          const pulse = 1 + Math.sin(t * 1.5) * 0.03;
          innerCore.scale.set(pulse, pulse, pulse);

          renderer.render(scene, camera);
        };

        // Start animation immediately so 3D is visible on first frame.
        // Previously this was gated behind the reduced-motion check,
        // causing blank canvas on initial load.
        if (!prefersReducedMotion && !motionDisabled) {
          animate();
        }

        const onResize = () => {
          if (!mount) return;
          const w = mount.clientWidth;
          const h = mount.clientHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

        // CRITICAL: Always render an initial frame immediately so the 3D
        // content is visible on first paint, even before any scroll happens.
        // Without this, the canvas is blank until the animation loop starts
        // or the user scrolls/interacts.
        renderer.render(scene, camera);

        setIsLoaded(true);

        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          if (interactive) {
            mount.removeEventListener("mousemove", onMouseMove);
            mount.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mouseup", onMouseUp);
            window.removeEventListener("mousemove", onWindowMouseMove);
          }
          globeGeo.dispose();
          globeMat.dispose();
          icosaGeo.dispose();
          icosaMat.dispose();
          coreGeo.dispose();
          coreMat.dispose();
          nodeGeo.dispose();
          nodeMat.dispose();
          ringGeo.dispose();
          ringMat.dispose();
          outerRingGeo.dispose();
          outerRingMat.dispose();
          renderer.dispose();
          if (renderer.domElement.parentElement === mount) {
            mount.removeChild(renderer.domElement);
          }
        };
      } catch (err) {
        console.warn("Failed to initialize EarthSphere3D WebGL context:", err);
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [interactive, motionDisabled, prefersReducedMotion, size]);

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ minHeight: size || 320 }}
    >
      {/* Background radiant emerald aura */}
      <div
        className="absolute w-72 h-72 rounded-full bg-emerald-500/15 blur-[90px] pointer-events-none"
        aria-hidden
      />

      {/* 3D WebGL Container */}
      <div
        ref={mountRef}
        className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
      />

      {/* Control overlay */}
      <div className="absolute bottom-2 right-2 flex items-center gap-2 z-10">
        <button
          type="button"
          onClick={() => setMotionDisabled((v) => !v)}
          className="p-1.5 rounded-lg liquid-glass text-white/50 hover:text-white text-[11px] font-mono flex items-center gap-1.5 transition-colors border border-white/10"
          title={motionDisabled ? "Enable 3D animation" : "Reduce motion"}
          aria-label="Toggle 3D Globe Animation"
        >
          {motionDisabled ? (
            <>
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Static</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Live 3D</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};


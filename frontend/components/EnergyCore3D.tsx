// frontend/components/EnergyCore3D.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EyeOff, Eye, Zap, Flame, ShieldCheck } from "lucide-react";

interface EnergyCore3DProps {
  cpuUtilization: number | null;
  gpuUtilization?: number | null;
  estimatedPower: number | null;
  isOptimized?: boolean;
}

export const EnergyCore3D: React.FC<EnergyCore3DProps> = ({
  cpuUtilization,
  gpuUtilization = 0,
  estimatedPower,
  isOptimized = false,
}) => {
  const displayPower = estimatedPower ?? 0;
  const displayCpu = cpuUtilization ?? 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (!containerRef.current || reducedMotion) return;

    const width = containerRef.current.clientWidth || 320;
    const height = containerRef.current.clientHeight || 280;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 5.2;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(renderer.domElement);

    // 3. Central Dynamic Wireframe Icosahedron
    const coreColor = isOptimized
      ? 0x10b981
      : displayCpu > 65
      ? 0xf59e0b
      : 0x34d399;

    const coreGeometry = new THREE.IcosahedronGeometry(1.25, 2);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: coreColor,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);

    // 4. Inner Bioluminescent Plasma Sphere
    const innerGeometry = new THREE.SphereGeometry(0.72, 24, 24);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: isOptimized ? 0x059669 : displayCpu > 65 ? 0xef4444 : 0x06b6d4,
      transparent: true,
      opacity: 0.45,
    });
    const innerSphere = new THREE.Mesh(innerGeometry, innerMaterial);
    scene.add(innerSphere);

    // 5. Dual Orbital Torus Energy Bands
    const torusGeo1 = new THREE.TorusGeometry(1.85, 0.02, 16, 100);
    const torusMat1 = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.6,
    });
    const torus1 = new THREE.Mesh(torusGeo1, torusMat1);
    torus1.rotation.x = Math.PI / 3;
    scene.add(torus1);

    const torusGeo2 = new THREE.TorusGeometry(1.85, 0.02, 16, 100);
    const torusMat2 = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.5,
    });
    const torus2 = new THREE.Mesh(torusGeo2, torusMat2);
    torus2.rotation.y = Math.PI / 3;
    scene.add(torus2);

    // 6. Orbital Particle Cloud (Avoided Carbon Cloud)
    const particleCount = 220;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const radius = 2.1;

    for (let i = 0; i < particleCount; i++) {
      const theta = (i / particleCount) * Math.PI * 2;
      const phi = (Math.random() - 0.5) * 1.2;
      positions[i * 3] = (radius + (Math.random() - 0.5) * 0.4) * Math.cos(theta);
      positions[i * 3 + 1] = Math.sin(phi) * 0.8;
      positions[i * 3 + 2] = (radius + (Math.random() - 0.5) * 0.4) * Math.sin(theta);
    }
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: isOptimized ? 0x34d399 : 0x22d3ee,
      size: 0.05,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // 7. Interactive Hover Gyroscope
    let targetX = 0;
    let targetY = 0;
    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetY = x * 0.5;
      targetX = -y * 0.4;
    };
    containerRef.current.addEventListener("mousemove", onMouseMove);

    // 8. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const t = clock.getElapsedTime();

      // Rotation speed calibrated to real CPU and load factors
      const loadFactor = isOptimized ? 0.5 : Math.max(0.6, (displayCpu / 100) * 2.2);

      core.rotation.x += delta * 0.4 * loadFactor;
      core.rotation.y += delta * 0.6 * loadFactor;

      innerSphere.rotation.y -= delta * 0.8 * loadFactor;
      particles.rotation.y += delta * 0.3 * loadFactor;
      particles.rotation.x = Math.sin(t * 0.5) * 0.2;

      torus1.rotation.z += delta * 0.5 * loadFactor;
      torus2.rotation.z -= delta * 0.4 * loadFactor;

      // Pulsate scale dynamically with power draw
      const pulseSpeed = 1.5 * loadFactor;
      const pulse = 1.0 + Math.sin(t * pulseSpeed) * 0.06;
      core.scale.set(pulse, pulse, pulse);

      // Smooth gyroscopic lean
      scene.rotation.y += (targetY - scene.rotation.y) * 0.08;
      scene.rotation.x += (targetX - scene.rotation.x) * 0.08;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener("mousemove", onMouseMove);
      }
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      innerGeometry.dispose();
      innerMaterial.dispose();
      torusGeo1.dispose();
      torusMat1.dispose();
      torusGeo2.dispose();
      torusMat2.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
    };
  }, [displayCpu, gpuUtilization, displayPower, isOptimized, reducedMotion]);

  return (
    <div className="relative w-full h-[300px] liquid-glass rounded-2xl overflow-hidden flex flex-col items-center justify-center p-4 border border-white/10 group">
      <span aria-hidden className="glass-sheen absolute inset-0" />
      {/* Radiant emerald aura */}
      <div
        className="absolute w-56 h-56 rounded-full bg-emerald-500/10 blur-[80px] pointer-events-none"
        aria-hidden
      />

      {/* Top Controls & Status */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-10 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isOptimized
                ? "bg-emerald-400 shadow-glow-green"
                : displayCpu > 65
                ? "bg-amber-400 animate-pulse"
                : "bg-emerald-400"
            }`}
          />
          <span className="font-mono text-white/70 text-[11px] uppercase tracking-wider">
            {isOptimized
              ? "System Calibrated — Harmonic 3D Core"
              : cpuUtilization === null
              ? "Telemetry Syncing"
              : displayCpu > 65
              ? "Elevated Load 3D Core"
              : "Harmonic Equilibrium Core"}
          </span>
        </div>

        <button
          onClick={() => setReducedMotion(!reducedMotion)}
          className="p-1 rounded text-white/50 hover:text-white transition flex items-center gap-1 text-[11px] font-mono liquid-glass px-2 py-0.5 border border-white/10"
          title="Toggle 3D WebGL / Reduced Motion mode"
        >
          {reducedMotion ? (
            <Eye className="w-3 h-3 text-emerald-400" />
          ) : (
            <EyeOff className="w-3 h-3" />
          )}
          <span>{reducedMotion ? "Enable 3D" : "Reduce Motion"}</span>
        </button>
      </div>

      {/* 3D WebGL Canvas Container or Reduced Motion Fallback */}
      {reducedMotion ? (
        <div className="flex flex-col items-center justify-center space-y-3 z-10">
          <div
            className={`w-24 h-24 rounded-full border flex items-center justify-center ${
              isOptimized
                ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-300 shadow-glow-green"
                : "border-white/20 bg-white/5 text-emerald-400"
            }`}
          >
            <Zap className="w-10 h-10" />
          </div>
          <div className="text-center">
            <div className="font-mono text-xl font-bold text-white">
              {estimatedPower === null ? "—" : `${estimatedPower.toFixed(1)} W`}
            </div>
            <div className="text-[11px] text-white/45 font-mono">
              Static Low-Power Mode
            </div>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="w-full h-full cursor-grab" />
      )}

      {/* Bottom Floating Stats HUD */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between z-10 text-[11px] font-mono liquid-glass px-3 py-1.5 rounded-lg border border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-white/45">Inference Draw:</span>
          <span className="text-emerald-300 font-semibold">
            {estimatedPower === null ? "—" : `${estimatedPower.toFixed(1)} W`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/45">Workload:</span>
          <span
            className={
              displayCpu > 60
                ? "text-amber-300 font-semibold"
                : "text-emerald-300 font-semibold"
            }
          >
            {cpuUtilization === null ? "—" : `${displayCpu.toFixed(0)}% CPU`}
            {gpuUtilization != null ? ` / ${gpuUtilization.toFixed(0)}% GPU` : ""}
          </span>
        </div>
      </div>
    </div>
  );
};

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
  isOptimized = false
}) => {
  const displayPower = estimatedPower ?? 0;
  const displayCpu = cpuUtilization ?? 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (!containerRef.current || reducedMotion) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 280;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 5.5;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(renderer.domElement);

    // 3. Central Icosahedron Energy Core
    const coreGeometry = new THREE.IcosahedronGeometry(1.2, 2);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: isOptimized ? 0x00ff88 : (cpuUtilization > 60 ? 0xffaa00 : 0x10b981),
      wireframe: true,
      transparent: true,
      opacity: 0.75
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);

    // 4. Inner Glowing Sphere
    const innerGeometry = new THREE.SphereGeometry(0.7, 16, 16);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: isOptimized ? 0x10b981 : (cpuUtilization > 60 ? 0xff5500 : 0x06b6d4),
      transparent: true,
      opacity: 0.4
    });
    const innerSphere = new THREE.Mesh(innerGeometry, innerMaterial);
    scene.add(innerSphere);

    // 5. Orbital Particle Ring (Carbon & Electron Cloud)
    const particleCount = 180;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const radius = 2.0;

    for (let i = 0; i < particleCount; i++) {
      const theta = (i / particleCount) * Math.PI * 2;
      const phi = (Math.random() - 0.5) * 0.8;
      positions[i * 3] = (radius + (Math.random() - 0.5) * 0.4) * Math.cos(theta);
      positions[i * 3 + 1] = Math.sin(phi) * 0.6;
      positions[i * 3 + 2] = (radius + (Math.random() - 0.5) * 0.4) * Math.sin(theta);
    }
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: isOptimized ? 0x34d399 : 0x06b6d4,
      size: 0.05,
      transparent: true,
      opacity: 0.85
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // 6. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Speed depends on CPU load (calm when optimized or low load, intense when stressed)
      const loadFactor = isOptimized ? 0.4 : Math.max(0.6, (cpuUtilization / 100) * 2.2);
      
      core.rotation.x += delta * 0.4 * loadFactor;
      core.rotation.y += delta * 0.6 * loadFactor;

      innerSphere.rotation.y -= delta * 0.8 * loadFactor;
      particles.rotation.y += delta * 0.3 * loadFactor;
      particles.rotation.x = Math.sin(clock.getElapsedTime() * 0.5) * 0.2;

      // Pulsate scale with power draw
      const pulse = 1.0 + Math.sin(clock.getElapsedTime() * (2.0 * loadFactor)) * 0.06;
      core.scale.set(pulse, pulse, pulse);

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
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      innerGeometry.dispose();
      innerMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
    };
  }, [displayCpu, gpuUtilization, displayPower, isOptimized, reducedMotion]);

  return (
    <div className="relative w-full h-[280px] bg-gradient-to-b from-surface-card/80 to-surface/40 rounded-2xl border border-surface-border overflow-hidden flex flex-col items-center justify-center p-4">
      
      {/* Top Controls & Status */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-10 text-xs">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isOptimized ? "bg-cyber-neon shadow-glow-green" : (displayCpu > 65 ? "bg-amber-400" : "bg-emerald-400")}`} />
          <span className="font-mono text-gray-300 text-[11px] uppercase tracking-wider">
            {isOptimized ? "System Calibrated — Harmonic Core" : (cpuUtilization === null ? "Telemetry Unavailable" : (displayCpu > 65 ? "Elevated Energy Core" : "Equilibrium Energy Core"))}
          </span>
        </div>

        <button
          onClick={() => setReducedMotion(!reducedMotion)}
          className="p-1 rounded text-gray-400 hover:text-white transition flex items-center gap-1 text-[11px] font-mono bg-surface-elevated/60 px-2 py-0.5 border border-surface-border"
          title="Toggle 3D WebGL / Reduced Motion mode"
        >
          {reducedMotion ? <Eye className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3" />}
          <span>{reducedMotion ? "Enable 3D" : "Reduce Motion"}</span>
        </button>
      </div>

      {/* 3D WebGL Canvas Container or Reduced Motion Fallback */}
      {reducedMotion ? (
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className={`w-24 h-24 rounded-full border-2 flex items-center justify-center ${
            isOptimized ? "border-cyber-neon bg-emerald-950/40 text-cyber-neon shadow-glow-green" : "border-emerald-500 bg-surface-card text-emerald-300"
          }`}>
            <Zap className="w-10 h-10" />
          </div>
          <div className="text-center">
            <div className="font-mono text-xl font-bold text-white">{estimatedPower === null ? "Unavailable" : `${estimatedPower.toFixed(1)} W`}</div>
            <div className="text-[11px] text-gray-400">Static Low-Power Mode</div>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="w-full h-full" />
      )}

      {/* Bottom Floating Stats HUD */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between z-10 text-[11px] font-mono bg-surface/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-surface-border">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Core Power:</span>
          <span className="text-cyber-neon font-semibold">{estimatedPower === null ? "Unavailable" : `${estimatedPower.toFixed(1)} W`}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Workload State:</span>
          <span className={cpuUtilization > 60 ? "text-amber-400 font-semibold" : "text-emerald-400 font-semibold"}>
            {cpuUtilization === null ? "Unavailable" : `${displayCpu.toFixed(0)}% CPU`} / {gpuUtilization == null ? "Unavailable" : `${gpuUtilization.toFixed(0)}% GPU`}
          </span>
        </div>
      </div>

    </div>
  );
};

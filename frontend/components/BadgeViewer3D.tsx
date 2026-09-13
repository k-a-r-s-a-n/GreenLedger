// frontend/components/BadgeViewer3D.tsx
"use client";

/**
 * 3D Holographic Badge Showcase.
 * Renders an interactive, floating multi-faceted crystal medallion in Three.js.
 * Responds to pointer hover with gyroscopic tilt, particle sparkles, and
 * tier-based light dynamics (Legendary gold, Epic purple, Rare cyan, Standard emerald).
 */

import React, { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type * as ThreeNS from "three";

interface BadgeViewer3DProps {
  rarity?: "Common" | "Rare" | "Epic" | "Legendary" | string;
  isUnlocked?: boolean;
  isMinted?: boolean;
  size?: number;
  className?: string;
}

export const BadgeViewer3D: React.FC<BadgeViewer3DProps> = ({
  rarity = "Common",
  isUnlocked = false,
  isMinted = false,
  size = 140,
  className = "",
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

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
      } catch {
        return;
      }
      if (disposed) return;

      try {
        const width = size;
        const height = size;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.z = 4.2;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mount.innerHTML = "";
        mount.appendChild(renderer.domElement);

        // Color mapping by rarity
        let primaryColor = 0x10b981; // emerald
        let glowColor = 0x34d399;
        if (rarity === "Legendary") {
          primaryColor = 0xf59e0b; // gold
          glowColor = 0xfcd34d;
        } else if (rarity === "Epic") {
          primaryColor = 0xa855f7; // purple
          glowColor = 0xd8b4fe;
        } else if (rarity === "Rare") {
          primaryColor = 0x06b6d4; // cyan
          glowColor = 0x67e8f9;
        }

        if (!isUnlocked) {
          primaryColor = 0x52525b; // muted zinc
          glowColor = 0x71717a;
        }

        // 1. Crystal Medallion (Octahedron / Dodecahedron)
        const badgeGeo = new THREE.OctahedronGeometry(1.2, 0);
        const badgeMat = new THREE.MeshStandardMaterial({
          color: primaryColor,
          roughness: 0.15,
          metalness: isMinted ? 0.9 : 0.6,
          wireframe: !isUnlocked,
          transparent: true,
          opacity: isUnlocked ? 0.9 : 0.4,
        });
        const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
        scene.add(badgeMesh);

        // 2. Facet Wireframe Rim for crisp holographic edges
        const wireGeo = new THREE.OctahedronGeometry(1.22, 0);
        const wireMat = new THREE.MeshBasicMaterial({
          color: glowColor,
          wireframe: true,
          transparent: true,
          opacity: isUnlocked ? 0.85 : 0.25,
        });
        const wireMesh = new THREE.Mesh(wireGeo, wireMat);
        scene.add(wireMesh);

        // 3. Orbiting Sparkle Halo (if unlocked or minted)
        let particles: ThreeNS.Points | null = null;
        let pGeo: ThreeNS.BufferGeometry | null = null;
        let pMat: ThreeNS.PointsMaterial | null = null;

        if (isUnlocked) {
          const pCount = 30;
          pGeo = new THREE.BufferGeometry();
          const pPositions = new Float32Array(pCount * 3);
          for (let i = 0; i < pCount; i++) {
            const angle = (i / pCount) * Math.PI * 2;
            const rad = 1.6 + (Math.random() - 0.5) * 0.3;
            pPositions[i * 3] = Math.cos(angle) * rad;
            pPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
            pPositions[i * 3 + 2] = Math.sin(angle) * rad;
          }
          pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
          pMat = new THREE.PointsMaterial({
            color: glowColor,
            size: 0.07,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
          });
          particles = new THREE.Points(pGeo, pMat);
          scene.add(particles);
        }

        // 4. Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
        dirLight.position.set(3, 4, 5);
        scene.add(dirLight);

        const pointLight = new THREE.PointLight(glowColor, 2, 8);
        pointLight.position.set(-2, -2, 2);
        scene.add(pointLight);

        // 5. Interactive Gyroscope / Mouse Tracking
        let targetX = 0;
        let targetY = 0;

        const onMouseMove = (e: MouseEvent) => {
          const rect = mount.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
          targetY = x * 0.8;
          targetX = -y * 0.6;
        };

        mount.addEventListener("mousemove", onMouseMove);

        // 6. Animation Loop
        const clock = new THREE.Clock();
        const animate = () => {
          raf = requestAnimationFrame(animate);
          const t = clock.getElapsedTime();

          badgeMesh.rotation.y += 0.015;
          badgeMesh.rotation.x = Math.sin(t * 0.8) * 0.15;
          wireMesh.rotation.y = badgeMesh.rotation.y;
          wireMesh.rotation.x = badgeMesh.rotation.x;

          if (particles) {
            particles.rotation.y += 0.02;
            particles.rotation.z = Math.sin(t * 0.5) * 0.1;
          }

          // Tilt towards cursor
          scene.rotation.y += (targetY - scene.rotation.y) * 0.1;
          scene.rotation.x += (targetX - scene.rotation.x) * 0.1;

          renderer.render(scene, camera);
        };

        if (prefersReducedMotion) {
          renderer.render(scene, camera);
        } else {
          animate();
        }

        cleanup = () => {
          cancelAnimationFrame(raf);
          mount.removeEventListener("mousemove", onMouseMove);
          badgeGeo.dispose();
          badgeMat.dispose();
          wireGeo.dispose();
          wireMat.dispose();
          pGeo?.dispose();
          pMat?.dispose();
          renderer.dispose();
          if (renderer.domElement.parentElement === mount) {
            mount.removeChild(renderer.domElement);
          }
        };
      } catch (err) {
        console.warn("BadgeViewer3D context fail:", err);
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [isMinted, isUnlocked, prefersReducedMotion, rarity, size]);

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <div ref={mountRef} className="w-full h-full cursor-pointer" />
    </div>
  );
};


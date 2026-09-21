// frontend/components/HeroParticles.tsx
"use client";

/**
 * Hero background — GreenLedger's replacement for the reference spec's
 * fading background videos. A slow emerald particle drift rendered with
 * the already-bundled three.js dependency (dynamically imported so it
 * code-splits out of the critical bundle).
 *
 * Adaptation decisions:
 *  - Slow rotation + sine camera drift ≈ the spec's "fading video" motion,
 *    but generated (no asset weight, no loop seam).
 *  - A black gradient mask at the bottom fades particles into the page, the
 *    same way the spec's video overlay faded scenes into black.
 *  - prefers-reduced-motion: particles render but the animation loop never
 *    starts (a single static frame — still cinematic, zero motion).
 *  - WebGL unavailable: renders nothing; the CSS glow field remains.
 */
import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type * as ThreeNS from "three";

export function HeroParticles({ className }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let raf = 0;
    // Assigned inside the async IIFE; the outer cleanup invokes it.
    let cleanup: (() => void) | null = null;

    (async () => {
      let three: typeof ThreeNS;
      try {
        three = await import("three");
      } catch {
        return; // three failed to load — CSS glow fallback stands alone.
      }
      if (disposed) return; // unmounted while the chunk was loading

      let renderer: ThreeNS.WebGLRenderer;
      try {
        const width = mount.clientWidth;
        const height = mount.clientHeight;

        const scene = new three.Scene();
        const camera = new three.PerspectiveCamera(60, width / height, 0.1, 200);
        camera.position.z = 50;

        renderer = new three.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
        renderer.setSize(width, height);
        mount.appendChild(renderer.domElement);

        // Keep the background atmospheric without competing with the hero WebGL sphere.
        const COUNT = 350;
        const positions = new Float32Array(COUNT * 3);
        for (let i = 0; i < COUNT; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 130; // x
          positions[i * 3 + 1] = (Math.random() - 0.5) * 70; // y
          positions[i * 3 + 2] = (Math.random() - 0.5) * 60 - 10; // z
        }
        const geometry = new three.BufferGeometry();
        geometry.setAttribute("position", new three.BufferAttribute(positions, 3));

        const material = new three.PointsMaterial({
          color: 0x34d399,
          size: 0.4,
          transparent: true,
          opacity: 0.5,
          blending: three.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true,
        });

        const points = new three.Points(geometry, material);
        scene.add(points);

        const clock = new three.Clock();

        const animate = () => {
          raf = requestAnimationFrame(animate);
          const t = clock.getElapsedTime();
          points.rotation.y = t * 0.03; // slow drift — the "fading video" stand-in
          camera.position.y = Math.sin(t * 0.15) * 1.5; // gentle breathing
          renderer.render(scene, camera);
        };

        const onResize = () => {
          const w = mount.clientWidth;
          const h = mount.clientHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

        // CRITICAL: Always render an initial frame immediately so particles
        // are visible on first paint. Without this, the canvas stays blank
        // until the animation loop kicks in.
        renderer.render(scene, camera); // initial frame

        if (!prefersReducedMotion) {
          animate();
        }

        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          if (renderer.domElement.parentElement === mount) {
            mount.removeChild(renderer.domElement);
          }
        };
      } catch (err) {
        // WebGL context failure etc. — leave the CSS glow as the backdrop.
        console.warn("HeroParticles disabled:", err);
      }
    })();

    return () => {
      disposed = true; // async init checks nothing further after unmount
      cleanup?.();
    };
  }, [prefersReducedMotion]);

  return (
    <div className={className} aria-hidden>
      <div ref={mountRef} className="absolute inset-0" />
      {/* Bottom fade into pure black — mirrors the reference overlay fade. */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-black" />
      {/* Side vignettes keep the headline zone quiet. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

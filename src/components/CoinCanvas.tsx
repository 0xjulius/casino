'use client';

import { Suspense, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Model } from "./Model"; 

function GlobalMouseRig({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null!);

  // Store normalized mouse coordinates (-1 to 1) across the entire window
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // Convert screen pixels into normalized device coordinates (-1 to 1)
      mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    // Attach listener to window so it captures mouse movement over ALL elements
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useFrame((state, delta) => {
    // Target rotation based on global window mouse position
    const targetY = (mouse.current.x * Math.PI) / 4; 
    const targetX = (-mouse.current.y * Math.PI) / 5;

    // Smooth lerp transition (adjust the multiplier '4' for faster/slower response)
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetX, delta * 4);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetY, delta * 4);

    // Continuous subtle floating animation on the Y-axis
    groupRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 1.5) * 0.15;
  });

  return <group ref={groupRef}>{children}</group>;
}

export default function CoinCanvas() {
  return (
    <div className="w-full h-[180px] sm:h-[220px] relative pointer-events-none pb-4">
      <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10,  10, 5]} intensity={1.5} />
        <Environment preset="city" />

        <Suspense fallback={null}>
          <GlobalMouseRig>
            <Center>
              <Model 
                url="/models/model.glb" 
                scale={0.22} 
                rotation={[-Math.PI / 2, 0, 0]} 
              />
            </Center>
          </GlobalMouseRig>
        </Suspense>
      </Canvas>
    </div>
  );
}
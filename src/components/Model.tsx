import { useGLTF } from "@react-three/drei";
import type { ComponentProps } from "react";

interface ModelProps extends ComponentProps<"group"> {
  url: string;
}

export function Model({ url, ...props }: ModelProps) {
  // Load GLTF/GLB model
  const { scene } = useGLTF(url);

  return <primitive object={scene} {...props} />;
}

// Preload the model for faster rendering
useGLTF.preload("/models/model.glb");
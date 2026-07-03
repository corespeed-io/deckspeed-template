import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { useRenderMode } from "../renderMode";
import type { ThreeNode as ThreeNodeT } from "@deckspeed/deck-schema";
import { applyCommonStyle } from "./commonStyle";
import { acquireSlot } from "./webglPool";

// Detect WebGL support once per module. In jsdom and in the thumbnail
// sandbox this returns false and ThreeNode renders the static gradient
// fallback — see Phase 3 §C17.
function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  if (typeof WebGLRenderingContext === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

// §C17 — each ThreeNode claims a WebGL pool slot on mount and releases on
// unmount. If the pool is full, the oldest ThreeNode gets an evict callback
// that sets `evicted=true` so it renders a placeholder instead of a Canvas.

function Globe() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} />
      <mesh>
        <sphereGeometry args={[1.2, 48, 48]} />
        <meshStandardMaterial color="#4f8cff" wireframe />
      </mesh>
    </>
  );
}

function CubeGrid({ size = 4 }: { size?: number }) {
  const cubes = useMemo(() => {
    const arr: Array<[number, number, number]> = [];
    const half = (size - 1) / 2;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          arr.push([x - half, y - half, z - half]);
        }
      }
    }
    return arr;
  }, [size]);
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 10]} />
      {cubes.map((pos, i) => (
        <mesh key={`${pos[0]}-${pos[1]}-${pos[2]}-${i}`} position={pos}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#f05e9b" />
        </mesh>
      ))}
    </>
  );
}

function Particles({ count = 300 }: { count?: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 6;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    return arr;
  }, [count]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.04} />
    </points>
  );
}

export function ThreeNode({ node }: { node: ThreeNodeT }) {
  const { preset, params } = node.props;
  const mode = useRenderMode();
  const staticFallback = mode === "thumbnail" || !webglAvailable();
  const [evicted, setEvicted] = useState(false);

  useEffect(() => {
    // Don't take a WebGL pool slot when we're rendering the static fallback.
    if (staticFallback) return;
    const slot = acquireSlot(() => setEvicted(true));
    return () => slot.release();
  }, [staticFallback]);

  if (staticFallback) {
    // §C17/§C9 — static gradient, no live canvas. Safe for thumbnails (Puppeteer
    // snapshot without GPU), jsdom tests, and any environment without WebGL.
    return (
      <div
        data-three-fallback="gradient"
        className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-400 rounded"
        style={applyCommonStyle(node.style)}
      />
    );
  }

  if (evicted) {
    return (
      <div
        className="w-full h-full flex items-center justify-center text-xs text-slate-500 bg-slate-100 rounded"
        style={applyCommonStyle(node.style)}
      >
        3D scene paused (WebGL pool limit)
      </div>
    );
  }

  const rawSize = params?.size as number | undefined;
  const rawCount = params?.count as number | undefined;
  // Clamp + sanitize at render time. deck.json can arrive from an external
  // agent with arbitrary values, so untrusted input must be rejected before
  // it reaches `new Float32Array(count * 3)` (negative → RangeError; NaN →
  // silent zero-length buffer; Infinity → huge allocation attempt).
  const size =
    typeof rawSize === "number" && Number.isFinite(rawSize) && rawSize >= 0
      ? Math.min(rawSize, 20)
      : undefined;
  const count =
    typeof rawCount === "number" && Number.isFinite(rawCount) && rawCount >= 0
      ? Math.min(rawCount, 50000)
      : undefined;

  return (
    <div className="w-full h-full" style={applyCommonStyle(node.style)}>
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        {preset === "globe" && <Globe />}
        {preset === "cube-grid" && <CubeGrid size={size} />}
        {preset === "particles" && <Particles count={count} />}
      </Canvas>
    </div>
  );
}

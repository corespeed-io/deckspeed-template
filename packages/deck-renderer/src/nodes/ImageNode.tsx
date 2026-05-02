import { useEffect, useRef, useState } from "react";
import type { ImageNode as ImageNodeT } from "@deckspeed/deck-schema";
import { useResolveImageSrc } from "../context/ImageSrcContext";
import { safeImgSrc } from "../utils/safeUrl";
import { applyCommonStyle } from "./commonStyle";

/** Resolve src that may be sync (string) or async (Promise<string>). */
function useResolvedSrc(rawSrc: string): string {
  const resolve = useResolveImageSrc();
  const [src, setSrc] = useState("");
  const rawSrcRef = useRef(rawSrc);

  useEffect(() => {
    rawSrcRef.current = rawSrc;
    const result = resolve(rawSrc);
    if (typeof result === "string") {
      setSrc(safeImgSrc(result));
    } else {
      let cancelled = false;
      result
        .then((url) => {
          if (!cancelled && rawSrcRef.current === rawSrc) {
            setSrc(safeImgSrc(url));
          }
        })
        .catch(() => {
          if (!cancelled && rawSrcRef.current === rawSrc) {
            setSrc("");
          }
        });
      return () => { cancelled = true; };
    }
  }, [rawSrc, resolve]);

  return src;
}

export function ImageNode({ node }: { node: ImageNodeT }) {
  const src = useResolvedSrc(node.props.src);
  return (
    <img
      src={src}
      alt={node.props.alt ?? ""}
      draggable={false}
      className="block w-full h-full"
      style={{ objectFit: node.props.fit, ...applyCommonStyle(node.style) }}
    />
  );
}

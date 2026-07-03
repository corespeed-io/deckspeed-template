import { useEffect, useRef, useState } from "react";
import type { ImageNode as ImageNodeT } from "@deckspeed/deck-schema";
import { useResolveImageSrc } from "../context/ImageSrcContext";
import { safeImgSrc } from "../utils/safeUrl";
import { applyCommonStyle } from "./commonStyle";

/**
 * Resolved src state — discriminates "still resolving" from "resolved
 * with possibly-empty src". This matters because `safeImgSrc` returns
 * `""` for unsafe URLs deliberately (the broken-image icon is the
 * intended UX for bad input — visible to the author, no execution; see
 * utils/safeUrl.ts). Collapsing both cases into `string | null` would
 * silently hide unsafe images instead of surfacing them.
 */
type Resolution = "pending" | { src: string };

/** Resolve src that may be sync (string) or async (Promise<string>). */
function useResolvedSrc(rawSrc: string): Resolution {
  const resolve = useResolveImageSrc();
  const [resolution, setResolution] = useState<Resolution>("pending");
  const rawSrcRef = useRef(rawSrc);

  useEffect(() => {
    rawSrcRef.current = rawSrc;
    const result = resolve(rawSrc);
    if (typeof result === "string") {
      setResolution({ src: safeImgSrc(result) });
    } else {
      let cancelled = false;
      result
        .then((url) => {
          if (!cancelled && rawSrcRef.current === rawSrc) {
            setResolution({ src: safeImgSrc(url) });
          }
        })
        .catch(() => {
          if (!cancelled && rawSrcRef.current === rawSrc) {
            // Resolution failed — surface as broken-image (empty src),
            // same UX as an unsafe URL.
            setResolution({ src: "" });
          }
        });
      return () => {
        cancelled = true;
      };
    }
  }, [rawSrc, resolve]);

  return resolution;
}

export function ImageNode({ node }: { node: ImageNodeT }) {
  const resolution = useResolvedSrc(node.props.src);
  // Don't render until resolution completes — avoids React's "empty
  // string passed to src" warning + the broken-image flash during
  // async resolution. After resolution, render the <img> even when
  // src is "" so the browser's broken-image icon surfaces unsafe or
  // failed URLs (per safeImgSrc's contract).
  if (resolution === "pending") return null;

  return (
    <img
      src={resolution.src}
      alt={node.props.alt ?? ""}
      draggable={false}
      className="block w-full h-full"
      style={{ objectFit: node.props.fit, ...applyCommonStyle(node.style) }}
    />
  );
}

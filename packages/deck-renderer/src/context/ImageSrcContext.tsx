import { createContext, useContext } from "react";

/**
 * Host-provided function to resolve image `src` values before rendering.
 * Default: identity (pass-through). The web app provides a resolver that
 * fetches `/files/content/{fileId}` paths with auth and returns blob URLs.
 *
 * May return a Promise for async resolution (e.g. authenticated fetch).
 */
export type ResolveImageSrc = (src: string) => string | Promise<string>;

const ImageSrcContext = createContext<ResolveImageSrc>((src) => src);

export const ImageSrcProvider = ImageSrcContext.Provider;
export const useResolveImageSrc = () => useContext(ImageSrcContext);

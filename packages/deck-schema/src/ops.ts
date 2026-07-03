import { z } from "zod";
import { CommonStyleSchema, PosSchema } from "./index.ts";

// Typed op surface for structural deck mutations. Shared between
// apps/web (client) and apps/sandbox (server).
//
// §C1 — discriminator field is `kind` (NOT `type`).
//
// T9 subset: setProp / setPos / setNodeStyle / setPosAndAutoFit. Broader
// ops (insertNode, addSlide, reorder, batch…) land in later phases.

// Keys we never want to let into `node.props` via `Object.assign`. Setting
// `__proto__` / `constructor` / `prototype` through the op wire format
// would let a caller pivot a node's prototype chain or confuse downstream
// schema checks (Zod passthrough preserves unknown keys). These keys have
// no legitimate place in any node's props, so reject at envelope time.
export const FORBIDDEN_PATCH_KEYS = ["__proto__", "constructor", "prototype"];

export const SetPropOpSchema = z.object({
  kind: z.literal("setProp"),
  slideId: z.string(),
  nodeId: z.string(),
  // Shape validated against the target node's props at apply time,
  // not at envelope validation — keep the wire format permissive.
  patch: z
    .record(z.string(), z.unknown())
    .refine(
      (p) => !FORBIDDEN_PATCH_KEYS.some((k) => Object.hasOwn(p, k)),
      { message: "patch may not contain __proto__/constructor/prototype" },
    ),
});

export const SetPosOpSchema = z.object({
  kind: z.literal("setPos"),
  slideId: z.string(),
  nodeId: z.string(),
  pos: PosSchema,
});

export const SetNodeStyleOpSchema = z.object({
  kind: z.literal("setNodeStyle"),
  slideId: z.string(),
  nodeId: z.string(),
  patch: CommonStyleSchema.partial(),
});

export const SetPosAndAutoFitOpSchema = z.object({
  kind: z.literal("setPosAndAutoFit"),
  slideId: z.string(),
  nodeId: z.string(),
  pos: PosSchema,
  autoFit: z.object({ w: z.boolean(), h: z.boolean() }).strict().optional(),
});

export const OpSchema = z.discriminatedUnion("kind", [
  SetPropOpSchema,
  SetPosOpSchema,
  SetNodeStyleOpSchema,
  SetPosAndAutoFitOpSchema,
]);

export type SetPropOp = z.infer<typeof SetPropOpSchema>;
export type SetPosOp = z.infer<typeof SetPosOpSchema>;
export type SetNodeStyleOp = z.infer<typeof SetNodeStyleOpSchema>;
export type SetPosAndAutoFitOp = z.infer<typeof SetPosAndAutoFitOpSchema>;
export type Op = z.infer<typeof OpSchema>;

import { z } from "zod";

// Deck schema. Typed 8-node discriminated union.
// Contract references:
// - Source spec §2 (paper sizes), §3 (deck shape), §4 (positioning), §5 (nodes).
// - Corrections doc §C1: Slide.layout is a discriminated-union object
//   ({ mode: 'flow' } | { mode: 'canvas' }), NOT a string enum.
//   TextNode.props.plain (NOT .text); TextNode.props.lexical? is optional.
// - Corrections doc §C5.1: slide ID uniqueness (deck-level),
//   node ID uniqueness within slide, Group children-ref, Group acyclicity.
// - Corrections doc §C16: Lexical serialized state schema — 200KB cap,
//   64-char type cap, passthrough node fields.

export const PaperSizeSchema = z.enum([
  "A4",
  "A3",
  "A5",
  "LETTER",
  "LEGAL",
  "TABLOID",
  "PRESENTATION",
  "WIDE",
]);
export const OrientationSchema = z.enum(["landscape", "portrait"]);

export const DeckMetaSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  paperSize: PaperSizeSchema,
  orientation: OrientationSchema,
});

export const PosSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("flow") }).strict(),
  z
    .object({
      mode: z.literal("canvas"),
      unit: z.literal("mm"),
      x: z.number(),
      y: z.number(),
      w: z.number().positive(),
      h: z.number().positive(),
      rotate: z.number().optional(),
      z: z.number().int().optional(),
    })
    .strict(),
]);

export const BackgroundSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("color"), value: z.string() }),
  z.object({ kind: z.literal("gradient"), css: z.string() }),
  z.object({
    kind: z.literal("image"),
    src: z.string(),
    fit: z.enum(["cover", "contain"]),
  }),
]);

export const CommonStyleSchema = z
  .object({
    fontFamily: z.string().optional(),
    fontSize: z.number().positive().optional(),
    color: z.string().optional(),
    bg: z.string().optional(),
    opacity: z.number().min(0).max(1).optional(),
    rounded: z.number().nonnegative().optional(),
    shadow: z.enum(["none", "sm", "md", "lg"]).optional(),
  })
  .strict();

export const SlideLayoutSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("flow") }).strict(),
  z.object({ mode: z.literal("canvas") }).strict(),
]);

// ---------------------------------------------------------------------------
// §C16 — Lexical serialized state
// ---------------------------------------------------------------------------
//
// The Lexical editor persists its state as a tree of plain-object nodes.
// We accept arbitrary extra fields (direction, format, style, mode, text,
// indent, etc.) via .passthrough() but cap:
//   - `type` string: 64 chars max
//   - total serialized JSON: 200 KB max (hard cap, enforced by refinement)
//
// Actual Lexical mount happens in Phase 2; this schema only guards deck JSON
// at load/API boundaries so a malicious or corrupted payload cannot crash
// `$setEditorState`.

const SerializedLexicalNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z
    .object({
      type: z.string().max(64),
      version: z.number().int().min(1).max(100),
      children: z.array(SerializedLexicalNodeSchema).max(500).optional(),
    })
    .passthrough(),
);

export const SerializedLexicalStateSchema = z
  .object({
    root: SerializedLexicalNodeSchema,
  })
  .refine((s) => JSON.stringify(s).length < 200_000, {
    message: "Lexical state exceeds 200KB",
  });

// ---------------------------------------------------------------------------
// Typed node discriminated union (8 types)
// ---------------------------------------------------------------------------

const Base = {
  id: z.string(),
  pos: PosSchema,
  style: CommonStyleSchema.optional(),
};

const ChartDataSchema = z.object({
  labels: z.array(z.string()),
  datasets: z.array(
    z.object({
      label: z.string(),
      data: z.array(z.number()),
      backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
      borderColor: z.string().optional(),
    }),
  ),
});

export const HeadingNodeSchema = z.object({
  ...Base,
  type: z.literal("Heading"),
  props: z.object({
    text: z.string(),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    align: z.enum(["left", "center", "right"]).optional(),
  }),
});

export const TextNodeSchema = z.object({
  ...Base,
  type: z.literal("Text"),
  props: z.object({
    plain: z.string(),
    // §C1 — lexical is optional. §C16 — when present, must validate (or be null
    // for an explicit "no rich-text yet" marker).
    lexical: z.union([SerializedLexicalStateSchema, z.null()]).optional(),
    align: z.enum(["left", "center", "right", "justify"]).optional(),
  }),
});

export const ImageNodeSchema = z.object({
  ...Base,
  type: z.literal("Image"),
  props: z.object({
    src: z.string(),
    alt: z.string().optional(),
    fit: z.enum(["cover", "contain", "fill"]),
  }),
});

export const ShapeNodeSchema = z.object({
  ...Base,
  type: z.literal("Shape"),
  props: z.object({
    kind: z.enum(["rect", "ellipse", "line", "arrow"]),
    stroke: z.string().optional(),
    strokeWidth: z.number().nonnegative().optional(),
    fill: z.string().optional(),
  }),
});

export const ChartNodeSchema = z.object({
  ...Base,
  type: z.literal("Chart"),
  props: z.object({
    engine: z.enum(["chartjs", "recharts"]),
    kind: z.enum(["bar", "line", "pie", "area", "scatter"]),
    data: ChartDataSchema,
    options: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const MathNodeSchema = z.object({
  ...Base,
  type: z.literal("Math"),
  props: z.object({
    tex: z.string(),
    display: z.enum(["inline", "block"]),
  }),
});

export const ThreeNodeSchema = z.object({
  ...Base,
  type: z.literal("Three"),
  props: z.object({
    preset: z.enum(["globe", "cube-grid", "particles"]),
    params: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  }),
});

export const GroupNodeSchema = z.object({
  ...Base,
  type: z.literal("Group"),
  props: z.object({
    children: z.array(z.string()),
  }),
});

export const NodeSchema = z.discriminatedUnion("type", [
  HeadingNodeSchema,
  TextNodeSchema,
  ImageNodeSchema,
  ShapeNodeSchema,
  ChartNodeSchema,
  MathNodeSchema,
  ThreeNodeSchema,
  GroupNodeSchema,
]);

// ---------------------------------------------------------------------------
// SlideSchema with §C5.1 invariants
// ---------------------------------------------------------------------------

export const SlideSchema = z
  .object({
    id: z.string(),
    layout: SlideLayoutSchema,
    title: z.string().optional(),
    description: z.string().optional(),
    background: BackgroundSchema.optional(),
    nodes: z.array(NodeSchema),
  })
  .superRefine((slide, ctx) => {
    // §C5.1(1) — node ID uniqueness within slide.
    const nodeIds = new Set<string>();
    for (const [i, n] of slide.nodes.entries()) {
      if (nodeIds.has(n.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["nodes", i, "id"],
          message: `Duplicate node id within slide: "${n.id}"`,
        });
      }
      nodeIds.add(n.id);
    }

    // §C5.1(2) — Group.children references must exist within the same slide.
    for (const [i, n] of slide.nodes.entries()) {
      if (n.type !== "Group") continue;
      for (const [j, childId] of n.props.children.entries()) {
        if (!nodeIds.has(childId)) {
          ctx.addIssue({
            code: "custom",
            path: ["nodes", i, "props", "children", j],
            message: `Group child id "${childId}" not found in slide`,
          });
        }
      }
    }

    // §C5.1(3) — Group acyclicity (includes self-ref).
    // Build adjacency from Group → referenced Group children only.
    const groupChildren = new Map<string, string[]>();
    for (const n of slide.nodes) {
      if (n.type === "Group") groupChildren.set(n.id, n.props.children);
    }
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    let cycleFound = false;
    let cycleNodeId: string | null = null;

    const dfs = (id: string): void => {
      if (cycleFound) return;
      color.set(id, GRAY);
      const children = groupChildren.get(id) ?? [];
      for (const c of children) {
        const cColor = color.get(c) ?? WHITE;
        if (cColor === GRAY) {
          cycleFound = true;
          cycleNodeId = c;
          return;
        }
        if (cColor === WHITE && groupChildren.has(c)) {
          dfs(c);
          if (cycleFound) return;
        }
      }
      color.set(id, BLACK);
    };

    for (const gid of groupChildren.keys()) {
      if ((color.get(gid) ?? WHITE) === WHITE) dfs(gid);
      if (cycleFound) break;
    }

    if (cycleFound) {
      ctx.addIssue({
        code: "custom",
        path: ["nodes"],
        message: `Group cycle detected involving id "${cycleNodeId}"`,
      });
    }
  });

export const DeckSchema = z
  .object({
    $version: z.literal(1),
    id: z.string(),
    baseVersion: z.number().int().nonnegative(),
    meta: DeckMetaSchema,
    slides: z.array(SlideSchema),
  })
  .superRefine((deck, ctx) => {
    // §C5.1(4) — slide ID uniqueness within deck.
    const seen = new Set<string>();
    for (const [i, s] of deck.slides.entries()) {
      const id = s.id;
      if (seen.has(id)) {
        ctx.addIssue({
          code: "custom",
          path: ["slides", i, "id"],
          message: `Duplicate slide id: "${id}"`,
        });
      }
      seen.add(id);
    }
  });

export type PaperSize = z.infer<typeof PaperSizeSchema>;
export type Orientation = z.infer<typeof OrientationSchema>;
export type DeckMeta = z.infer<typeof DeckMetaSchema>;
export type Pos = z.infer<typeof PosSchema>;
export type Background = z.infer<typeof BackgroundSchema>;
export type CommonStyle = z.infer<typeof CommonStyleSchema>;
export type SlideLayout = z.infer<typeof SlideLayoutSchema>;
export type HeadingNode = z.infer<typeof HeadingNodeSchema>;
export type TextNode = z.infer<typeof TextNodeSchema>;
export type ImageNode = z.infer<typeof ImageNodeSchema>;
export type ShapeNode = z.infer<typeof ShapeNodeSchema>;
export type ChartNode = z.infer<typeof ChartNodeSchema>;
export type MathNode = z.infer<typeof MathNodeSchema>;
export type ThreeNode = z.infer<typeof ThreeNodeSchema>;
export type GroupNode = z.infer<typeof GroupNodeSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type Slide = z.infer<typeof SlideSchema>;
export type Deck = z.infer<typeof DeckSchema>;
export type SerializedLexicalState = z.infer<
  typeof SerializedLexicalStateSchema
>;

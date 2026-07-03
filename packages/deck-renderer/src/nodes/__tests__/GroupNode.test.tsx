import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Node as DeckNodeT, GroupNode as GroupNodeT } from "../../schema";
import { GroupNode } from "../GroupNode";

describe("GroupNode", () => {
  it("resolves and renders children via the provided lookup", () => {
    const siblings: DeckNodeT[] = [
      {
        id: "h1",
        type: "Heading",
        pos: { mode: "flow" },
        props: { text: "Hello", level: 1 },
      },
      {
        id: "t1",
        type: "Text",
        pos: { mode: "flow" },
        props: { plain: "World" },
      },
    ];
    const group: GroupNodeT = {
      id: "g1",
      type: "Group",
      pos: { mode: "flow" },
      props: { children: ["h1", "t1"] },
    };
    const byId = new Map(siblings.map((n) => [n.id, n]));
    const renderChild = (n: DeckNodeT) =>
      n.type === "Heading" ? (
        <span>{n.props.text}</span>
      ) : n.type === "Text" ? (
        <span>{n.props.plain}</span>
      ) : null;

    render(<GroupNode node={group} byId={byId} renderChild={renderChild} />);
    expect(screen.getByText("Hello")).toBeTruthy();
    expect(screen.getByText("World")).toBeTruthy();
  });

  it("skips unresolved child ids", () => {
    const group: GroupNodeT = {
      id: "g1",
      type: "Group",
      pos: { mode: "flow" },
      props: { children: ["missing"] },
    };
    const renderChild = () => <span>should-not-render</span>;
    const { container } = render(
      <GroupNode node={group} byId={new Map()} renderChild={renderChild} />,
    );
    expect(container.textContent).toBe("");
  });
});

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  nodeId: string;
  nodeType: string;
  // When `resetKey` changes (e.g. a new immutable `node` reference produced
  // by Immer after any deck mutation), the boundary clears its error and
  // re-attempts to render its children. Without this, a single transient
  // failure would freeze the placeholder until full page reload.
  resetKey: unknown;
  children: ReactNode;
}

interface State {
  error: Error | null;
  lastResetKey: unknown;
}

// Per-node error boundary so one broken node (e.g. a Chart.js teardown
// failure on a frozen Immer array) cannot blank the entire deck. Renders
// a small inline placeholder in place of the failing node and lets every
// sibling continue. Re-attempts render whenever the source node reference
// changes — Immer issues a new reference on every relevant mutation, so
// the user gets automatic recovery as soon as the bad data is replaced.
export class NodeErrorBoundary extends Component<Props, State> {
  // Initialize `lastResetKey` from the incoming `resetKey` so the boundary
  // is "in sync" from mount — `getDerivedStateFromProps` becomes truly
  // diff-only and skips a redundant initial state assignment.
  constructor(props: Props) {
    super(props);
    this.state = { error: null, lastResetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(
    nextProps: Props,
    prevState: State,
  ): Partial<State> | null {
    if (nextProps.resetKey !== prevState.lastResetKey) {
      return { error: null, lastResetKey: nextProps.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const { nodeId, nodeType } = this.props;
    console.error(
      `[deck-renderer] node ${nodeType}#${nodeId} crashed:`,
      error,
      info.componentStack,
    );
  }

  render(): ReactNode {
    if (this.state.error) {
      const { nodeType, nodeId } = this.props;
      return (
        <div
          role="alert"
          data-node-error="true"
          data-node-id={nodeId}
          className="w-full h-full flex items-center justify-center text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2"
        >
          {nodeType} failed to render
        </div>
      );
    }
    return this.props.children;
  }
}

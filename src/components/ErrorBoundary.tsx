import { Component, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

function BoundaryFallback({ onReset }: { onReset: () => void }) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-sm rounded-xl border border-line bg-surface p-6 text-center">
        <h1 className="text-base font-semibold text-zinc-100">{t.boundary.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">{t.boundary.text}</p>
        <button
          type="button"
          onClick={onReset}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          {t.catalog.retry}
        </button>
      </div>
    </div>
  );
}

/**
 * Class-based error boundary: catches render-time exceptions from the shell
 * and shows a recoverable fallback instead of a blank screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('[ui] unexpected render error:', error);
  }

  private reset = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return <BoundaryFallback onReset={this.reset} />;
    }
    return this.props.children;
  }
}

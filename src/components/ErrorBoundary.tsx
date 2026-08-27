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
      <div className="max-w-sm rounded-[12px] border border-line bg-surface p-6 text-center">
        <h1 className="text-[15px] font-semibold tracking-tight text-white">{t.boundary.title}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-white/56">{t.boundary.text}</p>
        <button
          type="button"
          onClick={onReset}
          className="mt-4 inline-flex items-center gap-2 rounded-[10px] border border-line bg-surface px-4 py-2 text-[13px] font-medium text-white transition hover:bg-hover"
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

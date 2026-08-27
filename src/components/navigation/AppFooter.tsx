import { ExternalLink } from 'lucide-react';

export function AppFooter() {
  return (
    <footer className="mt-8 border-t border-line">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-2 px-6 py-4 text-[11px] sm:flex-row lg:px-10">
        <p className="text-white/46">Developed by Ignacio Sanguina</p>
        <a
          href="https://github.com/denuczi/xtream-explorer/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex cursor-pointer items-center gap-1.5 text-white/60 transition hover:text-white"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Github
        </a>
      </div>
    </footer>
  );
}

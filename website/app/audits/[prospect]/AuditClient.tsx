'use client';

import { useEffect, useState } from 'react';

interface Category {
  title: string;
  score: number | null;
}

interface LighthouseData {
  requestedUrl: string;
  fetchTime: string;
  lighthouseVersion: string;
  categories: {
    performance?: Category;
    accessibility?: Category;
    'best-practices'?: Category;
    seo?: Category;
  };
}

const getScoreColor = (score: number | null): string => {
  if (score === null) return 'text-gray-500';
  if (score >= 0.9) return 'text-emerald-400';
  if (score >= 0.5) return 'text-amber-400';
  return 'text-rose-500';
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export default function AuditClient({ prospect }: { prospect: string }) {
  const [data, setData] = useState<LighthouseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/audits/${prospect}.json`);
        if (!response.ok) {
          throw new Error('Audit report not found');
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load audit');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [prospect]);

  if (loading) {
    return (
      <div className="min-h-screen bg-atelier-black flex items-center justify-center">
        <div className="text-atelier-cream font-serif text-lg">Loading audit report...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-atelier-black flex items-center justify-center">
        <div className="text-rose-400 font-serif text-lg">{error || 'Audit not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-atelier-black">
      <div className="grain-overlay" aria-hidden="true" />

      <div className="max-w-3xl mx-auto px-8 py-24">
        {/* Header */}
        <header className="mb-20">
          <p className="font-sans text-xs uppercase tracking-widest text-atelier-cream-muted mb-4">
            Velocity Digital Atelier
          </p>
          <h1 className="font-serif text-5xl text-atelier-cream tracking-wide mb-6">
            {prospect.charAt(0).toUpperCase() + prospect.slice(1)}
          </h1>
          <p className="text-sm text-atelier-cream-muted font-sans">
            {formatDate(data.fetchTime)} • Lighthouse {data.lighthouseVersion}
          </p>
        </header>

        {/* URL */}
        <div className="mb-16 pb-8 border-b border-atelier-cream/10">
          <a
            href={data.requestedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-atelier-cream hover:text-atelier-orange transition-colors font-sans text-sm underline underline-offset-4"
          >
            {data.requestedUrl}
          </a>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-12 mb-20">
          {data.categories.performance && (
            <div>
              <p className="font-serif text-6xl text-atelier-cream mb-2">
                {data.categories.performance.score !== null
                  ? Math.round(data.categories.performance.score * 100)
                  : '—'}
              </p>
              <p className="text-sm text-atelier-cream-muted font-sans uppercase tracking-widest">
                Performance
              </p>
            </div>
          )}
          {data.categories.accessibility && (
            <div>
              <p className="font-serif text-6xl text-atelier-cream mb-2">
                {data.categories.accessibility.score !== null
                  ? Math.round(data.categories.accessibility.score * 100)
                  : '—'}
              </p>
              <p className="text-sm text-atelier-cream-muted font-sans uppercase tracking-widest">
                Accessibility
              </p>
            </div>
          )}
          {data.categories['best-practices'] && (
            <div>
              <p className="font-serif text-6xl text-atelier-cream mb-2">
                {data.categories['best-practices'].score !== null
                  ? Math.round(data.categories['best-practices'].score * 100)
                  : '—'}
              </p>
              <p className="text-sm text-atelier-cream-muted font-sans uppercase tracking-widest">
                Best Practices
              </p>
            </div>
          )}
          {data.categories.seo && (
            <div>
              <p className="font-serif text-6xl text-atelier-cream mb-2">
                {data.categories.seo.score !== null
                  ? Math.round(data.categories.seo.score * 100)
                  : '—'}
              </p>
              <p className="text-sm text-atelier-cream-muted font-sans uppercase tracking-widest">
                SEO
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="pt-16 border-t border-atelier-cream/10">
          <a
            href="https://velocity.calyvent.com"
            className="text-sm text-atelier-cream hover:text-atelier-orange transition-colors font-sans"
          >
            velocity.calyvent.com
          </a>
        </footer>
      </div>
    </div>
  );
}

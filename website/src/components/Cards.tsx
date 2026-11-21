import { Lightbox } from './Lightbox';
import type { Evidence, Figure, Stat } from '../data/sections';

export function EvidenceCaption({ measured, result, meaning, sourcePath }: Evidence) {
  return (
    <>
      <dl className="evidence">
        <div><dt>Measured</dt><dd>{measured}</dd></div>
        <div><dt>Result</dt><dd>{result}</dd></div>
        <div><dt>Meaning</dt><dd>{meaning}</dd></div>
      </dl>
      <small className="source">{sourcePath}</small>
    </>
  );
}

export function FigureCard({ src, alt, ...evidence }: Figure) {
  return (
    <figure className="figure-card">
      <Lightbox src={src} alt={alt} className="figure-trigger" label={`Enlarge image: ${alt}`}>
        <img src={src} alt={alt} />
      </Lightbox>
      <figcaption><EvidenceCaption {...evidence} /></figcaption>
    </figure>
  );
}

export function StatCard({ value, label, badges, detail, sourcePath }: Stat) {
  return (
    <div className="stat-card">
      <strong>{value}</strong>
      <span className="stat-label">{label}</span>
      {detail && <span className="stat-detail">{detail}</span>}
      {badges && <div className="badges">{badges.map(badge => <span key={badge} className="badge">{badge}</span>)}</div>}
      {sourcePath && <small className="source">{sourcePath}</small>}
    </div>
  );
}

export function PendingBadge({ label = "not yet measured" }: { label?: string } = {}) {
  return <span className="badge">PENDING: {label}</span>;
}

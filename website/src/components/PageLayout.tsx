import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { sections, type Section } from '../data/sections';

export function PageLayout({ section, children }: { section: Section; children: ReactNode }) {
  const index = sections.indexOf(section);
  const previous = sections[index - 1];
  const next = sections[index + 1];

  return (
    <>
      <header className="site-header">
        <div className="site-bar">
          <Link to="/1" className="brand">Mars terrain compression</Link>
          <nav className="section-nav" aria-label="Research sections">
            {sections.map(item => (
              <NavLink key={item.id} to={`/${item.id}`} end title={item.title}>
                <span>{item.id}</span><span className="sr-only">. {item.title}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="page" aria-labelledby="page-title">
        <header className="page-header">
          <span className="section-tag">Section {section.id}</span>
          <h1 id="page-title">{section.title}</h1>
          <p>{section.takeaway}</p>
        </header>
        <div className="blocks">{children}</div>
        <nav className="section-footer" aria-label="Adjacent sections">
          {previous && <Link to={`/${previous.id}`}>Previous section</Link>}
          {next && <Link to={`/${next.id}`} className="next-section">Next section</Link>}
        </nav>
      </main>
    </>
  );
}

export function Block({ title, muted, children }: { title: string; muted?: boolean; children?: ReactNode }) {
  return <section className={muted ? 'block-card block-muted' : 'block-card'}><h2>{title}</h2>{children}</section>;
}

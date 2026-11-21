import { lazy, Suspense, useLayoutEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { sections, terrainLegend, type BlockData } from './data/sections';
import { Block, PageLayout } from './components/PageLayout';
import { PipelineDiagram } from './components/PipelineDiagram';
import { SegFormerArchitecture } from './components/SegFormerArchitecture';
import { EvidenceCaption, FigureCard, StatCard } from './components/Cards';

const SplitCharts = lazy(() => import('./components/TrainingBlocks').then(module => ({ default: module.SplitCharts })));
const TrainingBlock = lazy(() => import('./components/TrainingBlocks').then(module => ({ default: module.TrainingBlock })));

const BaselineBlock = lazy(() => import('./components/BaselineBlocks').then(module => ({ default: module.BaselineBlock })));

function Points({ items }: { items: readonly string[] }) {
  return <ul className="points compact">{items.map(item => <li key={item}>{item}</li>)}</ul>;
}

function TerrainLegend({ items }: { items: typeof terrainLegend | readonly { label: string; color: string }[] }) {
  return (
    <ul className="legend" aria-label="Terrain mask legend">
            {items.map(item => <li key={item.label}><span style={{ background: item.color }} />{item.label}</li>)}
          </ul>
  );
}

function Content({ block }: { block: BlockData }) {
  switch (block.kind) {
    case 'problem':
      return (
        <>
          <ul className="points">{block.points.map(point => <li key={point}>{point}</li>)}</ul>
          <div className="flow-band"><PipelineDiagram nodes={block.flow} widths={[210, 182, 226, 182, 248]} gap={48} /></div>
          <p className="closing-question">{block.question}</p>
        </>
      );
    case 'comparison':
      return (
        <>
          <Points items={block.points} />
          <div className="comparison-grid">
            <div className="method-list">
              {block.methods.map(method => (
                <div className="method" key={method.id}>
                  <span className="item-index">{method.id}</span>
                  <PipelineDiagram nodes={method.flow} widths={[280, 138, 154]} gap={32} />
                </div>
              ))}
            </div>
            <div className="question-list">
              {block.questions.map(question => (
                <div className="question" key={question.id}>
                  <span className="item-index">{question.id}</span>
                  <div><strong>{question.label}</strong><p>{question.detail}</p></div>
                </div>
              ))}
            </div>
          </div>
          <p className="footnote">{block.footnote}</p>
        </>
      );
    case 'gallery':
      return (
        <>
          <TerrainLegend items={block.legend} />
          <small className="source legend-source">notebooks/Mars_Compression_01_Data_Audit_and_Baseline (1).ipynb · cell 16</small>
          <p className="footnote legend-source">255 Ignore is not a fifth class. It is excluded from loss and metrics.</p>
          <div className="figure-grid">{block.figures.map(figure => <FigureCard key={figure.src} {...figure} />)}</div>
          <div className="stat-evidence">
            <h3 className="block-label">Historical audit, labelled training pixels</h3>
            <div className="stat-grid">{block.stats.map(stat => <StatCard key={stat.label} {...stat} />)}</div>
            <p className="footnote">{block.note}</p>
            <small className="source">{block.citation}</small>
          </div>
        </>
      );
    case 'preprocessing':
      return (
        <>
          <Points items={block.notes} />
          <p className="caution">{block.caution}</p>
          <small className="source">{block.citation}</small>
          <div className="benchmark"><EvidenceCaption {...block.benchmark} /></div>
          <div className="supporting-figure"><FigureCard {...block.figure} /></div>
        </>
      );
    case 'stats':
      return (
        <>
          {block.points && <Points items={block.points} />}
          <div className="stat-grid">{block.stats.map(stat => <StatCard key={stat.label} {...stat} />)}</div>
          {block.note && <p className="footnote">{block.note}</p>}
          {block.citation && <small className="source">{block.citation}</small>}
          {block.evidence && <div className="stat-evidence"><EvidenceCaption {...block.evidence} /></div>}
          {block.figure && <div className="supporting-figure"><FigureCard {...block.figure} /></div>}
        </>
      );
    case 'copy':
      return (
        <>
          {block.columns && (
            <div className="copy-grid">
              {block.columns.map(column => (
                <div className="copy-card" key={column.title}>
                  <h3>{column.title}</h3><p>{column.text}</p>
                </div>
              ))}
            </div>
          )}
          {block.points && <Points items={block.points} />}
          {block.line && <p className={block.columns ? 'footnote' : 'short-note'}>{block.line}</p>}
          {block.sourcePath && <small className="source">{block.sourcePath}</small>}
        </>
      );
    case 'stepper':
      return (
        <>
          <ol className="stepper">
            {block.steps.map(step => (
              <li key={step.name}><strong>{step.name}</strong><span>{step.reason}</span></li>
            ))}
          </ol>
          <p className="footnote">{block.note}</p>
          <small className="source">{block.sourcePath}</small>
        </>
      );
    case 'segmentation-example':
      return (
        <>
          <p className="short-note">{block.line}</p>
          <TerrainLegend items={terrainLegend} />
          <div className="example-figure"><FigureCard {...block.figure} /></div>
        </>
      );
    case 'architecture':
      return (
        <>
          <div className="flow-band diagram-scroll"><SegFormerArchitecture /></div>
          <ul className="architecture-notes"><li>High-resolution maps keep local detail</li><li>Low-resolution maps carry wider scene context</li></ul>
          <EvidenceCaption {...block.evidence} />
        </>
      );
    case 'interface':
      return (
        <>
          <div className="flow-band diagram-scroll">
            <PipelineDiagram nodes={block.flow} widths={[180, 123, 140, 160, 145, 125, 130, 100, 136]} gap={32} />
          </div>
          <Points items={block.notes} />
          <EvidenceCaption {...block.evidence} />
        </>
      );
    case 'split-chart':
      return <Suspense><SplitCharts chart={block.chart} /></Suspense>;
    case 'training':
      return <Suspense><TrainingBlock topic={block.topic} /></Suspense>;
    case 'baseline':
      return <Suspense><BaselineBlock topic={block.topic} /></Suspense>;
    case 'placeholder':
      return null;
  }
}

function SectionPage() {
  const { id } = useParams();
  const section = sections.find(item => String(item.id) === id);
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    if (section) document.title = `${section.title} | Mars terrain compression`;
  }, [section]);
  if (!section) return <Navigate to="/1" replace />;

  return (
    <PageLayout section={section}>
      {section.blocks.map(block => (
        <Block key={block.title} title={block.title} muted={block.kind === 'placeholder'}>
          <Content block={block} />
        </Block>
      ))}
    </PageLayout>
  );
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/:id" element={<SectionPage />} />
        <Route path="*" element={<Navigate to="/1" replace />} />
      </Routes>
    </HashRouter>
  );
}

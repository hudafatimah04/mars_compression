import { EvidenceCaption } from './Cards';
import { Lightbox } from './Lightbox';
import { classNames, comma } from '../data/training';

export function rowShare(matrix: number[][], row: number, column: number) {
  return matrix[row][column] / matrix[row].reduce((sum, count) => sum + count, 0);
}
export const percent = (fraction: number) => (100 * fraction).toFixed(2) + '%';

export function ConfusionHeatmap({ title, matrix, sourcePath, original }: {
  title: string; matrix: number[][]; sourcePath: string; original?: string;
}) {
  const pct = (row: number, column: number) => percent(rowShare(matrix, row, column));
  return (
    <div className="confusion-card">
      <h3>{title}</h3>
      <div className="table-scroll">
        <table className="research-table confusion-table">
          <thead><tr><th scope="col">Ground truth ↓ / Predicted →</th>{classNames.map(name => <th key={name} scope="col">{name}</th>)}</tr></thead>
          <tbody>{matrix.map((row, i) => (
            <tr key={classNames[i]}><th scope="row">{classNames[i]}</th>{row.map((count, j) => (
              <td key={classNames[j]} tabIndex={0} className="heat-cell"
                style={{ background: `rgb(163 64 40 / ${rowShare(matrix, i, j) * 0.36})` }}
                aria-label={`Ground truth ${classNames[i]}, predicted ${classNames[j]}: ${pct(i,j)}, ${count} pixels`}>
                {pct(i, j)}<span role="tooltip" className="heat-count">{comma(count)} pixels</span>
              </td>
            ))}</tr>
          ))}</tbody>
        </table>
      </div>
      <EvidenceCaption measured="Row-normalized shares of labeled pixels."
        result={`Big Rock recall ${pct(3, 3)}; predicted as bedrock ${pct(3, 1)} (${comma(matrix[3][1])} pixels).`}
        meaning="The Big Rock row shows which predictions replace missed rocks."
        sourcePath={sourcePath} />
      {original && <Lightbox src={original} alt={title + ' archived figure'} className="chart-original">View original figure</Lightbox>}
    </div>
  );
}

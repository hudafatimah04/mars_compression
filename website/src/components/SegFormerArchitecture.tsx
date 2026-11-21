const stages = [
  { size: 128, stride: '1/4', channels: 32 },
  { size: 64, stride: '1/8', channels: 64 },
  { size: 32, stride: '1/16', channels: 160 },
  { size: 16, stride: '1/32', channels: 256 },
];

export function SegFormerArchitecture() {
  return (
    <svg className="architecture" viewBox="0 0 1120 310" role="img" aria-labelledby="architecture-title architecture-desc">
      <title id="architecture-title">SegFormer feature pyramid and decoder</title>
      <desc id="architecture-desc">
        The 512-by-512 input feeds four serial encoder stages. Their feature maps have spatial sizes
        128, 64, 32 and 16 and channel widths 32, 64, 160 and 256. All four feed the decoder, which
        projects to 256 channels, upsamples, concatenates and fuses. Four-class quarter-resolution
        logits are upsampled bilinearly to 512 by 512, then argmax produces pixel labels.
      </desc>
      <defs>
        <marker id="architecture-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M1 1l8 4-8 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </marker>
      </defs>
      <text x="209" y="24" className="architecture-heading">Hierarchical encoder</text>
      <rect className="pipeline-box" x="12" y="43" width="164" height="78" rx="9" />
      <text className="architecture-title" textAnchor="middle" x="94" y="76">Input</text>
      <text className="architecture-detail" textAnchor="middle" x="94" y="100">512×512</text>
      {stages.map(({ size, stride, channels }, index) => {
        const x = 209 + index * 226;
        const center = x + 100;
        return (
          <g key={stride}>
            <path className="architecture-wire" d={`M ${x - (index ? 24 : 30)} 82 H ${x - 4}`} markerEnd="url(#architecture-arrow)" />
            <rect className="pipeline-box" x={x} y="43" width="200" height="78" rx="9" />
            <text className="architecture-title" textAnchor="middle" x={center} y="73">Stage {index + 1} · {stride}</text>
            <text className="architecture-detail" textAnchor="middle" x={center} y="100">{size}×{size} · {channels} ch</text>
            <path className="architecture-wire" d={`M ${center} 123 V 158`} />
          </g>
        );
      })}
      <path className="architecture-wire" d="M 987 158 H 162 V 189" markerEnd="url(#architecture-arrow)" />
      <rect className="pipeline-accent" x="12" y="194" width="300" height="100" rx="9" />
      <text className="architecture-title" textAnchor="middle" x="162" y="225">Decoder head</text>
      <text className="architecture-detail" textAnchor="middle" x="162" y="251">Project to 256 ch · upsample</text>
      <text className="architecture-detail" textAnchor="middle" x="162" y="274">Concatenate · fuse</text>
      <path className="architecture-wire" d="M 317 244 H 347" markerEnd="url(#architecture-arrow)" />
      <rect className="pipeline-box" x="352" y="194" width="204" height="100" rx="9" />
      <text className="architecture-title" textAnchor="middle" x="454" y="239">4-class logits</text>
      <text className="architecture-detail" textAnchor="middle" x="454" y="266">128×128 · 1/4</text>
      <path className="architecture-wire" d="M 561 244 H 591" markerEnd="url(#architecture-arrow)" />
      <rect className="pipeline-box" x="596" y="194" width="236" height="100" rx="9" />
      <text className="architecture-title" textAnchor="middle" x="714" y="239">Bilinear upsample</text>
      <text className="architecture-detail" textAnchor="middle" x="714" y="266">512×512</text>
      <path className="architecture-wire" d="M 837 244 H 867" markerEnd="url(#architecture-arrow)" />
      <rect className="pipeline-box" x="872" y="194" width="238" height="100" rx="9" />
      <text className="architecture-title" textAnchor="middle" x="991" y="239">Pixel labels</text>
      <text className="architecture-detail" textAnchor="middle" x="991" y="266">Argmax · 512×512</text>
    </svg>
  );
}

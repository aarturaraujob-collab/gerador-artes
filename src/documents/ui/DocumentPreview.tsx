/** Renders a document's final HTML (already produced by renderIMT) at a readable on-screen scale. */
export function DocumentPreview({ html }: { html: string }) {
  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-muted p-4">
      <style>{`.imt-preview-scale { transform: scale(0.75); transform-origin: top center; }`}</style>
      <div className="imt-preview-scale" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

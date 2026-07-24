import "../styles/document.css";

/** Renders a document's final HTML (already produced by a renderer under src/documents/renderer)
 * at a readable on-screen scale. Imports document.css directly so the on-screen preview matches
 * the PDF pixel-for-pixel — previously only the off-screen PDF export container loaded these rules. */
export function DocumentPreview({ html }: { html: string }) {
  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-muted p-4">
      <style>{`.imt-preview-scale { transform: scale(0.75); transform-origin: top center; }`}</style>
      <div className="imt-preview-scale" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

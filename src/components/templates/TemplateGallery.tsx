import { useLocation } from "wouter";

import { templates } from "./templates";

export function TemplateGallery() {
  const [, navigate] = useLocation();

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <button
          key={template.id}
          onClick={() => navigate(`/templates/${template.folder}`)}
          className="
            overflow-hidden
            rounded-2xl
            border
            bg-card
            transition
            hover:shadow-xl
            hover:scale-[1.02]
          "
        >
          <div className="aspect-[4/5] bg-muted overflow-hidden">
            <img
              src={template.preview}
              alt={template.name}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="p-4">
            <h3 className="font-semibold">
              {template.name}
            </h3>

            <p className="text-sm text-muted-foreground mt-1">
              Clique para abrir
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { TemplateGallery } from "@/templates/TemplateGallery";

export function Templates() {
  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader title="Templates" description="Escolha um template para editar." />
        <TemplateGallery />
      </div>
    </AppShell>
  );
}

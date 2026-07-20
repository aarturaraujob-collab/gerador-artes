import { MainLayout } from "@/components/layout/MainLayout";
import { TemplateGallery } from "@/components/templates/TemplateGallery";

export function Templates(){

return(

<MainLayout>

<div className="space-y-8">

<div>

<h1 className="text-3xl font-bold">
Templates
</h1>

<p className="text-muted-foreground">
Escolha um template para editar.
</p>

</div>

<TemplateGallery/>

</div>

</MainLayout>

);

}

import type { TemplateConfig } from "./TemplateConfig";

export class TemplateResolver{

async load(folder:string){

const response=await fetch(`/templates/${folder}/config.json`);

if(!response.ok)
throw new Error("Config não encontrada");

const config:TemplateConfig=await response.json();

return config;

}

resolve(config:TemplateConfig,games:number){

const variant=config.variants.find(v=>v.games===games);

if(!variant)
throw new Error("Nenhuma variante encontrada");

return `/templates/${config.id}/${variant.file}`;

}

}

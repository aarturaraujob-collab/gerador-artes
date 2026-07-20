export interface TemplateVariant{
    games:number;
    file:string;
}

export interface TemplateConfig{
    id:string;
    name:string;
    thumbnail:string;
    variants:TemplateVariant[];
}

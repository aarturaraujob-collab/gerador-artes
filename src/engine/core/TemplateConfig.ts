export interface TemplateVariant {
  games: number;
  file: string;
}

export interface TemplateField {
  id: string;
  label: string;
  type: string;
}

export interface TemplateConfig {
  id: string;
  name: string;
  thumbnail?: string;
  variants: TemplateVariant[];
  fields?: TemplateField[];
}

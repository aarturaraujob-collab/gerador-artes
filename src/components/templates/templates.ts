export interface TemplateItem{
  id:string;
  name:string;
  folder:string;
  preview:string;
}

export const templates:TemplateItem[]=[
{
  id:"jogos-do-dia",
  name:"Jogos do Dia",
  folder:"jogos-do-dia",
  preview:"/templates/jogos-do-dia/cover.png"
},
{
  id:"thumb-faftv",
  name:"Thumbnail FAFTV",
  folder:"thumb-faftv",
  preview:"/templates/thumb-faftv/cover.png"
}
];

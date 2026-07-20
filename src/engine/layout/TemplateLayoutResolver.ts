import { layoutRules } from "./layoutRules";

export class TemplateLayoutResolver{

static resolve(total:number){

if(layoutRules[total])
return layoutRules[total];

const result:number[]=[];

let remaining=total;

while(remaining>0){

if(remaining>=4){

result.push(4);

remaining-=4;

continue;

}

result.push(remaining);

remaining=0;

}

return result;

}

}

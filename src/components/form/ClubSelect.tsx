import { clubs } from "@/data/clubs";

interface Props {

  value:string;

  onChange:(clubId:string)=>void;

  label?:string;

}

export function ClubSelect({

  value,

  onChange,

  label

}:Props){

return(

<div className="space-y-2">

{label && (

<label className="text-sm font-medium">

{label}

</label>

)}

<select

value={value}

onChange={(e)=>onChange(e.target.value)}

className="
w-full
rounded-lg
border
border-slate-300
bg-white
px-3
py-2
text-sm
outline-none
focus:ring-2
focus:ring-violet-500
"

>

<option value="">
Selecione...
</option>

{clubs.map(club=>(

<option
key={club.id}
value={club.id}
>

{club.name}

</option>

))}

</select>

</div>

);

}

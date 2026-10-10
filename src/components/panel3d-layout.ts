import type {Material,Part} from '../engine/types.ts'
export interface PreviewPanel {
 id:string;label:string;quantity:number;materialName:string;materialType:Material['type'];
 widthMm:number;heightMm:number;thicknessMm:number;
 position:readonly [number,number,number]; size:readonly [number,number,number]
}
export interface PreviewLayout {panels:PreviewPanel[];width:number;height:number;omitted:number}
export function layoutPreviewParts(parts:Part[], materials:Material[],limit=40):PreviewLayout {
 const compatible=parts.filter(p=>Number.isSafeInteger(p.width)&&p.width>0&&Number.isSafeInteger(p.height)&&p.height>0&&p.quantity>0)
 const rows=compatible.slice(0,limit),panels:PreviewPanel[]=[]
 const gap=0.16,columns=3,materialMap=new Map(materials.map(m=>[m.id,m]))
 const heights:number[]=[],widths:number[]=[]
 for(let i=0;i<rows.length;i+=columns){
  const group=rows.slice(i,i+columns)
  heights.push(Math.max(...group.map(p=>p.height/1000)))
  widths.push(group.reduce((sum,p)=>sum+p.width/1000,0)+(group.length-1)*gap)
 }
 const totalHeight=heights.reduce((a,b)=>a+b,0)+Math.max(0,heights.length-1)*gap
 const totalWidth=Math.max(0,...widths)
 let top=totalHeight/2
 for(let i=0;i<rows.length;i+=columns){
  const group=rows.slice(i,i+columns),row=i/columns
  let left=-widths[row]/2
  for(const p of group){
   const m=materialMap.get(p.materialId)
   const width=p.width/1000,height=p.height/1000,thickness=(m?.thickness??18)/1000
   panels.push({id:p.id,label:p.label,quantity:p.quantity,materialName:m?.name??'Unknown material',materialType:m?.type??'custom',
    widthMm:p.width,heightMm:p.height,thicknessMm:m?.thickness??18,
    size:[width,height,thickness],position:[left+width/2,top-height/2,0]})
   left+=width+gap
  }
  top-=heights[row]+gap
 }
 return {panels,width:totalWidth,height:totalHeight,omitted:Math.max(0,compatible.length-rows.length)}
}

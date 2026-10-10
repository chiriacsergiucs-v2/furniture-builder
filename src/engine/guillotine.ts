import type {CutTree,Rect} from './types.ts'
import {area} from './geometry.ts'

// Kerf is material destroyed by each full-length separating saw pass.
// A residual narrower than kerf is conservatively rejected (never silently ignored).
export function canSeparate(available:number,required:number,kerf:number){return available===required||available-required>=kerf}
export function fitRect(free:Rect,width:number,height:number,kerf:number){return width<=free.width&&height<=free.height&&canSeparate(free.width,width,kerf)&&canSeparate(free.height,height,kerf)}
export type SplitOrder='vertical-first'|'horizontal-first'
export function insertIntoWaste(rect:Rect,width:number,height:number,instanceId:string,kerf:number,order:SplitOrder,id:()=>string):CutTree{
 if(!fitRect(rect,width,height,kerf))throw Error('Part does not physically fit into free rectangle')
 const partRect:Rect={x:rect.x,y:rect.y,width,height}
 const part:CutTree={kind:'part',rect:partRect,instanceId}
 const extraX=rect.width-width,extraY=rect.height-height
 const waste=(r:Rect):CutTree=>({kind:'waste',rect:r,id:id()})
 const splitVertical=(r:Rect,first:CutTree):CutTree=>({kind:'cut',rect:r,orientation:'vertical',at:r.x+width,kerf,first,second:waste({x:r.x+width+kerf,y:r.y,width:r.width-width-kerf,height:r.height})})
 const splitHorizontal=(r:Rect,first:CutTree):CutTree=>({kind:'cut',rect:r,orientation:'horizontal',at:r.y+height,kerf,first,second:waste({x:r.x,y:r.y+height+kerf,width:r.width,height:r.height-height-kerf})})
 if(order==='vertical-first'){
   const left:Rect={x:rect.x,y:rect.y,width,height:rect.height}
   const inner=extraY>0?splitHorizontal(left,part):part
   return extraX>0?splitVertical(rect,inner):inner
 }
 const top:Rect={x:rect.x,y:rect.y,width:rect.width,height}
 const inner=extraX>0?splitVertical(top,part):part
 return extraY>0?splitHorizontal(rect,inner):inner
}
export function scoreFit(free:Rect,w:number,h:number,kind:'area'|'short'|'long'):number{
 const rw=free.width-w,rh=free.height-h
 if(kind==='short')return Math.min(rw,rh)*100000+Math.max(rw,rh)
 if(kind==='long')return Math.max(rw,rh)*100000+Math.min(rw,rh)
 return area(free)-w*h
}

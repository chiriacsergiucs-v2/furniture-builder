import {cabinetDefaults} from './cabinet.ts'
import type {CabinetSpec} from './cabinet.ts'

/**
 * Small, declarative catalogue. Only ready templates can create manufacturing
 * parts. Future kinds stay visible as plans but cannot generate imaginary cuts.
 */
export type TemplateKind='cabinet'|'drawer'|'wardrobe'|'desk'|'entertainment'
export interface FurnitureTemplate {
 id:string
 title:string
 category:string
 description:string
 kind:TemplateKind
 status:'ready'|'planned'
 version:number
 rootComponent?:{definitionId:string;definitionVersion:number}
 defaultSpec?:Pick<CabinetSpec,'width'|'height'|'depth'|'shelves'>
}
export const furnitureTemplates:readonly FurnitureTemplate[]=[
 {id:'cabinet-open',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Open cabinet',category:'Cabinets',description:'Basic cabinet with adjustable, evenly spaced shelves.',kind:'cabinet',status:'ready',defaultSpec:{width:800,height:900,depth:350,shelves:2}},
 {id:'cabinet-empty',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Empty carcass',category:'Cabinets',description:'Four-panel open cabinet, ready for future doors or drawers.',kind:'cabinet',status:'ready',defaultSpec:{width:800,height:900,depth:350,shelves:0}},
 {id:'cabinet-shelving',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Shelf tower',category:'Storage',description:'Tall storage module with four internal shelves.',kind:'cabinet',status:'ready',defaultSpec:{width:600,height:1800,depth:350,shelves:4}},
 {id:'drawer-unit',version:1,title:'Drawer module',category:'Cabinets',description:'Configurable drawers, fronts and runners.',kind:'drawer',status:'planned'},
 {id:'wardrobe',version:1,title:'Wardrobe',category:'Storage',description:'Clothes rail, shelves and optional doors.',kind:'wardrobe',status:'planned'},
 {id:'desk',version:1,title:'Desk',category:'Tables & desks',description:'Worktop, side panels and support structure.',kind:'desk',status:'planned'},
 {id:'tv-unit',version:1,title:'TV console',category:'Living room',description:'Wide, low storage and media bays.',kind:'entertainment',status:'planned'}
]
export function availableTemplate(id:string):FurnitureTemplate|undefined{
 return furnitureTemplates.find(template=>template.id===id&&template.status==='ready')
}
export function initialSpecForTemplate(id:string,materialId:string):CabinetSpec{
 const template=availableTemplate(id)
 if(!template||template.kind!=='cabinet'||!template.defaultSpec)throw Error('Template not available: '+id)
 return {...cabinetDefaults(materialId),...template.defaultSpec,label:template.title,templateId:template.id,templateVersion:template.version}
}

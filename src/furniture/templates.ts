import {cabinetDefaults} from './cabinet.ts'
import {drawerDefaults} from './drawer.ts'
import type {CabinetSpec} from './cabinet.ts'
import {getComponentDefinition} from './component-engine.ts'

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
 defaultSpec?:Partial<Pick<CabinetSpec,'width'|'height'|'depth'|'shelves'|'drawers'|'split'>>
 drawerRunnerLength?:number
}
export const furnitureTemplates:readonly FurnitureTemplate[]=[
 {id:'cabinet-open',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Open cabinet',category:'Cabinets',description:'Basic cabinet with adjustable, evenly spaced shelves.',kind:'cabinet',status:'ready',defaultSpec:{width:800,height:900,depth:350,shelves:2}},
 {id:'cabinet-empty',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Empty carcass',category:'Cabinets',description:'Four-panel open cabinet, ready for future doors or drawers.',kind:'cabinet',status:'ready',defaultSpec:{width:800,height:900,depth:350,shelves:0}},
 {id:'cabinet-shelving',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Shelf tower',category:'Storage',description:'Tall storage module with four internal shelves.',kind:'cabinet',status:'ready',defaultSpec:{width:600,height:1800,depth:350,shelves:4}},
 {id:'chest-3-drawer',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Chest · 3 drawers',category:'Bedroom',description:'Three equally sized full-width drawers, each with clearance-aware runners and configurable fronts.',kind:'cabinet',status:'ready',defaultSpec:{width:900,height:820,depth:450,shelves:0,drawers:3},drawerRunnerLength:400},
 {id:'chest-5-drawer',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Chest · 5 drawers',category:'Bedroom',description:'Five full-width repeated drawer components, each recomputed when the chest resizes.',kind:'cabinet',status:'ready',defaultSpec:{width:900,height:1100,depth:450,shelves:0,drawers:5},drawerRunnerLength:400},
 {id:'chest-two-column',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Chest · two columns',category:'Bedroom',description:'Two vertical compartments with three narrow drawers each.',kind:'cabinet',status:'ready',defaultSpec:{width:1100,height:900,depth:450,shelves:0,drawers:0,split:{axis:'vertical',ratio:50,first:{content:'drawers',count:3},second:{content:'drawers',count:3}}},drawerRunnerLength:400},
 {id:'chest-mixed-drawers',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Chest · shallow and deep',category:'Bedroom',description:'Separate upper and lower drawer compartments with distinct opening heights.',kind:'cabinet',status:'ready',defaultSpec:{width:900,height:1000,depth:450,shelves:0,drawers:0,split:{axis:'horizontal',ratio:65,first:{content:'drawers',count:2},second:{content:'drawers',count:2}}},drawerRunnerLength:400},
 {id:'chest-open-shelf',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Chest · drawer and shelves',category:'Bedroom',description:'Drawer bank beside open shelving with independently sized compartments.',kind:'cabinet',status:'ready',defaultSpec:{width:1100,height:900,depth:450,shelves:0,drawers:0,split:{axis:'vertical',ratio:62,first:{content:'drawers',count:4},second:{content:'shelves',count:3}}},drawerRunnerLength:400},
 {id:'kitchen-base-open',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Open kitchen base carcass',category:'Kitchen',description:'800 × 720 × 560 mm carcass with one adjustable shelf. No doors, back or plinth modeled.',kind:'cabinet',status:'ready',defaultSpec:{width:800,height:720,depth:560,shelves:1}},
 {id:'kitchen-wall-open',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Open wall-cabinet carcass',category:'Kitchen',description:'800 × 720 × 320 mm open storage with two shelves; wall-fixing hardware is excluded.',kind:'cabinet',status:'ready',defaultSpec:{width:800,height:720,depth:320,shelves:2}},
 {id:'pantry-open',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Pantry shelf tower',category:'Kitchen',description:'Tall 600 × 1950 mm five-shelf carcass; requires separate anti-tip and back support design.',kind:'cabinet',status:'ready',defaultSpec:{width:600,height:1950,depth:450,shelves:5}},
 {id:'bookcase-two-bay',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Two-bay bookcase',category:'Living room',description:'1100 × 1600 mm open bookcase with a center divider and asymmetric shelf banks.',kind:'cabinet',status:'ready',defaultSpec:{width:1100,height:1600,depth:350,shelves:0,split:{axis:'vertical',ratio:52,first:{content:'shelves',count:4},second:{content:'shelves',count:3}}}},
 {id:'nightstand-two-drawer',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Bedside · two drawers',category:'Bedroom',description:'Compact 520 × 580 mm bedside cabinet with two working drawer components and side-mounted runners.',kind:'cabinet',status:'ready',defaultSpec:{width:520,height:580,depth:450,shelves:0,drawers:2},drawerRunnerLength:400},
 {id:'shoe-storage-open',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Open shoe shelving',category:'Hallway',description:'Four horizontal shelves in a 900 × 900 mm entrance module; no angled racks or door hardware.',kind:'cabinet',status:'ready',defaultSpec:{width:900,height:900,depth:350,shelves:4}},
 {id:'media-two-bay-open',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Media console · open bays',category:'Living room',description:'Low 1400 × 520 mm console with a central divider and shelves; no cable openings.',kind:'cabinet',status:'ready',defaultSpec:{width:1400,height:520,depth:400,shelves:0,split:{axis:'vertical',ratio:50,first:{content:'shelves',count:1},second:{content:'shelves',count:1}}}},
 {id:'media-drawer-bay',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Media console · shelf + drawers',category:'Living room',description:'1500 × 650 mm low unit with open shelving beside two runner-aware drawers; no back or cable management.',kind:'cabinet',status:'ready',defaultSpec:{width:1500,height:650,depth:450,shelves:0,split:{axis:'vertical',ratio:55,first:{content:'shelves',count:1},second:{content:'drawers',count:2}}},drawerRunnerLength:400},
 {id:'sideboard-mixed',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Sideboard · shelf + drawers',category:'Living room',description:'1600 × 850 mm open sideboard with two shelves and three drawers in separate bays; no cabinet doors.',kind:'cabinet',status:'ready',defaultSpec:{width:1600,height:850,depth:450,shelves:0,split:{axis:'vertical',ratio:55,first:{content:'shelves',count:2},second:{content:'drawers',count:3}}},drawerRunnerLength:400},
 {id:'connected-cubby',version:1,rootComponent:{definitionId:'core/carcass',definitionVersion:1},title:'Connected storage · two modules',category:'Storage',description:'Two adjacent 600 mm open carcasses with independently repeated shelves; connection hardware excluded.',kind:'cabinet',status:'ready',defaultSpec:{width:600,height:750,depth:350,shelves:2,connected:{width:600,shelves:1,drawers:0}}},
 {id:'drawer-unit',version:1,rootComponent:{definitionId:'core/drawer',definitionVersion:1},title:'Drawer module',category:'Building components',description:'Adjustable drawer opening, runner clearance, front and pull style.',kind:'drawer',status:'ready'},
 {id:'wardrobe',version:1,title:'Wardrobe',category:'Storage',description:'Clothes rail, shelves and optional doors.',kind:'wardrobe',status:'planned'},
 {id:'desk',version:1,title:'Desk',category:'Tables & desks',description:'Worktop, side panels and support structure.',kind:'desk',status:'planned'},
 {id:'tv-unit',version:1,title:'TV console',category:'Living room',description:'Wide, low storage and media bays.',kind:'entertainment',status:'planned'}
]
export function availableTemplate(id:string):FurnitureTemplate|undefined{
 return furnitureTemplates.find(template=>template.id===id&&template.status==='ready')
}
export function initialSpecForTemplate(id:string,materialId:string):CabinetSpec{
 const template=availableTemplate(id)
 if(!template||template.kind!=='cabinet'||!template.defaultSpec||!template.rootComponent)throw Error('Template not available: '+id)
 getComponentDefinition(template.rootComponent.definitionId,template.rootComponent.definitionVersion)
 const result:CabinetSpec={...cabinetDefaults(materialId),...structuredClone(template.defaultSpec),
  label:template.title,templateId:template.id,templateVersion:template.version}
 const hasDrawers=(result.drawers??0)>0||
  Boolean(result.split&&(result.split.first.content==='drawers'||result.split.second.content==='drawers'))
 if(hasDrawers)result.drawerConfig={...drawerDefaults(materialId),runnerLength:template.drawerRunnerLength??300}
 return result
}

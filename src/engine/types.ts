export type Mm = number // validated positive/zero integer millimetres only
export type GrainAxis = 'none' | 'x' | 'y'
export type MaterialType = 'PAL' | 'MDF' | 'plywood' | 'custom'
export type EdgeName = 'top' | 'right' | 'bottom' | 'left'
export type EdgeBanding = Record<EdgeName, string | null>
export type Rect = {x: Mm, y: Mm, width: Mm, height: Mm}
export interface Material {id:string; name:string; type:MaterialType; thickness:Mm; finish?:string}
export interface StockSheet {id:string; materialId:string; thickness:Mm; width:Mm; height:Mm; quantity:number|null; grain:GrainAxis; trim:{top:Mm;right:Mm;bottom:Mm;left:Mm}; cost?:number}
export interface Offcut {id:string; materialId:string; thickness:Mm; width:Mm; height:Mm; grain:GrainAxis; quantity:number}
export interface Part {id:string; label:string; width:Mm; height:Mm; quantity:number; materialId:string; rotationAllowed:boolean; grain:GrainAxis; abs:EdgeBanding; group?:string; notes?:string}
export type Heuristic = 'area' | 'short' | 'long'
export interface OptimizationSettings {kerf:Mm; rotationAllowed:boolean; maxDurationMs:number; maxRestarts:number; minOffcutWidth:Mm; minOffcutHeight:Mm; minOffcutArea:number; seed:number}
export interface Project {schemaVersion:1; id:string; name:string; description:string; createdAt:string; updatedAt:string; materials:Material[]; sheets:StockSheet[]; offcuts:Offcut[]; parts:Part[]; settings:OptimizationSettings; lastResult?:OptimizationResult}
export type CutTree = {kind:'part';rect:Rect; instanceId:string} | {kind:'waste';rect:Rect;id:string} | {kind:'cut';rect:Rect; orientation:'vertical'|'horizontal'; at:Mm;kerf:Mm; first:CutTree;second:CutTree}
export interface Placement {instanceId:string; partId:string; x:Mm; y:Mm; width:Mm; height:Mm; rotated:boolean}
export interface BoardLayout {id:string; stockId:string; source:'stock'|'offcut'; materialId:string; thickness:Mm; grain:GrainAxis; width:Mm;height:Mm;trim:StockSheet['trim'];usable:Rect;tree:CutTree;placements:Placement[]}
export interface Unplaced {instanceId:string; partId:string; reason:string}
export interface RemainingOffcut extends Rect {boardId:string; materialId:string; thickness:Mm; grain:GrainAxis; reusable:boolean}
export interface ResultStatistics {requested:number;placed:number;unplaced:number;stockSheetCount:number;offcutSheetCount:number;grossArea:number;usableArea:number;partArea:number;trimArea:number;kerfArea:number;recoverableArea:number;unrecoverableArea:number;utilization:number;cutCount:number;edgeBandMm:Record<string,number>}
export interface OptimizationResult {projectId:string; createdAt:string; boards:BoardLayout[]; unplaced:Unplaced[]; offcuts:RemainingOffcut[]; stats:ResultStatistics; search:{attempts:number;elapsedMs:number;seed:number;strategy:string};valid:boolean;errors:string[]}
export const emptyTrim = () => ({top:0,right:0,bottom:0,left:0})
export const emptyAbs = ():EdgeBanding => ({top:null,right:null,bottom:null,left:null})
export const defaultSettings = ():OptimizationSettings => ({kerf:4,rotationAllowed:true,maxDurationMs:1500,maxRestarts:18,minOffcutWidth:150,minOffcutHeight:150,minOffcutArea:40000,seed:42})
export const createProject = ():Project => {const now=new Date().toISOString(); return {schemaVersion:1,id:crypto.randomUUID(),name:'New furniture project',description:'',createdAt:now,updatedAt:now,materials:[{id:'pal18',name:'PAL 18 mm',type:'PAL',thickness:18},{id:'mdf18',name:'MDF 18 mm',type:'MDF',thickness:18}],sheets:[{id:'pal2800',materialId:'pal18',thickness:18,width:2800,height:2070,quantity:null,grain:'y',trim:emptyTrim()},{id:'mdf2800',materialId:'mdf18',thickness:18,width:2800,height:1220,quantity:null,grain:'none',trim:emptyTrim()}],offcuts:[],parts:[],settings:defaultSettings()}}

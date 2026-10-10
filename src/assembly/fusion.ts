import type {Project} from '../engine/types.ts'
import type {ProjectAssembly} from './model.ts'
import {resolveAssembly} from './model.ts'
/** Fusion 360 Python script: real, separately named solid B-rep components, not mesh. */
export function exportFusionPython(project:Project,assembly:ProjectAssembly):string{
 const resolved=resolveAssembly(project,assembly)
 if(!resolved.length)throw Error('Assembly has no valid panel instances to export.')
 const data={name:assembly.label,items:resolved.map(({instance,part,material})=>({
  name:part.label+' '+(instance.instanceIndex+1),widthMm:part.width,heightMm:part.height,
  thicknessMm:material.thickness,positionMm:instance.positionMm,rotationDeg:instance.rotationDeg
 }))}
 return `# Furniture Builder: Autodesk Fusion Python API importer.
# Fusion > Utilities > Scripts and Add-Ins > New Python Script; paste and run.
# Coordinate units mm (input), cm (Fusion API). XYZ Euler rotation as Three.js.
# Produces editable direct-model solid components. Save as F3D/STEP in Fusion.
import adsk.core, adsk.fusion, json, math, traceback
DATA=json.loads(${JSON.stringify(JSON.stringify(data))})

def axes(deg):
    x,y,z=[math.radians(float(n)) for n in deg]
    cx,sx=math.cos(x),math.sin(x)
    cy,sy=math.cos(y),math.sin(y)
    cz,sz=math.cos(z),math.sin(z)
    vx=adsk.core.Vector3D.create(cy*cz,cx*sz+sx*sy*cz,sx*sz-cx*sy*cz)
    vy=adsk.core.Vector3D.create(-cy*sz,cx*cz-sx*sy*sz,sx*cz+cx*sy*sz)
    return vx,vy

def run(context):
    ui=None
    try:
        app=adsk.core.Application.get()
        ui=app.userInterface
        app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)
        design=adsk.fusion.Design.cast(app.activeProduct)
        design.designType=adsk.fusion.DesignTypes.DirectDesignType
        root=design.rootComponent
        root.name=DATA['name']
        manager=adsk.fusion.TemporaryBRepManager.get()
        for item in DATA['items']:
            vx,vy=axes(item['rotationDeg'])
            p=adsk.core.Point3D.create(*[v/10.0 for v in item['positionMm']])
            box=adsk.core.OrientedBoundingBox3D.create(
                p,vx,vy,item['widthMm']/10.0,
                item['heightMm']/10.0,item['thicknessMm']/10.0
            )
            temp=manager.createBox(box)
            if not temp:raise RuntimeError('Box creation failed: '+item['name'])
            occ=root.occurrences.addNewComponent(adsk.core.Matrix3D.create())
            component=occ.component
            component.name=item['name']
            body=component.bRepBodies.add(temp)
            if not body:raise RuntimeError('Solid creation failed: '+item['name'])
            body.name=item['name']
        camera=app.activeViewport.camera
        camera.isFitView=True
        app.activeViewport.camera=camera
        ui.messageBox('Created '+str(len(DATA['items']))+' solid panel components.')
    except:
        if ui:ui.messageBox('Furniture Builder import failed:\\n'+traceback.format_exc())
`
}

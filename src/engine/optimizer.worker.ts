import type {Project} from './types.ts'
import {optimizeProject} from './optimize.ts'
self.onmessage=(event:MessageEvent<{id:string;project:Project}>)=>{
  const {id,project}=event.data
  try{const result=optimizeProject(project);self.postMessage({id,result})}
  catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)})}
}

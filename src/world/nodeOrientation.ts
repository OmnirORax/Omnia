import type {Quaternion} from 'three';
/** Content faces the camera at rest while inheriting its parent's authored rotation. */
export function orientNodeContent(content:Quaternion,camera:Quaternion,node?:Quaternion,faceCamera=false){if(faceCamera&&node)content.copy(node).invert().multiply(camera);else content.identity();}

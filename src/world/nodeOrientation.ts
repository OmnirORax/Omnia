import type {Quaternion} from 'three';
/** Content faces the camera at rest while inheriting its parent's authored rotation. */
export function orientNodeContent(content:Quaternion,camera:Quaternion){content.copy(camera);}

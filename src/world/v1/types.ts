import type * as T from 'three';
/** Live renderer references projected from V2; no legacy saved graph owner. */
export type TextScene={
 nodes:Map<string,{group:T.Group;presentation:T.Group;cell:T.Mesh;outline:T.Mesh<T.RingGeometry,T.MeshBasicMaterial>;text:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;visual?:T.Group;selected:boolean;color:string;opacity:number}>;
 connectors:{data:{key:string};line:T.Line<T.BufferGeometry,T.LineBasicMaterial>;path?:T.Curve<T.Vector3>;arrow:T.Object3D;label?:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;textOpacity:number}[];
 animateSelection:(camera:T.PerspectiveCamera,seconds:number,animate:boolean)=>void;
};
export type WallpaperComposite={readonly visible:boolean;without:<T>(render:()=>T)=>T;renderComposite:(texture:T.Texture)=>void};

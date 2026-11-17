import {radialDimensions,RADIAL_GEOMETRY} from './radialMenuModel.ts';
import {mathematicalRingOrders,radialSlotCapacity} from '../../../properties/mathematicalDial.ts';
import {dialRingSlot} from './dialSlots.ts';
import type {DialNotation} from '../../../properties/dialNotation.ts';
/** The same geometry serves live controls and fixed number glyphs. */
export function dialDrawingGeometry(base:1|2,keys:readonly string[]){
 const orders=mathematicalRingOrders(keys),minimum=radialDimensions(2,6,0,base*RADIAL_GEOMETRY.minimumSize),extent=2*(minimum.radius+(orders-1)*minimum.size+minimum.size/2+1);
 const rings=Array.from({length:orders+1},(_,order)=>{const radius=minimum.radius+order*minimum.size;return {order,radius,count:radialSlotCapacity(radius,minimum.size)};});
 return {orders,extent,size:minimum.size,rings};
}
export function dialDrawingMarks(notation:DialNotation,geometry=dialDrawingGeometry(notation.base,notation.marks.selected)){
 return notation.marks.selected.map(key=>{const [order,index]=key.split(':').map(Number),ring=geometry.rings[order];if(!ring)return undefined;const slot=dialRingSlot(order,index,ring.radius,ring.count,geometry.size,geometry.extent,notation.clockwise);return slot?{...slot,mode:notation.marks.modes[key]??'normal'}:undefined;}).filter(mark=>!!mark);
}

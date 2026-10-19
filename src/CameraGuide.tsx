import type { RefCallback } from "react";
import * as THREE from "three";
import { FunctionControl } from "./ui/UIWorkspace";
import { UIField } from "./ui/UIField";

export const DEFAULT_CAMERA_POSITION = new THREE.Vector3(7, 5, 9);
export const DEFAULT_CAMERA_FOV = 55;
const axes = ["x", "y", "z"] as const;
const colors = { x: "#f68b88", y: "#8cdb9b", z: "#89baff" };
const coordinates = (point: THREE.Vector3) => axes.map(axis => `${axis.toUpperCase()} ${point[axis].toFixed(2)}`).join(" · ");

export function updateCameraGuide(element: HTMLElement, camera: THREE.PerspectiveCamera, target: THREE.Vector3, selected?: THREE.Vector3) {
  const distance = Math.max(camera.near, camera.position.distanceTo(target));
  const zoom = 100 * DEFAULT_CAMERA_POSITION.length() / distance * Math.tan(THREE.MathUtils.degToRad(DEFAULT_CAMERA_FOV / 2)) / Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2));
  const set = (name: string, text: string) => { const node = element.querySelector(`[data-camera="${name}"]`); if (node) node.textContent = text; };
  set("zoom", `Zoom ${zoom < 10 ? zoom.toFixed(2) : zoom.toFixed(0)}%`);
  set("direction", coordinates(camera.getWorldDirection(new THREE.Vector3())));
  set("position", coordinates(camera.position));
  set("target", coordinates(target));
  set("node", selected ? coordinates(selected) : "Select a node");
  const inverse = camera.quaternion.clone().invert();
  for (const axis of axes) for (const sign of [-1, 1]) {
    const direction = new THREE.Vector3(); direction[axis] = sign; direction.applyQuaternion(inverse);
    const g = element.querySelector<SVGGElement>(`[data-compass="${axis}:${sign}"]`); if (!g) continue;
    const line = g.querySelector("line")!, label = g.querySelector("text")!;
    line.setAttribute("x2", String(48 + direction.x * 30)); line.setAttribute("y2", String(48 - direction.y * 30));
    label.setAttribute("x", String(48 + direction.x * 40));
    label.setAttribute("y", String(Math.hypot(direction.x, direction.y) < 0.15 ? 48 + (direction.z > 0 ? -10 : 10) : 48 - direction.y * 40));
    g.style.opacity = String(direction.z > 0 ? 1 : 0.5);
  }
}

/** A normal movable UI field; it never changes graph coordinates. */
export function CameraGuide({ attach }: { attach: RefCallback<HTMLDivElement> }) {
  return <UIField id="ui:cameraGuide" label="Zoom, camera and origin compass" category="View">
    <div ref={attach} className="camera-guide" role="region" aria-label="Zoom and world origin compass">
      <div className="camera-guide-heading"><output data-camera="zoom" title="100% is the default camera distance and field of view, measured at the orbit target">Zoom 100%</output><FunctionControl id="zoom100" /></div>
      <div className="camera-guide-body">
        <svg viewBox="0 0 96 96" role="img" aria-label="World XYZ axes in the current camera orientation">
          {axes.flatMap(axis => [-1, 1].map(sign => <g data-compass={`${axis}:${sign}`} key={`${axis}:${sign}`} stroke={colors[axis]} fill={colors[axis]}>
            <line x1="48" y1="48" x2="48" y2="48" strokeWidth={sign > 0 ? 2 : 1} strokeDasharray={sign < 0 ? "3 3" : undefined} />
            <text textAnchor="middle" dominantBaseline="central" stroke="none" fontSize="10">{sign > 0 ? "+" : "−"}{axis.toUpperCase()}</text>
          </g>))}
          <circle cx="48" cy="48" r="3" fill="#e6eff9" />
        </svg>
        <div><strong>World origin</strong><div>0, 0, 0</div><small>Y up · XY text plane</small></div>
      </div>
      <dl><dt>Looking</dt><dd data-camera="direction" /><dt>Camera</dt><dd data-camera="position" /><dt>Orbit target</dt><dd data-camera="target" /><dt>Node world XYZ</dt><dd data-camera="node">Select a node</dd></dl>
      <div className="camera-guide-actions"><FunctionControl id="cameraOrigin" /><FunctionControl id="rollLeft" /><FunctionControl id="rollRight" /></div>
    </div>
  </UIField>;
}

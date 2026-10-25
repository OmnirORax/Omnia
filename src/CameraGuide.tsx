import type { RefCallback } from "react";
import { FunctionControl } from "./ui/UIWorkspace";
import { UIField } from "./ui/UIField";

export { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_FOV, updateCameraGuide } from "./cameraGuideState";
const axes = ["x", "y", "z"] as const;
const colors = { x: "#f68b88", y: "#8cdb9b", z: "#89baff" };

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
      <div className="camera-guide-actions"><FunctionControl id="world.navigate" /><FunctionControl id="cameraOrigin" /><FunctionControl id="rollLeft" /><FunctionControl id="rollRight" /></div>
    </div>
  </UIField>;
}

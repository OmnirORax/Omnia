import { useUI } from "./context";
import { UIAction } from "./UIAction";
import { UIField } from "./UIField";
import { UISection } from "./UISection";
import type { AlignmentOperation, AlignmentReference } from "./selection";

const commands: { id: AlignmentOperation; label: string }[] = [
  { id: "left", label: "Align left" },
  { id: "centerX", label: "Center horizontally" },
  { id: "right", label: "Align right" },
  { id: "top", label: "Align top" },
  { id: "centerY", label: "Center vertically" },
  { id: "bottom", label: "Align bottom" },
  { id: "distributeX", label: "Distribute horizontally" },
  { id: "distributeY", label: "Distribute vertically" },
];
/** The menu and Align UI window expose the same registered, editable controls. */
export function AlignmentControls({ count, onArrange }: {
  count: number; onArrange: (operation: AlignmentOperation, reference: AlignmentReference) => void;
}) {
  const ui = useUI(), reference = ui.layout.alignmentReference ?? (count > 1 ? "selection" : "window");
  return <div data-ui-alignment>
    <UIField id="ui:align:reference" label="Align relative to" category="UI alignment">
      <label>Relative to<select aria-label="Align relative to" value={reference} onChange={event => {
        const alignmentReference = event.target.value as AlignmentReference;
        ui.update(layout => ({ ...layout, alignmentReference }));
      }}>
        <option value="selection">Selection bounds</option><option value="window">App window</option>
      </select></label>
    </UIField>
    <UISection id="ui-align-commands" title="Alignment">
      <div className="ui-alignment-commands">{commands.map(command => <UIAction
        key={command.id} id={`ui:align:${command.id}`} label={command.label} category="UI alignment"
        disabled={count < (command.id.startsWith("distribute") ? 3 : 1)}
        onClick={() => onArrange(command.id, reference)}
      />)}</div>
    </UISection>
  </div>;
}

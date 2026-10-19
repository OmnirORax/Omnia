import type { Appearance, BinderPresentation } from "./graph/structural";
import { UIField } from "./ui/UIField";

export function AppearanceControls({
  label,
  value,
  defaults,
  onChange,
}: {
  label: string;
  value?: Appearance;
  defaults: Appearance;
  onChange: (value: Appearance) => void;
}) {
  const current = value ?? defaults;
  return (
    <fieldset className="appearance-controls">
      <legend>{label} appearance</legend>
      <UIField
        id={`appearance:${label}:color`}
        label={`${label} color`}
        category={label === "Node" ? "Nodes" : "Relationships"}
      >
        <label>
          Color
          <input
            aria-label={`${label} color`}
            type="color"
            value={current.color}
            onChange={(event) => onChange({ ...current, color: event.target.value })}
          />
        </label>
      </UIField>
      <UIField
        id={`appearance:${label}:opacity`}
        label={`${label} opacity`}
        category={label === "Node" ? "Nodes" : "Relationships"}
      >
        <label>
          Opacity: {Math.round(current.opacity * 100)}%
          <input
            aria-label={`${label} opacity`}
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={current.opacity}
            onChange={(event) => onChange({ ...current, opacity: Number(event.target.value) })}
          />
        </label>
      </UIField>
    </fieldset>
  );
}
export function BinderControls({
  value,
  onChange,
  composition = false,
  defaultText = "",
}: {
  value: BinderPresentation;
  onChange: (value: BinderPresentation) => void;
  composition?: boolean;
  defaultText?: string;
}) {
  const operators = value.operators ?? [];
  return (
    <>
      <UIField id="binder:text" label="Binder text" category="Relationships">
        <label>
          Binder text
          <input
            aria-label="Binder text"
            maxLength={500}
            value={value.text ?? defaultText}
            placeholder="Default relationship label"
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </label>
      </UIField>
      <AppearanceControls
        label="Binder"
        value={value.appearance}
        defaults={{ color: composition ? "#83c9c1" : "#9fc4e9", opacity: 0.85 }}
        onChange={(appearance) => onChange({ appearance })}
      />
      <h3>Binder operators</h3>
      <p>
        Text annotations for this binder.{" "}
        {composition
          ? "Its authored containment remains unchanged."
          : "Its relationship type and participant roles remain unchanged."}
      </p>
      {operators.map((operator, index) => (
        <UIField
          key={operator.id}
          id={`binder:operator:${operator.id}`}
          label={`Binder operator ${index + 1}`}
          category="Relationships"
        >
          <div className="operator-row">
            <label>
              Operator {index + 1}
              <input
                aria-label={`Binder operator ${index + 1}`}
                maxLength={500}
                value={operator.text}
                onChange={(event) =>
                  onChange({
                    operators: operators.map((o) =>
                      o.id === operator.id ? { ...o, text: event.target.value } : o,
                    ),
                  })
                }
              />
            </label>
            <button
              aria-label={`Remove binder operator ${index + 1}`}
              onClick={() => onChange({ operators: operators.filter((o) => o.id !== operator.id) })}
            >
              ×
            </button>
          </div>
        </UIField>
      ))}
      <button
        disabled={operators.length >= 32}
        onClick={() =>
          onChange({ operators: [...operators, { id: crypto.randomUUID(), text: "" }] })
        }
      >
        + Binder operator
      </button>
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { MAX_ASSET_BYTES, validateAsset, type Visual, type VisualAsset } from "./graph/assets";
import { UIField } from "./ui/UIField";

const encodeSVG = (svg: string) =>
  `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
export function VisualControls({
  label,
  value = {},
  assets,
  onChange,
  onAsset,
  allowModels = true,
  iconColor = "#c8dfff",
}: {
  label: string;
  value?: Visual;
  assets: VisualAsset[];
  onChange: (visual: Visual) => void;
  onAsset: (asset: VisualAsset, visual: Visual) => void;
  allowModels?: boolean;
  iconColor?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; svg?: string }[]>([]);
  const [status, setStatus] = useState("");
  const [picker, setPicker] = useState(false);
  const mounted = useRef(true);
  const latest = useRef({ value, assets, onChange, onAsset });
  latest.current = { value, assets, onChange, onAsset };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function applyAsset(asset: VisualAsset) {
    if (!mounted.current) return;
    const current = latest.current,
      existing = current.assets.find((a) => a.dataUrl === asset.dataUrl);
    if (existing)
      current.onChange({ ...current.value, character: undefined, assetId: existing.id });
    else current.onAsset(asset, { ...current.value, character: undefined, assetId: asset.id });
  }
  useEffect(() => {
    if (!picker) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const catalog = (await import("@iconify-json/lucide/icons.json")).default;
        const local = Object.entries(catalog.icons)
          .filter(([name]) => name.includes(query.toLowerCase().trim().replace(/\s+/g, "-")))
          .slice(0, 60)
          .map(([name, icon]) => ({
            id: `lucide:${name}`,
            svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${catalog.width} ${catalog.height}" color="${iconColor}">${icon.body}</svg>`,
          }));
        if (controller.signal.aborted) return;
        setResults(local);
        setStatus("Iconify · bundled Lucide icons");
        if (query.trim().length < 2) return;
        try {
          const response = await fetch(
            `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=48`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error("Icon search unavailable");
          const data = await response.json();
          if (!controller.signal.aborted) {
            setResults(
              [
                ...local,
                ...data.icons
                  .filter((id: string) => !local.some((i) => i.id === id))
                  .map((id: string) => ({ id })),
              ].slice(0, 96),
            );
            setStatus("Iconify search results");
          }
        } catch {
          if (!controller.signal.aborted)
            setStatus("Online search unavailable; bundled Iconify Lucide icons remain searchable.");
        }
      } catch {
        if (!controller.signal.aborted) setStatus("Could not load icon catalog.");
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, picker, iconColor]);
  async function choose(icon: { id: string; svg?: string }) {
    try {
      const [prefix, name] = icon.id.split(":");
      const response = icon.svg
        ? null
        : await fetch(
            `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg?color=${encodeURIComponent(iconColor)}`,
          );
      if (response && !response.ok) throw new Error("Could not download icon.");
      const asset: VisualAsset = {
        id: crypto.randomUUID(),
        name: icon.id,
        kind: "image",
        source: `https://icon-sets.iconify.design/${prefix}/${name}/`,
        dataUrl: encodeSVG(icon.svg ?? (await response!.text())),
      };
      validateAsset(asset);
      applyAsset(asset);
      setPicker(false);
      setStatus("");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_ASSET_BYTES) throw new Error("Choose a file under 900 KB.");
      const kind = /\.glb$/i.test(file.name) ? "glb" : "image";
      if (kind === "glb" && !allowModels)
        throw new Error("UI function buttons use image icons or characters.");
      const mime =
        kind === "glb"
          ? "model/gltf-binary"
          : /\.svg$/i.test(file.name)
            ? "image/svg+xml"
            : file.type;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(String(reader.result).replace(/^data:[^;]+;/, `data:${mime};`));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const asset: VisualAsset = { id: crypto.randomUUID(), name: file.name, kind, dataUrl };
      validateAsset(asset);
      if (kind === "glb") {
        const [{ GLTFLoader }, { disposeVisual }] = await Promise.all([
          import("three/addons/loaders/GLTFLoader.js"),
          import("./visualScene"),
        ]);
        const gltf = await new GLTFLoader().parseAsync(await file.arrayBuffer(), "");
        let meshes = 0;
        gltf.scene.traverse((o) => {
          if ((o as { isMesh?: boolean }).isMesh) meshes++;
        });
        disposeVisual(gltf.scene);
        if (!meshes) throw new Error("This GLB has no visible mesh geometry.");
      } else {
        const image = new Image();
        image.src = asset.dataUrl;
        await image.decode();
      }
      applyAsset(asset);
      setStatus("");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <fieldset className="visual-controls">
      <legend>{label} visual</legend>
      <UIField
        id={`visual:${label}:symbol`}
        label={`${label} symbol`}
        category={label === "Node" ? "Nodes" : "Relationships"}
      >
        <label>
          Character / symbol
          <input
            aria-label={`${label} symbol`}
            maxLength={64}
            value={value.character ?? ""}
            onChange={(e) => onChange({ ...value, assetId: undefined, character: e.target.value })}
          />
        </label>
      </UIField>
      <button onClick={() => setPicker(!picker)}>Search Iconify for {label.toLowerCase()}</button>
      {picker && (
        <div className="icon-picker">
          <input
            aria-label="Search Iconify"
            placeholder="Search icons…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="icon-results">
            {results.map((icon) => (
              <button
                key={icon.id}
                title={icon.id}
                aria-label={`Use ${icon.id}`}
                onClick={() => choose(icon)}
              >
                <img
                  alt=""
                  src={
                    icon.svg
                      ? encodeSVG(icon.svg)
                      : `https://api.iconify.design/${icon.id.replace(":", "/")}.svg?color=${encodeURIComponent(iconColor)}`
                  }
                />
                <small>{icon.id}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      <UIField
        id={`visual:${label}:asset`}
        label={`${label} asset import`}
        category={label === "Node" ? "Nodes" : "Relationships"}
      >
        <label>
          {allowModels ? "Import SVG / PNG / GLB" : "Import SVG / PNG icon"}
          <input
            aria-label={`${label} asset file`}
            type="file"
            accept={allowModels ? ".svg,.png,.jpg,.jpeg,.webp,.glb" : ".svg,.png,.jpg,.jpeg,.webp"}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </UIField>
      {!!assets.length && (
        <UIField
          id={`visual:${label}:saved`}
          label={`${label} saved asset`}
          category={label === "Node" ? "Nodes" : "Relationships"}
        >
          <label>
            Saved asset
            <select
              aria-label={`${label} saved asset`}
              value={value.assetId ?? ""}
              onChange={(e) =>
                onChange({ ...value, character: undefined, assetId: e.target.value || undefined })
              }
            >
              <option value="">No asset</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </UIField>
      )}
      <UIField
        id={`visual:${label}:text`}
        label={`${label} show text`}
        category={label === "Node" ? "Nodes" : "Relationships"}
      >
        <label>
          <input
            type="checkbox"
            aria-label={`${label} show text`}
            checked={value.showText !== false}
            onChange={(e) => onChange({ ...value, showText: e.target.checked })}
          />{" "}
          Show text alongside visual
        </label>
      </UIField>
      <UIField
        id={`visual:${label}:size`}
        label={`${label} visual size`}
        category={label === "Node" ? "Nodes" : "Relationships"}
      >
        <label>
          Visual size
          <input
            aria-label={`${label} visual size`}
            type="range"
            min="0.3"
            max="5"
            step="0.1"
            value={value.size ?? (value.assetId || value.character ? 1.4 : 1)}
            onChange={(e) => onChange({ ...value, size: Number(e.target.value) })}
          />
        </label>
      </UIField>
      <button onClick={() => onChange({ showText: true })}>
        Reset {label.toLowerCase()} visual
      </button>
      {status && <p role="status">{status}</p>}
      {value.assetId && assets.find((a) => a.id === value.assetId)?.source && (
        <a
          href={assets.find((a) => a.id === value.assetId)!.source}
          target="_blank"
          rel="noreferrer"
        >
          Icon source and license
        </a>
      )}
    </fieldset>
  );
}

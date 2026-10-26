import { OmnicWorkspaceActions } from "./omnic/WorkspaceActions";
import { forkOmnicDefinition, saveOmnicDefinition } from "./omnic/document";
import { createRecipe } from "./omnic/presets";
import type { Recipe } from "./omnic/model";
import { createHeldActions } from "./ui/heldActions";
import { transformPlacements } from "./navigation/transforms";
import { functionShortcutBinding } from "./workspaceActions";
import { invokeCatalogAction } from "./workspaceActions";
import { SearchController } from "./ui/SearchController";
import { ShortcutConfiguration } from "./ui/ShortcutConfiguration";
import { FrameResizeController } from "./ui/FrameResize";
import { FrameViewportSystem } from "./ui/FrameViewport";
import { createActionHistory } from "./ui/actionHistory";
import { HistoryActionBridge, HistoryControls } from "./ui/ContextualHistoryController";
import { settingsPropertyBindings } from "./properties/settingsAdapter";
import { CoupledField } from "./properties/CoupledProperties";
import { EmbeddedGroup } from "./ui/EmbeddedGroup";
import { stableUIHash } from "./ui/identity";
import { UISection } from "./ui/UISection";
import { CloudPanel } from "./backend/CloudPanel";
import { ScenePanel } from "./scene/ScenePanel";
import { sceneReferenceKey, useSceneBackground } from "./scene/background";
import { AppearancePreviewActions } from "./appearance/PreviewPrompt";
import { AppearanceRecovery } from "./appearance/Recovery";
import { appendCheckpoint, CHECKPOINTS_KEY, loadCheckpoints, safeAppearance, type Checkpoint } from "./appearance/checkpoints";
import { sameAppearance } from "./appearance/session";
import { MasterController } from "./appearance/MasterController";
import { resolveControllerAppearance } from "./appearance/resolve";
import { applyValue, type Controller } from "./appearance/model";
import { controllerTargets, PROPERTIES, appearanceFonts } from "./appearance/registry";
import { AppearanceAdjustment } from "./appearance/Controls";
import { LEGACY_CONTROLS } from "./appearance/legacy";
import { lazy, Suspense, useLayoutEffect, useEffect, useMemo, useRef, useState } from "react";
import "./workbench.css";
import { descendants, newId, parseAtlas } from "./graph/model";
import type { Atlas, AtlasNode } from "./graph/model";
import {
  emptyDocument,
  ensureVariantPlacements,
  editorView,
  expandPlacement,
  toggleSubtree,
  parseDocument,
  reconcileEditor,
  validateDocument,
  type Document as AtlasDocument,
  type Frame,
  type FrameScope,
} from "./graph/structural";
import { parseChangeSet, validateChangeSet, type Preview } from "./graph/changeset";
import { ensureBinderSpacing, compactLayout, createPlacement, movePlacement, nearestFree, reparentStructure, reparentVisual, worldPositions, type ReflowScope, type GridSpacing } from "./graph/layout3d";
import { ACTIONS, SETTINGS_KEY, actionForKey, defaultSettings, isFeatureAction, isNudgeAction, isTypingTarget, keyConflict, loadSettings, normalizeSettings, normalizeKey, normalizePointer, type ActionId, type NudgeActionId, type WorkspaceSettings } from "./workspaceActions";
import { clearRecordedShortcutPress, FEATURE_ACTIONS, featureActionRuntime, recordedShortcutTail, recordShortcutPress } from "./featureActions";
import { claimUIPress } from "./ui/pointerOwnership";
import type { ContextAction, ContextTarget, NavigationCommand } from "./SpatialWorkspace";
import { AppearanceControls, BinderControls } from "./AppearanceControls";
import { resolveAppearance } from "./graph/appearance";
import { loadThemePresets, parseThemeTemplate, themeTemplate, THEME_PRESETS_KEY, type ThemeTemplate } from "./themeTemplates";
import { activityPreview, type ActivityPreview } from "./appearance/activityPreview";
import { WindowSparkles } from "./WindowSparkles";
import { fontFamily, MAX_FONT_TEMPLATE_BYTES, type CustomFont } from "./fonts";
import { embeddedFont, importCustomFonts, importFontFile, listCustomFonts, loadFont } from "./fontLibrary";
import { createLayoutView, hierarchyLayout, flowLayout, switchLayoutView, chartedBinders } from "./graph/presentation";
import { addVariant, nodeEntityId, projectVariants } from "./graph/variants";
import { ShortcutDisplay, ShortcutGestures } from "./ShortcutDisplay";
import { VisualControls } from "./VisualControls";
import { deleteConceptSubtrees, deletionSummary } from "./graph/selection";
import type { Visual, VisualAsset } from "./graph/assets";
import type { BinderPresentation } from "./graph/structural";
import { isolateSpatialContext, projectSpatial } from "./graph/spatial";
import { UIWorkspace, FunctionControl, UIArrangeButtons, UIPanel } from "./ui/UIWorkspace";
import { UIFrameStrip } from "./ui/UIFrameStrip";
import { WorkspaceBoundary } from "./WorkspaceBoundary";
import type { UICommand } from "./ui/context";
import { FloatingWindow } from "./ui/FloatingWindow";
import { loadUILayout, ownerOf, reopenContainer, releaseResident, validateUILayout, UI_LAYOUT_KEY } from "./ui/layout";
import type { UIFunction } from "./ui/context";
import { UI_FIELD_CATALOG } from './ui/catalog';
import websiteTemplate from "./ui/default-template.json";
import { useInterfaceState } from "./ui/useInterfaceState";
import type { ColorPreview } from "./textScene";
import { revealSearchPath, type SearchReveal } from "./ui/search";
import { useControlGlow } from "./ui/useControlGlow";
const OmnicComposer = lazy(() => import("./omnic/Composer").then(module => ({default:module.OmnicComposer})));
const SpatialWorkspace = lazy(() => import("./SpatialWorkspace"));

const STORAGE_KEY = "omnium.atlas.v2";
const LEGACY_STORAGE_KEY = "omnium.atlas.v1";
type ViewConfig = {
  format: "omnium-ui-template";
  version: 1 | 2;
  atlas: AtlasDocument | Atlas;
};
type Selection = { kind: "node" | "relationship" | "composition" | "variantBinder" | "visualBinder"; id: string } | null;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
function loadInitial(): { atlas: AtlasDocument; error: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    return { atlas: saved ? parseDocument(saved) : emptyDocument(), error: "" };
  } catch (e) {
    return {
      atlas: emptyDocument(),
      error: `Saved atlas could not be loaded. It has not been overwritten. ${message(e)}`,
    };
  }
}
function Workbench() {
  const [initial] = useState(loadInitial);
  const [document, setDocument] = useState(initial.atlas);
  const [actionHistory] = useState(() => {
    try { return createActionHistory(JSON.parse(localStorage.getItem("omnium-history-options-v1") ?? "null") ?? undefined); }
    catch { return createActionHistory(); }
  });
  useEffect(() => {
    let previous = JSON.stringify(actionHistory.options);
    return actionHistory.subscribe(() => {
      const next = JSON.stringify(actionHistory.options); if (next === previous) return; previous = next;
      try { localStorage.setItem("omnium-history-options-v1", next); } catch { /* Optional preferences; history remains usable. */ }
    });
  }, [actionHistory]);
  const documentRef = useRef(document); documentRef.current = document;
  const ui = useInterfaceState(() => ({ layout: loadUILayout(validateUILayout(structuredClone(websiteTemplate.layout))), settings: (() => { try { return localStorage.getItem(SETTINGS_KEY) ? loadSettings() : normalizeSettings((websiteTemplate as { settings?: unknown }).settings); } catch { return loadSettings(); } })() }), (text) => setError(text), actionHistory);
  const { layout: savedUILayout, update: updateUI, savedSettings, setSettings } = ui;
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchReveal, setSearchReveal] = useState<SearchReveal | null>(null);
  const [masterInspection, setMasterInspection] = useState("");
  const [dismissedInspection, setDismissedInspection] = useState("");
  useEffect(() => { setDismissedInspection(""); }, [masterInspection]);
  const uiLayout = useMemo(() => {
    let revealed = savedUILayout;
    if (masterInspection && masterInspection !== dismissedInspection) {
      const path: string[] = [], seen = new Set<string>();
      let owner: string | undefined = "window:theme";
      while (owner && !seen.has(owner)) { seen.add(owner); path.unshift(owner); owner = ownerOf(savedUILayout, owner); }
      revealed = revealSearchPath(revealed, { path });
    }
    return revealSearchPath(revealed, searchReveal);
  }, [savedUILayout, searchReveal, masterInspection, dismissedInspection]);
  const [colorPreview, setColorPreview] = useState<ColorPreview | null>(null);
  const [activityRequests, setActivityRequests] = useState<ActivityPreview[]>([]);
  const [appearancePreview, setAppearancePreview] = useState<WorkspaceSettings["appearance"] | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [appearanceExit, setAppearanceExit] = useState<"close" | "minimize" | null>(null);
  const [safeView, setSafeView] = useState(() => new URLSearchParams(window.location.search).get("safe-ui") === "1");
  const [checkpoints, setCheckpoints] = useState(loadCheckpoints);
  const [recoveryError, setRecoveryError] = useState("");
  const previewAppearance = appearancePreview ?? ui.settings.appearance;
  const appearancePending = ui.pendingAppearance || !sameAppearance(previewAppearance, savedSettings.appearance);
  const settings = useMemo(() => ({ ...ui.settings, appearance: safeView ? safeAppearance() : previewAppearance }), [ui.settings, safeView, previewAppearance]);
  const propertyBindings = settingsPropertyBindings(settings, setSettings);
  const renderSource = useMemo(() => safeView ? settings.appearance : activityPreview(settings.appearance, activityRequests), [settings.appearance, safeView, activityRequests]);
  const renderedAppearance = useMemo(() => resolveControllerAppearance(renderSource), [renderSource]);
  const renderSettings = useMemo(() => ({ ...settings, appearance: renderedAppearance }), [settings, renderedAppearance]);
  useEffect(() => setAppearancePreview(null), [ui.settings.appearance]);
  const [themePresets, setThemePresets] = useState(loadThemePresets);
  const [themePresetName, setThemePresetName] = useState("My theme");
  const [selectedThemePreset, setSelectedThemePreset] = useState("");
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [fontImporting, setFontImporting] = useState(false);
  useEffect(() => {
    let active = true;
    listCustomFonts().then(fonts => { if (active) setCustomFonts(fonts); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const fontSignature=appearanceFonts(settings.appearance).join('|');
  useEffect(() => {
    let active = true;
    Promise.all(appearanceFonts(settings.appearance).map(loadFont)).catch(error=>{if(active)setError(message(error));});
    return () => { active = false; };
  }, [fontSignature]);
  const nodeThemeDefaults = resolveAppearance(renderedAppearance.nodes, settings.appearance.theme === "neon" ? settings.appearance.accent : "#dce9fa");
  const binderThemeProps = { onPreview: (patch: BinderPresentation) => {
    const color = patch.appearance?.color ?? patch.textAppearance?.color;
    if (selection && color) setColorPreview({ kind: patch.textAppearance ? "binderText" : "binder", id: selection.id, color });
  }, textDefaults: nodeThemeDefaults, binderDefaults: resolveAppearance(renderedAppearance.binders, settings.appearance.theme === "neon" ? settings.appearance.accent : "#9fc4e9") };
  useEffect(() => {
    const root = window.document.documentElement, a = renderedAppearance;
    root.dataset.omniumTheme = a.theme;
    root.dataset.omniumMotion = a.motion > 0 ? "on" : "off";
    root.dataset.omniumTextGlow = "off";
    root.dataset.omniumTextColor = "off";
    root.style.setProperty("--omnium-text-color", a.textColor ?? "inherit");
    root.dataset.omniumControlGlow = a.controlGlow > 0 ? "on" : "off";
    root.style.setProperty("--omnium-control-glow", String(a.controlGlow));
    root.style.setProperty("--omnium-text-shadow", a.textGlow > 0 ? `0 0 ${1 + a.textGlow * 2}px color-mix(in srgb, currentColor ${a.textGlow * 100}%, transparent), 0 0 ${a.textGlow * 10}px color-mix(in srgb, currentColor ${a.textGlow * 70}%, transparent)` : "0 0 0 transparent");
    root.style.setProperty("--omnium-font", fontFamily(a.font));
    const base = a.theme === "neon" ? a.background : "#f8faff";
    root.style.setProperty("--omnium-accent", a.accent);
    root.style.setProperty("--omnium-base", base);
    root.style.setProperty("--omnium-frame-fill", a.theme === "neon" ? a.accent : "#b6d4f2");
    root.style.setProperty("--omnium-panel", `color-mix(in srgb, ${base} ${a.windowOpacity * a.opacity * 100}%, transparent)`);
    root.style.setProperty("--omnium-handle", `color-mix(in srgb, color-mix(in srgb, ${a.theme === "neon" ? a.accent : "#e6eef8"} ${a.theme === "neon" ? 12 : 100}%, ${base}) ${a.windowOpacity * a.opacity * 100}%, transparent)`);
    root.style.setProperty("--omnium-blur", `${a.blur}px`);
    root.style.setProperty("--omnium-motion", String(a.motion));
    root.style.setProperty("--omnium-glow", String(a.glow));
    root.style.setProperty("--omnium-frame-opacity", String(a.windowOpacity * a.opacity * 0.22));
  }, [renderedAppearance]);
  useControlGlow(settings.appearance.controlGlow, settings.appearance.accent, settings.appearance.theme);
  const uiCurrent = useRef(savedUILayout); uiCurrent.current = savedUILayout;
  useEffect(() => { if (!ui.dirty) return; try { localStorage.setItem(UI_LAYOUT_KEY, JSON.stringify(savedUILayout)); } catch { setError("UI arrangement could not be saved locally. Export a UI template to keep it."); } }, [savedUILayout, ui.dirty]);
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(() => new Set());
  const atlas = useMemo(() => editorView(document, expandedVariants), [document, expandedVariants]);
  const [selection, setSelection] = useState<Selection>(null);
  useEffect(() => setColorPreview(null), [document, selection]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [uiCommand, setUICommand] = useState<UICommand | null>(null);
  const [binderPopup, setBinderPopup] = useState<{ x: number; y: number } | null>(null);
  const shortcutsPinned = uiLayout.panels["@shortcuts"] ?? false;
  const setShortcutsPinned = (value: boolean | ((current: boolean) => boolean)) => updateUI(layout => {
    const open = typeof value === "function" ? value(layout.panels["@shortcuts"] ?? false) : value;
    return open ? reopenContainer(layout, "window:shortcuts") : { ...layout, panels: { ...layout.panels, "@shortcuts": false } };
  });
  const [shortcutsHovered, setShortcutsHovered] = useState(false);
  useEffect(() => {
    if (selection?.kind === "node") setSelectedIds((current) => current.has(selection.id) ? current : new Set([selection.id]));
    else setSelectedIds(new Set());
    if (!["relationship", "composition", "variantBinder", "visualBinder"].includes(selection?.kind ?? "")) setBinderPopup(null);
  }, [selection]);
  function selectMany(ids: string[]) {
    setSelectedIds(new Set(ids)); setSelection(ids[0] ? { kind: "node", id: ids[0] } : null); setOptionNodeId(null);
  }
  const [error, setError] = useState(initial.error);
  const [autosave, setAutosave] = useState(!initial.error);
  const [saveStatus, setSaveStatus] = useState(initial.error ? "Autosave paused" : "Saved locally");
  const [revision, setRevision] = useState(0);
  actionHistory.register("omnium", { read: () => ({ ...documentRef.current, revision: 0 }), write: value => {
    const checked = validateDocument({ ...value, revision: documentRef.current.revision + 1 });
    documentRef.current = checked; setDocument(checked); setSelection(null); setBinderPopup(null); setRevision(r => r + 1);
  } });
  const [proposalText, setProposalText] = useState("");
  const [proposalPreview, setProposalPreview] = useState<Preview | null>(null);
  const [frameQuestion, setFrameQuestion] = useState("");
  const [entityLookup, setEntityLookup] = useState("");
  const [frameLookup, setFrameLookup] = useState("");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const settingsOpen = uiLayout.panels["@settings"] ?? false;
  const setSettingsOpen = (value: boolean) => updateUI(layout => value ? reopenContainer(layout, "window:settings") : { ...layout, panels: { ...layout.panels, "@settings": false } });
  const themeOpen = (uiLayout.panels["@theme"] ?? true) || (!!masterInspection && masterInspection !== dismissedInspection);
  const setThemeOpen = (value: boolean, confirmed = false) => {
    if (!value && appearancePending && !confirmed) { setAppearanceExit("close"); return false; }
    if (!value) setDismissedInspection(masterInspection);
    updateUI(layout => {
      if (value) return reopenContainer(layout, "window:theme");
      const released = releaseResident(layout, "window:theme");
      return { ...released, panels: { ...released.panels, "@theme": false } };
    });
    return true;
  };
  const [layoutRule, setLayoutRule] = useState<"manual" | "hierarchy" | "compact" | "flow">("hierarchy");
  const [flowOrder, setFlowOrder] = useState({ typeId: "", fromRoleId: "", toRoleId: "" });
  const captureLabel = useRef("");
  const [capturing, setCapturing] = useState<string | null>(null);
  const consumedShortcutPress = useRef<number | null>(null);
  const [constraintAxis, setConstraintAxis] = useState<"x" | "y" | "z" | null>(null);
  const heldNudges = useState(() => createHeldActions<NudgeActionId>())[0];
  const [omnicEditorId, setOmnicEditorId] = useState<string | null>(null);
  const omnicObject = document.entities.find(e => e.id === omnicEditorId);
  const [navCommand, setNavCommand] = useState<NavigationCommand | null>(null);
  const [focusContextIds, setFocusContextIds] = useState<readonly string[] | null>(null);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [insertContext, setInsertContext] = useState<{ parentId: string | null; world?: { x: number; y: number; z: number } } | null>(null);
  const [insertQuery, setInsertQuery] = useState("");
  const [optionNodeId, setOptionNodeId] = useState<string | null>(null);
  const structuralGraph = useMemo(() => isolateSpatialContext(projectSpatial(atlas), settings.isolateFocus ? focusContextIds : null), [atlas, settings.isolateFocus, focusContextIds]);
  const variantDisplay = useMemo(() => projectVariants(document, structuralGraph.nodes), [document, structuralGraph, expandedVariants]);
  const fileInput = useRef<HTMLInputElement>(null);
  const templateInput = useRef<HTMLInputElement>(null);
  const themeTemplateInput = useRef<HTMLInputElement>(null);
  const fontInput = useRef<HTMLInputElement>(null);
  const proposalInput = useRef<HTMLInputElement>(null);
  function navigate(kind: NavigationCommand["kind"], id?: string) {
    setNavCommand((old) => ({ sequence: (old?.sequence ?? 0) + 1, kind, id }));
  }
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(savedSettings)); }
    catch { /* Settings are optional; atlas persistence is reported separately. */ }
  }, [savedSettings]);
  function commitDocument(next: AtlasDocument) {
    try {
      const synced = next.layoutViews ? { ...next, layoutViews: next.layoutViews.map((view) => view.id === next.activeLayoutViewId ? { ...view, positions: next.placements.map((p) => ({ placementId: p.id, position: p.spatialPosition ?? { x: p.position.x / 100, y: p.parentId ? -2 : 0, z: p.position.y / 100 } })) } : view) } : next;
      const validated = validateDocument({ ...synced, revision: document.revision + 1 });
      actionHistory.record("omnium", { ...documentRef.current, revision: 0 }, { ...validated, revision: 0 }, ["omnium"], ["omnium"]);
      documentRef.current = validated;
      setDocument(validated);
      setProposalPreview(null);
      setRevision((r) => r + 1);
      setError("");
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    }
  }
  function commit(next: Atlas) {
    try {
      const checked = parseAtlas(JSON.stringify(next));
      let result = reconcileEditor(document, atlas, checked);
      const active = result.frames.find((f) => f.id === result.activeFrameId);
      if (active && !active.locked) {
        for (const node of checked.nodes) {
          if (
            !atlas.nodes.some((old) => old.id === node.id) &&
            !active.scope.entityIds.includes(node.id)
          )
            active.scope.entityIds.push(node.id);
        }
      }
      for (const relation of result.relationships.filter(r => !document.relationships.some(old => old.id === r.id))) result = ensureBinderSpacing(result, settings.spatial, relation.id);
      commitDocument(result);
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    if ((!revision && document.variantPlacementsVersion !== 1) || !autosave) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
      setSaveStatus("Saved locally");
    } catch {
      setSaveStatus("Not saved");
      setError("Local storage is unavailable or full. Export JSON now to keep your work.");
    }
  }, [document, revision, autosave]);
  function patchNode(id: string, changes: Partial<AtlasNode>) {
    if (changes.spatialPosition) {
      try { commitDocument(movePlacement(document, id, changes.spatialPosition, settings.spatial)); }
      catch (e) { setError(message(e)); }
      return;
    }
    commit({ ...atlas, nodes: atlas.nodes.map((n) => (n.id === id ? { ...n, ...changes } : n)) });
  }
  function creationParentId() {
    const candidates = selection?.kind === "node" ? [selection.id] : focusContextIds ?? [];
    return candidates.length === 1 && document.placements.some(p => p.id === candidates[0]) ? candidates[0] : null;
  }
  function createNodeInContext() { addNode(creationParentId()); }
  function createOmnicObject(recipe = createRecipe(), label = "Omnic object", sourceId?: string) {
    const entityId = newId(), parentId = creationParentId();
    let next = forkOmnicDefinition(documentRef.current, sourceId, recipe, label, entityId);
    if (parentId) {
      const parent = next.placements.find(p => p.id === parentId)!;
      next = {...next, compositions:[...next.compositions,{id:newId(),parentId:parent.entityId,childId:entityId}], placements:next.placements.map(p=>p.id===parentId?{...p,collapsed:false}:p)};
    }
    const placed = createPlacement(next, entityId, parentId, settings.spatial);
    const frame = placed.next.frames.find(f => f.id === placed.next.activeFrameId);
    if (frame && !frame.locked) frame.scope.entityIds.push(entityId);
    if (frame?.locked) placed.next.activeFrameId = null;
    if (!commitDocument(placed.next)) throw Error("Omnic creation failed; no definition was saved.");
    setSelection({kind:"node",id:placed.placementId}); setOmnicEditorId(entityId);
  }
  function saveOmnic(recipe: Recipe) {
    if (!omnicEditorId) throw Error("No active Omnic object.");
    const next = saveOmnicDefinition(documentRef.current, omnicEditorId, recipe);
    if (!commitDocument(next)) throw Error("Omnic save failed; draft preserved.");
  }
  function addNode(parentId: string | null, atWorld?: { x: number; y: number; z: number }) {
    try {
      const entityId = newId();
      const next = structuredClone(document);
      next.entities.push({ id: entityId, label: "", aliases: [], notes: "" });
      if (parentId) {
        const parent = next.placements.find((p) => p.id === parentId);
        if (!parent) throw new Error("Parent placement missing.");
        next.compositions.push({ id: newId(), parentId: parent.entityId, childId: entityId });
        parent.collapsed = false;
      }
      const desired = atWorld && parentId ? (() => {
        const origin = worldPositions(next).get(parentId)!;
        return { x: atWorld.x - origin.x, y: atWorld.y - origin.y, z: atWorld.z - origin.z };
      })() : atWorld;
      const placed = createPlacement(next, entityId, parentId, settings.spatial, desired);
      const frame = placed.next.frames.find((f) => f.id === placed.next.activeFrameId);
      if (frame && !frame.locked) frame.scope.entityIds.push(entityId);
      if (frame?.locked) placed.next.activeFrameId = null;
      commitDocument(placed.next);
      setSelection({ kind: "node", id: placed.placementId });
    } catch (e) { setError(message(e)); }
  }
  function connect(connection: { source: string | null; target: string | null }) {
    if (!connection.source || !connection.target) return;
    const id = newId();
    commit({
      ...atlas,
      relationships: [
        ...atlas.relationships,
        { id, source: connection.source, target: connection.target, label: "" },
      ],
    });
    setSelection({ kind: "relationship", id });
  }
  function undo(steps?: number) {
    setAppearancePreview(null);
    actionHistory.travel("undo", { ...actionHistory.options, ...(steps === undefined ? {} : { steps }) });
  }
  function redo(steps?: number) {
    setAppearancePreview(null);
    actionHistory.travel("redo", { ...actionHistory.options, ...(steps === undefined ? {} : { steps }) });
  }
  function exportJSON() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }),
    );
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "omnium-atlas.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportTemplate() {
    try {
      const template = { format: "omnium-ui-template", version: 3, layout: uiCurrent.current, settings: { ...ui.settings, appearance: previewAppearance }, fonts: (await Promise.all(appearanceFonts(previewAppearance).map(embeddedFont))).flat() };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(template, null, 2)], { type: "application/json" }),
      );
      const link = window.document.createElement("a");
      link.href = url;
      link.download = "omnium-ui-template.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(`UI export failed. ${message(e)}`); }
  }
  async function importTemplate(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_FONT_TEMPLATE_BYTES + 5_000_000) throw new Error("UI template exceeds the 20 MB import limit.");
      const value: unknown = JSON.parse(await file.text());
      if (value && typeof value === "object" && (value as { format?: string }).format === "omnium-ui-template" && (value as { version?: number }).version === 3) {
        const template = value as { layout: unknown; settings?: unknown; fonts?: unknown };
        const checked = validateUILayout(template.layout);
        if (template.settings !== undefined && (!template.settings || typeof template.settings !== "object")) throw new Error("Invalid template settings.");
        const nextSettings = normalizeSettings(template.settings);
        await restoreTemplateFont(nextSettings.appearance, template.fonts);
        ui.commit((previous) => ({ layout: checked, settings: template.settings === undefined ? previous.settings : nextSettings }));
        return;
      }
      if (
        !value ||
        typeof value !== "object" ||
        (value as ViewConfig).format !== "omnium-ui-template" ||
        ![1, 2].includes((value as ViewConfig).version)
      )
        throw new Error("Expected an Omnium UI template version 1, 2 or 3.");
      const template = value as ViewConfig;
      const next = parseDocument(JSON.stringify(template.atlas));
      if (
        atlas.nodes.length &&
        !window.confirm(
          "Replace the current atlas and UI layout with this template? You can undo this action.",
        )
      )
        return;
      commitDocument(next);
      setSelection(null);
      setOptionNodeId(null); setExpandedVariants(new Set());
    } catch (e) {
      setError(`Template import failed. Your atlas was not changed. ${message(e)}`);
    } finally {
      if (templateInput.current) templateInput.current.value = "";
    }
  }
  async function importJSON(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("Atlas exceeds the 5 MB import limit.");
      const next = parseDocument(await file.text());
      if (
        atlas.nodes.length &&
        !window.confirm(
          "Replace the current atlas with this file? You can undo this action. Export first to keep a separate backup.",
        )
      )
        return;
      commitDocument(next);
      setSelection(null);
      setOptionNodeId(null); setExpandedVariants(new Set());
    } catch (e) {
      setError(`Import failed. Your atlas was not changed. ${message(e)}`);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  const selectedNode =
    selection?.kind === "node" ? atlas.nodes.find((n) => n.id === selection.id) : undefined;
  const selectedRelationship =
    selection?.kind === "relationship"
      ? atlas.relationships.find((r) => r.id === selection.id)
      : undefined;
  const selectedPlacement = selectedNode
    ? document.placements.find((p) => p.id === selectedNode.id)
    : undefined;
  const selectedEntity = document.entities.find((e) => e.id === selectedPlacement?.entityId);
  const sceneBackground = useSceneBackground(actionHistory, selectedNode?.id ?? null);
  const sceneNodeIds = useMemo(() => new Set(document.placements.map(item => item.id)), [document.placements]);
  const sceneNodeIdsRef = useRef(sceneNodeIds); sceneNodeIdsRef.current = sceneNodeIds;
  const selectedRelationData = document.relationships.find(
    (r) => r.id === selectedRelationship?.id,
  );
  const activeFrame = document.frames.find((f) => f.id === document.activeFrameId);
  const selectedComposition = selection?.kind === "composition" ? document.compositions.find((c) => c.id === selection.id) : undefined;
  const activeLayout = document.layoutViews?.find((v) => v.id === document.activeLayoutViewId);
  const flowType = document.relationshipTypes.find((t) => t.id === flowOrder.typeId) ?? document.relationshipTypes[0];
  const resolvedOrder = { typeId: flowType?.id ?? "", fromRoleId: flowOrder.fromRoleId || flowType?.roles[0]?.id || "", toRoleId: flowOrder.toRoleId || flowType?.roles[1]?.id || "" };
  function switchView(id: string) {
    try { commitDocument(switchLayoutView(document, id)); }
    catch (e) { setError(message(e)); }
  }
  function newView() {
    try {
      const name = layoutRule === "hierarchy" ? "Hierarchy" : layoutRule === "compact" ? "Compact" : layoutRule === "flow" ? "Directed flow" : "Manual";
      commitDocument(createLayoutView(document, layoutRule, `${name} ${(document.layoutViews?.length ?? 0) + 1}`, settings.spatial, resolvedOrder));
    } catch (e) { setError(message(e)); }
  }
  function reapplyView() {
    if (!activeLayout) return;
    try {
      const next = activeLayout.rule === "hierarchy" ? hierarchyLayout(document, settings.spatial) : activeLayout.rule === "flow" ? flowLayout(document, activeLayout.ordering, settings.spatial) : compactLayout(document, { kind: "all" }, settings.spatial);
      commitDocument(next);
    } catch (e) { setError(message(e)); }
  }
  function removeView() {
    if (!activeLayout || activeLayout.id === "authored-layout") return;
    try {
      const fallback = document.layoutViews?.find((v) => v.id !== activeLayout.id)?.id;
      const restored = fallback ? switchLayoutView(document, fallback) : { ...document, activeLayoutViewId: null };
      commitDocument({ ...restored, layoutViews: restored.layoutViews?.filter((v) => v.id !== activeLayout.id) });
    } catch (e) { setError(message(e)); }
  }
  const forbiddenParents = selectedNode ? descendants(atlas, selectedNode.id) : new Set<string>();
  function reveal(id: string) {
    setSelectedIds(new Set([id]));
    const ancestors = new Set<string>();
    let node = atlas.nodes.find((n) => n.id === id);
    while (node?.parentId) {
      if (node.variantOwnerId !== node.parentId) ancestors.add(node.parentId);
      node = atlas.nodes.find((n) => n.id === node!.parentId);
    }
    if (atlas.nodes.some((n) => ancestors.has(n.id) && n.collapsed))
      commit({
        ...atlas,
        nodes: atlas.nodes.map((n) => (ancestors.has(n.id) ? { ...n, collapsed: false } : n)),
      });
    setSelection({ kind: "node", id });
  }
  function options() {
    return atlas.nodes.map((n) => (
      <option key={n.id} value={n.id}>
        {n.label || "Untitled node"}
      </option>
    ));
  }
  function insertExisting(entityId: string, parentId: string | null = null, atWorld?: { x: number; y: number; z: number }) {
    const entity = document.entities.find((e) => e.id === entityId);
    if (!entity) {
      setError("Choose an existing identity.");
      return;
    }
    try {
      const next = structuredClone(document);
      if (parentId) {
        const parent = next.placements.find((p) => p.id === parentId);
        if (!parent) throw new Error("Parent placement missing.");
        parent.collapsed = false;
      }
      const desired = atWorld && parentId ? (() => {
        const origin = worldPositions(next).get(parentId)!;
        return { x: atWorld.x - origin.x, y: atWorld.y - origin.y, z: atWorld.z - origin.z };
      })() : atWorld;
      const placed = createPlacement(next, entityId, parentId, settings.spatial, desired);
      const frame = placed.next.frames.find((f) => f.id === placed.next.activeFrameId);
      if (frame && !frame.locked && !frame.scope.entityIds.includes(entityId)) frame.scope.entityIds.push(entityId);
      if (frame?.locked) placed.next.activeFrameId = null;
      commitDocument(placed.next);
      setSelection({ kind: "node", id: placed.placementId });
      setInsertContext(null);
    } catch (e) { setError(message(e)); }
  }
  function removePlacement(id: string) {
    commitDocument({
      ...document,
      placements: document.placements
        .filter((p) => p.id !== id)
        .map((p) => ({ ...p, ...(p.parentId === id ? { parentId: null } : {}), ...(p.variantOwner?.placementId === id ? { variantOwner: undefined } : {}) })),
    });
    setSelection(null);
  }
  function deleteSelectedConcepts(ids: Iterable<string> = selectedIds, alwaysConfirm = false) {
    const chosen = [...ids], summary = deletionSummary(document, chosen);
    if (!summary.entities.size) return;
    if ((alwaysConfirm || summary.otherReferences || summary.crossLinks) && !window.confirm(`Delete ${summary.entities.size} concept(s), including subnodes, everywhere? ${summary.otherReferences} other appearance(s) and ${summary.crossLinks} connection(s) to other concepts are affected. Undo restores the entire deletion.`)) return;
    commitDocument(deleteConceptSubtrees(document, chosen)); setSelection(null); setSelectedIds(new Set()); setOptionNodeId(null); setBinderPopup(null);
  }
  function deleteIdentity(entityId: string) {
    deleteSelectedConcepts(document.placements.filter((p) => p.entityId === entityId).map((p) => p.id), true);
  }
  function navigateIdentity(entityId: string) {
    const other = document.placements.find(
      (p) => p.entityId === entityId && p.id !== selectedPlacement?.id,
    );
    if (other) {
      const ancestors = new Set<string>();
      let cursor = other.parentId;
      while (cursor) {
        ancestors.add(cursor);
        cursor = document.placements.find((p) => p.id === cursor)?.parentId ?? null;
      }
      commitDocument({
        ...document,
        activeFrameId: null,
        placements: document.placements.map((p) =>
          p.id === other.id
            ? { ...p, hidden: false }
            : ancestors.has(p.id)
              ? { ...p, collapsed: false, hidden: false }
              : p,
        ),
      });
      setSelection({ kind: "node", id: other.id });
      navigate("focus", other.id);
    } else
      setError(
        "This identity has no other placement. Its charted relationships remain available in the inspector.",
      );
  }
  function updateRelation(changes: Partial<NonNullable<typeof selectedRelationData>>) {
    if (!selectedRelationData) return;
    const next = { ...document, relationships: document.relationships.map(r => r.id === selectedRelationData.id ? { ...r, ...changes } : r) };
    try { commitDocument(ensureBinderSpacing(next, settings.spatial, selectedRelationData.id)); }
    catch (e) { setError(message(e)); }
  }
  const selectedBinder: BinderPresentation | undefined = selection?.kind === "relationship" ? selectedRelationData : selection?.kind === "composition" ? selectedComposition : selection?.kind === "variantBinder" ? document.variants?.find((v) => v.id === selection.id) : selection?.kind === "visualBinder" ? document.placements.find((p) => p.id === selection.id)?.nestingBinder ?? {} : undefined;
  const selectedBinderText = selectedBinder && selection ? chartedBinders(document, atlas).find((b) => b.id === selection.id)?.label ?? "" : "";
  function editBinder(changes: BinderPresentation, asset?: VisualAsset) {
    if (!selection) return;
    const next = { ...document, ...(asset ? { assets: [...(document.assets ?? []), asset] } : {}) };
    if (selection.kind === "relationship") next.relationships = next.relationships.map((r) => r.id === selection.id ? { ...r, ...changes } : r);
    if (selection.kind === "composition") next.compositions = next.compositions.map((r) => r.id === selection.id ? { ...r, ...changes } : r);
    if (selection.kind === "variantBinder") next.variants = next.variants?.map((r) => r.id === selection.id ? { ...r, ...changes } : r);
    if (selection.kind === "visualBinder") next.placements = next.placements.map((p) => p.id === selection.id ? { ...p, nestingBinder: { ...p.nestingBinder, ...changes } } : p);
    try { commitDocument(changes.visual !== undefined || changes.text !== undefined || changes.operators !== undefined ? ensureBinderSpacing(next, settings.spatial, selection.id) : next); }
    catch (e) { setError(message(e)); }
  }
  function editNodeVisual(visual: Visual, asset?: VisualAsset) {
    commitDocument({ ...document, ...(asset ? { assets: [...(document.assets ?? []), asset] } : {}), placements: document.placements.map((p) => selectedIds.has(p.id) ? { ...p, visual } : p) });
  }
  function createType() {
    const name = window.prompt("New relationship type name (provisional)");
    if (!name?.trim()) return;
    const id = newId();
    commitDocument({
      ...document,
      relationshipTypes: [
        ...document.relationshipTypes,
        {
          id,
          name: name.trim(),
          symbol: "",
          definition: "",
          roles: [
            { id: "source", name: "From" },
            { id: "target", name: "To" },
          ],
        },
      ],
    });
  }
  function patchType(
    typeId: string,
    changes: Partial<(typeof document.relationshipTypes)[number]>,
  ) {
    commitDocument({
      ...document,
      relationshipTypes: document.relationshipTypes.map((t) =>
        t.id === typeId ? { ...t, ...changes } : t,
      ),
    });
  }
  function makeScope(entityIds: string[]): FrameScope {
    return {
      anchorIds: entityIds.slice(0, 1),
      entityIds,
      relationshipIds: [],
      excludedEntityIds: [],
      excludedRelationshipIds: [],
      depth: null,
    };
  }
  function createFrame() {
    const q = frameQuestion.trim();
    const selectedIds = selectedEntity ? [selectedEntity.id] : [];
    const tokens = q.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
    const matched = document.entities
      .filter(
        (e) =>
          tokens.length > 0 &&
          tokens.some(
            (word) =>
              e.label.toLowerCase().includes(word) ||
              e.aliases.some((a) => a.toLowerCase().includes(word)),
          ),
      )
      .map((e) => e.id);
    const entityIds = [...new Set([...selectedIds, ...matched])];
    const frame: Frame = {
      id: newId(),
      name: "",
      question: q,
      scope: makeScope(entityIds),
      locked: false,
      promoted: false,
      discarded: false,
      savedRevision: document.revision,
      history: [],
    };
    commitDocument({ ...document, frames: [...document.frames, frame], activeFrameId: frame.id });
    setFrameQuestion("");
    setSelection(null);
  }
  function refineFrame(scope: FrameScope) {
    if (!activeFrame || activeFrame.locked) return;
    const next = structuredClone(document);
    const frame = next.frames.find((f) => f.id === activeFrame.id)!;
    frame.history.push({ revision: document.revision, scope: structuredClone(frame.scope) });
    frame.scope = scope;
    commitDocument(next);
  }
  function reviewProposal() {
    try {
      setProposalPreview(validateChangeSet(document, parseChangeSet(proposalText)));
      setError("");
    } catch (e) {
      setProposalPreview(null);
      setError(`Proposal rejected. ${message(e)}`);
    }
  }
  function toggleNode(id: string) {
    const placement = document.placements.find((p) => p.id === id);
    if (!placement) return;
    if (placement.collapsed) {
      try { commitDocument(expandPlacement(document, id)); }
      catch (e) { setError(message(e)); }
    } else commitDocument({ ...document, placements: document.placements.map((p) => p.id === id ? { ...p, collapsed: true } : p) });
  }
  function selectNodeImmediately(id: string) {
    setOptionNodeId(current => current === id ? current : null);
    setSelectedIds(current => current.size === 1 && current.has(id) ? current : new Set([id]));
    setSelection(current => current?.kind === "node" && current.id === id ? current : {kind:"node",id});
  }
  function nodeClicked(id: string) {
    selectNodeImmediately(id);
    if (connectionSource) {
      if (connectionSource !== id) connect({ source: connectionSource, target: id });
      setConnectionSource(null);
      return;
    }
    setSelection({ kind: "node", id });
    setOptionNodeId(id);
    revealVariants(id);
  }
  function nodeDoubleClicked(id: string) {
    setOptionNodeId(null);
    setExpandedVariants((current) => { const next = new Set(current); next.delete(id); return next; });
    setSelection({ kind: "node", id });
    const placement = document.placements.find((p) => p.id === id);
    if (placement && (document.compositions.some((c) => c.parentId === placement.entityId) || document.placements.some((p) => p.parentId === id && !p.variantOwner))) toggleNode(id);
  }
  function nodeSubtreeClicked(id: string) {
    if (!document.placements.some((p) => p.id === id)) return;
    try {
      const next = toggleSubtree(document, id);
      if (next !== document) commitDocument(next);
      setSelection({ kind: "node", id }); setOptionNodeId(null);
      setExpandedVariants((current) => { const remaining = new Set(current); remaining.delete(id); return remaining; });
    } catch (e) { setError(message(e)); }
  }
  function revealVariants(id: string) {
    let next = ensureVariantPlacements(document, id);
    const frame = next.frames.find((f) => f.id === next.activeFrameId);
    const missing = next.placements.filter((p) => p.variantOwner?.placementId === id && !frame?.scope.entityIds.includes(p.entityId) && !frame?.scope.anchorIds.includes(p.entityId) && !frame?.scope.excludedEntityIds.includes(p.entityId));
    if (frame && !frame.locked && missing.length) {
      next = structuredClone(next);
      next.frames.find((f) => f.id === frame.id)!.scope.entityIds.push(...new Set(missing.map((p) => p.entityId)));
    }
    if (next !== document) commitDocument(next);
    if (next.placements.some(p => p.variantOwner?.placementId === id)) setExpandedVariants((current) => current.has(id) ? current : new Set([...current, id]));
  }
  function toggleVariants(id: string) {
    if (!expandedVariants.has(id)) revealVariants(id);
    else setExpandedVariants((current) => { const next = new Set(current); next.delete(id); return next; });
  }
  function createVariant(ownerNodeId: string) {
    const ownerId = nodeEntityId(document, ownerNodeId);
    if (!ownerId) return;
    try {
      const { next, variant } = addVariant(document, ownerId);
      const expanded = new Set([...expandedVariants, ownerNodeId]);
      const instance = next.placements.find((p) => p.variantOwner?.placementId === ownerNodeId && p.variantOwner.variantId === variant.id);
      const frame = next.frames.find((f) => f.id === next.activeFrameId);
      if (frame && !frame.locked) frame.scope.entityIds.push(variant.entityId);
      if (frame?.locked) next.activeFrameId = null;
      commitDocument(next); setExpandedVariants(expanded); setOptionNodeId(ownerNodeId);
      if (instance) { setSelection({ kind: "node", id: instance.id }); }
      setTimeout(() => window.document.querySelector<HTMLInputElement>('[aria-label="Node name"]')?.focus(), 0);
    } catch (e) { setError(message(e)); }
  }
  function moveDisplayedNode(id: string, position: { x: number; y: number; z: number }, preview = false) {
    // Hidden variant branches must not block the active workspace's drag targets.
    const visibleIds = new Set(structuralGraph.nodes.filter((n) => n.visible).map((n) => n.id));
    const collisionDoc = { ...document, placements: document.placements.map((p) => ({ ...p, hidden: p.hidden || !visibleIds.has(p.id) })) };
    const placement = document.placements.find(p => p.id === id)!;
    const parent = placement.parentId && !structuralGraph.nodes.find(n => n.id === id)?.parentId ? worldPositions(document).get(placement.parentId) : undefined;
    const desired = parent ? { x: position.x - parent.x, y: position.y - parent.y, z: position.z - parent.z } : position;
    const local = nearestFree(collisionDoc, id, desired, settings.spatial);
    if (!preview) commitDocument({ ...document, placements: document.placements.map((p) => p.id === id ? { ...p, spatialPosition: local } : p) });
    return parent ? { x: local.x + parent.x, y: local.y + parent.y, z: local.z + parent.z } : local;
  }
  function compact(scope: ReflowScope) {
    try { commitDocument(compactLayout(document, scope, settings.spatial)); }
    catch (e) { setError(message(e)); }
  }
  function nestReason(id: string, targetId: string): string | null {
    try { reparentStructure(document, id, targetId, settings.spatial); return null; }
    catch (e) { return message(e); }
  }
  function nest(id: string, targetId: string) {
    try {
      commitDocument(reparentStructure(document, id, targetId, settings.spatial));
      setSelection({ kind: "node", id });
    } catch (e) { setError(message(e)); }
  }
  function storeCheckpoints(next: Checkpoint[]) {
    try {
      localStorage.setItem(CHECKPOINTS_KEY, JSON.stringify(next));
      setCheckpoints(next);
      setRecoveryError("");
      return true;
    } catch {
      setRecoveryError("Could not save appearance checkpoints in this browser. Export a theme backup before continuing.");
      setRecoveryOpen(true);
      return false;
    }
  }
  function finishAppearanceExit() {
    if (appearanceExit === "close") setThemeOpen(false, true);
    if (appearanceExit === "minimize") updateUI(layout => ({ ...layout, windows: { ...layout.windows,
      theme: { ...(layout.windows.theme ?? { x: Math.max(8, window.innerWidth - 374), y: 90, width: 350, height: 600, pinned: false }), collapsed: true },
    } }));
    setAppearanceExit(null);
  }
  function applyAppearance() {
    const next = normalizeSettings({ ...savedSettings, appearance: previewAppearance });
    const previous = checkpoints.length ? checkpoints : appendCheckpoint([], savedSettings.appearance, "Before first appearance change");
    if (!storeCheckpoints(appendCheckpoint(previous, next.appearance))) return false;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); }
    catch { setRecoveryError("Appearance could not be saved. Your preview is still open; export a theme backup."); setRecoveryOpen(true); return false; }
    ui.applyAppearance(next.appearance);
    setAppearancePreview(null);
    setRecoveryError("");
    finishAppearanceExit();
    return true;
  }
  function discardAppearance() {
    setAppearancePreview(null);
    ui.discardAppearance();
    setRecoveryError("");
    setRecoveryOpen(false);
    finishAppearanceExit();
  }
  function restoreAppearance(appearance: WorkspaceSettings["appearance"]) {
    setAppearancePreview(null);
    setSettings(old => ({ ...old, appearance: structuredClone(appearance) }));
    setSafeView(false);
    setRecoveryError("");
  }
  function storeThemePresets(next: ThemeTemplate[]) {
    try {
      if (next.length > 50) throw new Error("Keep up to 50 saved themes; export or remove one first.");
      const local = next.map(({ fonts: _fonts, ...preset }) => preset);
      localStorage.setItem(THEME_PRESETS_KEY, JSON.stringify(local));
      setThemePresets(local); setError("");
      return true;
    } catch (e) { setError(`Theme could not be saved. ${message(e)}`); return false; }
  }
  function saveThemePreset() {
    const preset = themeTemplate(themePresetName, previewAppearance);
    if (storeThemePresets([...themePresets.filter(item => item.name !== preset.name), preset])) {
      setSelectedThemePreset(preset.name); setThemePresetName(preset.name);
    }
  }
  async function exportTheme() {
    try {
      const preset = themeTemplate(themePresetName, previewAppearance, (await Promise.all(appearanceFonts(previewAppearance).map(embeddedFont))).flat());
      const url = URL.createObjectURL(new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" }));
      const link = window.document.createElement("a"); link.href = url; link.download = "omnium-theme.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(`Theme export failed. ${message(e)}`); }
  }
  async function restoreTemplateFont(appearance: WorkspaceSettings["appearance"], fonts?: unknown) {
    await importCustomFonts(fonts);
    await Promise.all(appearanceFonts(appearance).map(loadFont));
    setCustomFonts(await listCustomFonts());
  }
  async function importFont(file?: File) {
    if (!file) return;
    setFontImporting(true);
    try {
      const font = await importFontFile(file);
      setCustomFonts(await listCustomFonts());
      setSettings(old => ({ ...old, appearance: { ...old.appearance, font: font.id, controller: applyValue(old.appearance.controller!,controllerTargets(old.appearance.controller!),"font",font.id,"text") } }));
      setError("");
    } catch (e) { setError(`Font import failed. ${message(e)}`); }
    finally { setFontImporting(false); if (fontInput.current) fontInput.current.value = ""; }
  }
  async function applyThemePreset(preset: ThemeTemplate) {
    try {
      await restoreTemplateFont(preset.appearance, preset.fonts);
      setSettings(old => ({ ...old, appearance: structuredClone(preset.appearance) }));
    } catch (e) { setError(`Theme could not be applied. ${message(e)}`); }
  }
  async function importTheme(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_FONT_TEMPLATE_BYTES) throw new Error("Theme template exceeds the 15 MB limit.");
      const preset = parseThemeTemplate(JSON.parse(await file.text()));
      await restoreTemplateFont(preset.appearance, preset.fonts);
      if (!storeThemePresets([...themePresets.filter(item => item.name !== preset.name), preset])) return;
      setSettings(old => ({ ...old, appearance: preset.appearance }));
      setThemePresetName(preset.name); setSelectedThemePreset(preset.name);
    } catch (e) { setError(`Theme import failed. ${message(e)}`); }
    finally { if (themeTemplateInput.current) themeTemplateInput.current.value = ""; }
  }
  function revealPanel(id: string) {
    updateUI(layout => {
      const key = `window:panel:${id}`;
      const saved = layout.windows[`panel:${id}`] ?? { x: 320, y: 140, width: 400, height: 560, collapsed: false, pinned: false };
      const next = { ...layout, windows: { ...layout.windows, [`panel:${id}`]: saved } };
      return reopenContainer(next, key);
    });
    requestAnimationFrame(() => window.document.querySelector(`[data-ui-resident-root="window:panel:${id}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" }));
  }
  function invokeContextShortcut(id: string): boolean {
    if (invokeCatalogAction(id, action => runAction(action))) return true;
    const nodeAction = ["createChild", "insertExisting", "connect", "toggle", "focus", "edit", "removePlacement", "deleteIdentity"].find(action => id === `context:node:${action}`);
    if (nodeAction && selectedNode) {
      contextAction(nodeAction as ContextAction, { kind: "node", id: selectedNode.id });
      return true;
    }
    const selectionAction = ["focus", "expand", "collapse", "compact", "deleteIdentity"].find(action => id === `context:selection:${action}`);
    const ids = [...selectedIds].filter(id => document.placements.some(p => p.id === id));
    if (selectionAction && ids.length) {
      contextAction(selectionAction as ContextAction, { kind: "selection", ids });
      return true;
    }
    return false;
  }
  function contextAction(action: ContextAction, target: ContextTarget) {
    if (target.kind === "selection") {
      if (action === "deleteIdentity") deleteSelectedConcepts(target.ids);
      if (action === "focus") navigate("selection");
      if (action === "expand" || action === "collapse") {
        let next = document;
        for (const id of target.ids) if (action === "expand") next = expandPlacement(next, id);
        if (action === "collapse") next = { ...next, placements: next.placements.map((p) => target.ids.includes(p.id) ? { ...p, collapsed: true } : p) };
        commitDocument(next);
      }
      if (action === "compact") { commitDocument(compactLayout(document, { kind: "selection", placementIds: target.ids }, settings.spatial)); }
      return;
    }
    const id = target.kind === "node" ? target.id : null;
    switch (action) {
      case "createUIFrame": { const point = target.kind === "space" ? target.screen : undefined; updateUI((layout) => ({ ...layout, frames: [...layout.frames, { id: crypto.randomUUID(), name: "New frame", x: point?.x ?? 120, y: point?.y ?? 180, cellSize: 96, collapsed: false, pinned: false }] })); break; }
      case "createChild": if (id) addNode(id); break;
      case "createAt": if (target.kind === "space") addNode(null, target.world); break;
      case "insertExisting": setInsertQuery(""); setInsertContext({ parentId: id, world: target.kind === "space" ? target.world : undefined }); break;
      case "connect": if (id) { setConnectionSource(id); setSelection({ kind: "node", id }); } break;
      case "toggle": if (id) toggleNode(id); break;
      case "focus": if (id) { setSelection({ kind: "node", id }); navigate("focus", id); } break;
      case "edit": if (id) {
        setSelection({ kind: "node", id }); revealPanel("inspector");
        setTimeout(() => {
          const input = [...window.document.querySelectorAll<HTMLInputElement>('[aria-label="Node name"]')].find(input => input.getClientRects().length && window.getComputedStyle(input).visibility !== "hidden");
          input?.focus(); input?.select();
        }, 0);
      } break;
      case "removePlacement": if (id) removePlacement(id); break;
      case "deleteIdentity": if (id) { const entityId = document.placements.find((p) => p.id === id)?.entityId; if (entityId) deleteIdentity(entityId); } break;
      case "compact": compact(activeFrame ? { kind: "frame", frameId: activeFrame.id } : { kind: "all" }); break;
      case "fitAll": navigate("all"); break;
      case "settings": setSettingsOpen(true); break;
    }
  }
  function runAction(action: ActionId, steps?: number) {
    if (isFeatureAction(action)) { featureActionRuntime.invoke(action); return; }
    switch (action) {
      case "searchUI": setSearchOpen(true); break;
      case "ui:undo": setAppearancePreview(null); actionHistory.travel("undo", { ...actionHistory.options, mode: "selective", categories: ["ui"], ...(steps ? { steps } : {}) }); break;
      case "theme": setSettings(old => ({ ...old, appearance: { ...old.appearance, theme: old.appearance.theme === "neon" ? "classic" : "neon" } })); break;
      case "appearance": setThemeOpen(true); break;
      case "ui:redo": setAppearancePreview(null); actionHistory.travel("redo", { ...actionHistory.options, mode: "selective", categories: ["ui"], ...(steps ? { steps } : {}) }); break;
      case "ui:select": case "ui:compact": case "ui:align": setUICommand(old => ({ action: action === "ui:select" ? "select" : action === "ui:align" ? "align" : "compact", sequence: (old?.sequence ?? 0) + 1 })); break;
      case "ui:reset": setUICommand(old => ({ action: "reset", sequence: (old?.sequence ?? 0) + 1 })); break;
      case "ui:devMode": updateUI(layout => ({ ...layout, panels: { ...layout.panels, "@devMode": !layout.panels["@devMode"] } })); break;
      case "ui:arrange": updateUI((layout) => ({ ...layout, panels: { ...layout.panels, "@library": true } })); break;
      case "ui:createFrame": setUICommand(old => ({ action: "createFrame", sequence: (old?.sequence ?? 0) + 1 })); break;
      case "selectAll": selectMany(structuralGraph.nodes.filter((n) => n.visible).map((n) => n.id)); break;
      case "deleteSelected": deleteSelectedConcepts(); break;
      case "shortcuts": setShortcutsPinned((v) => !v); setShortcutsHovered(false); break;
      case "focus": featureActionRuntime.invoke("world.faceSelection"); break;
      case "isolateFocus":
        setSettings(old => ({ ...old, isolateFocus: !old.isolateFocus }));
        if (!settings.isolateFocus && selection?.kind === "node") setFocusContextIds(selectedIds.size > 1 ? [...selectedIds] : [selection.id]);
        break;
      case "fitLocal": navigate("local", selection?.kind === "node" ? selection.id : undefined); break;
      case "fitAll": navigate("all"); break;
      case "back": navigate("back"); break;
      case "zoom100": case "cameraOrigin": case "rollLeft": case "rollRight": navigate(action); break;
      case "newNode": createNodeInContext(); break;
      case "newChild": if (selection?.kind === "node") addNode(selection.id); break;
      case "connect": if (selection?.kind === "node") setConnectionSource(selection.id); break;
      case "expand": if (selection?.kind === "node") toggleNode(selection.id); break;
      case "expandAll": if (selection?.kind === "node") nodeSubtreeClicked(selection.id); break;
      case "toggleSnap": setSettings((old) => ({ ...old, spatial: { ...old.spatial, spacing: old.spatial.spacing ? 0 : 2 } })); break;
      case "nudgeLeft": case "nudgeRight": case "nudgeUp": case "nudgeDown": if (selection?.kind === "node") navigate(action, selection.id); break;
      case "axisX": setConstraintAxis("x"); break;
      case "axisY": setConstraintAxis("y"); break;
      case "axisZ": setConstraintAxis("z"); break;
      case "compactSelected": if (selection?.kind === "node") compact({ kind: "subsystem", placementId: selection.id }); break;
      case "compactFrame": if (activeFrame) compact({ kind: "frame", frameId: activeFrame.id }); break;
      case "compactAll": compact(selectedIds.size ? { kind: "selection", placementIds: [...selectedIds] } : { kind: "all" }); break;
      case "undo": undo(steps); break;
      case "redo": redo(steps); break;
      case "cancel": setBinderPopup(null); setShortcutsHovered(false); setCapturing(null); setSelectedIds(new Set()); setSelection(null); setConnectionSource(null); setInsertContext(null); setSettingsOpen(false); setOptionNodeId(null); navigate("cancel"); break;
      case "settings": setSettingsOpen(true); break;
    }
  }
  useLayoutEffect(() => {
    const assignBinding = (key: string) => {
      if (!capturing) return;
      if (key.split("+").includes("Shift")) { setError("Shift opens a function’s Master Controller configuration. Choose a shortcut without Shift."); return; }
      const conflict = keyConflict(settings.bindings, capturing, key);
      if (conflict) { setError(`Key ${key} is already assigned to ${ACTIONS.find((a) => a.id === conflict)?.label ?? settings.buttonLabels[conflict] ?? conflict}.`); return; }
      setSettings((old) => ({ ...old, bindings: { ...old.bindings, [capturing]: key }, buttonLabels: capturing.startsWith("button:") ? { ...old.buttonLabels, [capturing]: captureLabel.current || old.buttonLabels[capturing] || capturing.slice(7) } : old.buttonLabels }));
      setCapturing(null); setError("");
    };
    const keydown = (event: KeyboardEvent) => {
      if (capturing) {
        event.preventDefault();
        const key = normalizeKey(event);
        if (key === "Esc") { setCapturing(null); return; }
        if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
        assignBinding(key); return;
      }
      if (event.defaultPrevented || isTypingTarget(event.target)) { heldNudges.stop(); return; }
      const action = actionForKey(settings.bindings, normalizeKey(event));
      if (!action || (event.repeat && !isNudgeAction(action))) return;
      if (isNudgeAction(action) && selection?.kind !== "node") return;
      if ((settingsOpen || insertContext) && action !== "cancel" && action !== "searchUI") return;
      event.preventDefault();
      if (isNudgeAction(action)) {
        // Stale queued presses cannot start a new movement after a main-thread stall.
        if (!event.repeat && performance.now() - event.timeStamp < 150) heldNudges.press(action, event.code || event.key);
      } else { heldNudges.stop(); runAction(action); }
    };
    const keyup = (event: KeyboardEvent) => {
      heldNudges.release(event.code || event.key);
      if (isTypingTarget(event.target)) return;
      const action = actionForKey(settings.bindings, normalizeKey(event));
      if (action === "axisX" || action === "axisY" || action === "axisZ") setConstraintAxis(null);
    };
    const mouseHistory = (event: PointerEvent) => {
      heldNudges.stop();
      clearRecordedShortcutPress();
      if (capturing) { recordShortcutPress(event); consumedShortcutPress.current = event.button; claimUIPress(event.pointerId, event.pointerType, event.buttons); event.preventDefault(); event.stopImmediatePropagation(); assignBinding(normalizePointer(event)); return; }
      if (event.defaultPrevented) return;
      const action = actionForKey(settings.bindings, normalizePointer(event));
      if (action && (!(settingsOpen || insertContext) || action === "cancel" || action === "searchUI")) {
        consumedShortcutPress.current = event.button;
        claimUIPress(event.pointerId, event.pointerType, event.buttons);
        event.preventDefault(); event.stopImmediatePropagation(); runAction(action); return;
      }
      if (event.button !== 3 && event.button !== 4) return;
      event.preventDefault(); event.stopImmediatePropagation();
      runAction(event.button === 3 ? settings.mouse.backButton : settings.mouse.forwardButton);
    };
    const preventMouseNavigation = (event: MouseEvent) => {
      if (event.isTrusted && event.button === consumedShortcutPress.current) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.type === "click" || event.type === "auxclick") consumedShortcutPress.current = null;
      } else if (event.button === 3 || event.button === 4) event.preventDefault();
    };
    const preventRecordedMenu = (event: MouseEvent) => { if (recordedShortcutTail(event)) { event.preventDefault(); event.stopImmediatePropagation(); } };
    window.addEventListener("pointerdown", mouseHistory, true);
    window.addEventListener("mousedown", preventMouseNavigation, true);
    window.addEventListener("auxclick", preventMouseNavigation, true);
    window.addEventListener("click", preventMouseNavigation, true);
    window.addEventListener("contextmenu", preventRecordedMenu, true);
    window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup);
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); window.removeEventListener("pointerdown", mouseHistory, true); window.removeEventListener("mousedown", preventMouseNavigation, true); window.removeEventListener("auxclick", preventMouseNavigation, true); window.removeEventListener("click", preventMouseNavigation, true); window.removeEventListener("contextmenu", preventRecordedMenu, true); };
  });
  useEffect(() => {
    heldNudges.stop();
  }, [selection?.kind, selection?.id, capturing, settingsOpen, insertContext, settings.bindings]);
  useEffect(() => {
    const stop = () => heldNudges.stop();
    const focus = (event: FocusEvent) => { if (isTypingTarget(event.target)) stop(); };
    window.addEventListener("blur", stop); window.addEventListener("visibilitychange", stop); window.addEventListener("focusin", focus);
    return () => { stop(); window.removeEventListener("blur", stop); window.removeEventListener("visibilitychange", stop); window.removeEventListener("focusin", focus); };
  }, []);
  function outline(parentId: string | null, variantsOnly = false): React.ReactNode {
    return (
      <ul>
        {atlas.nodes
          .filter((n) => n.parentId === parentId && (!variantsOnly || n.variantOwnerId === parentId))
          .map((n) => (
            <li key={n.id}>
              <div className="outline-row">
                {atlas.nodes.some((c) => c.parentId === n.id && c.variantOwnerId !== n.id) ? (
                  <button
                    aria-label={`${n.collapsed ? "Expand" : "Collapse"} branch ${n.label}`}
                    onClick={() => patchNode(n.id, { collapsed: !n.collapsed })}
                  >
                    {n.collapsed ? "▸" : "▾"}
                  </button>
                ) : (
                  <span className="outline-spacer" />
                )}
                <button
                  className={selection?.id === n.id ? "outline-name active" : "outline-name"}
                  onClick={() => reveal(n.id)}
                  title={n.label}
                >
                  {n.label || "Untitled node"}
                </button>
              </div>
              {(!n.collapsed || atlas.nodes.some((c) => c.variantOwnerId === n.id && c.parentId === n.id)) && outline(n.id, n.collapsed)}
            </li>
          ))}
      </ul>
    );
  }
  const uiFunctions: UIFunction[] = ACTIONS.map((a) => ({ id: a.id, label: a.label, category: a.category, element: <button onClick={() => runAction(a.id)}>{a.label}</button> }));
  uiFunctions.find(fn => fn.id === "compactAll")!.element = <button onClick={() => runAction("compactAll")}>{selectedIds.size ? "Compact selection" : "Compact all"}</button>;
  uiFunctions.find(fn => fn.id === "isolateFocus")!.element = <button aria-pressed={settings.isolateFocus} title="On explicit focus, show that node, its subtree and its ancestor path. Fit entire atlas shows everything again." onClick={() => runAction("isolateFocus")}>Focus context only: {settings.isolateFocus ? "On" : "Off"}</button>;
  for(const entry of UI_FIELD_CATALOG)uiFunctions.push({...entry,control:true,available:false,element:<p>Select the relevant node, relationship or investigation to edit {entry.label.toLowerCase()}.</p>});
  const replaceFunction = (id: string, label: string, element: React.ReactElement, control = false) => { const index = uiFunctions.findIndex((f) => f.id === id); const value = { id, label, element, control, category: uiFunctions[index]?.category ?? (control ? "Settings" : id.startsWith("panel:") ? "Panels" : "Workspace") }; if (index >= 0) uiFunctions[index] = value; else uiFunctions.push(value); };
  const field = (id: string, label: string, element: React.ReactElement) => { const entry=UI_FIELD_CATALOG.find(f=>f.id===id);replaceFunction(id, entry?.label??label, element, true);if(entry)uiFunctions.find(f=>f.id===id)!.category=entry.category; return <FunctionControl id={id} key={id} />; };
  for(const action of ACTIONS){replaceFunction(`shortcut:${action.id}`,`${action.label} shortcut`,<div className="binding-row" title={FEATURE_ACTIONS.find(feature => feature.id === action.id)?.description}><FunctionControl id={action.id} palette/><button aria-label={`Rebind ${action.label}`} title="Click, then press a key or mouse button" onClick={()=>setCapturing(action.id)}>{capturing===action.id?'Press a key or mouse button…':functionShortcutBinding(action.id, settings.bindings)||'Unassigned'}</button><button aria-label={`Clear shortcut ${action.label}`} onClick={()=>setSettings(s=>({...s,bindings:{...s.bindings,[action.id]:''}}))}>×</button></div>,true);uiFunctions.find(f=>f.id===`shortcut:${action.id}`)!.category='Shortcuts';}
  for (const [id, key] of Object.entries(settings.bindings).filter(([id]) => id.startsWith("button:"))) {
    const label = settings.buttonLabels[id] ?? id.slice(7);
    replaceFunction(`shortcut:${id}`, `${label} shortcut`, <div className="binding-row"><button onClick={() => window.dispatchEvent(new CustomEvent("omnium:invoke-button", { detail: id }))}>{label}</button><button aria-label={`Rebind ${label}`} onClick={() => { captureLabel.current = label; setCapturing(id); }}>{capturing === id ? "Press a key…" : key || "Unassigned"}</button><button aria-label={`Clear shortcut ${label}`} onClick={() => setSettings(s => ({ ...s, bindings: { ...s.bindings, [id]: "" } }))}>×</button></div>, true);
    uiFunctions.find(f => f.id === `shortcut:${id}`)!.category = "Shortcuts";
  }

  replaceFunction("ui:devMode", "UI edit mode", <button aria-pressed={!!savedUILayout.panels["@devMode"]} onClick={() => runAction("ui:devMode")}>UI edit mode</button>);
  for (const [key, label] of [["selectionModifier", "Drag selection / click to add"], ["nestModifier", "Drag node to nest"], ["subtreeModifier", "Click to toggle entire subtree"]] as const) replaceFunction(`ui:gesture:${key}`, label, <label>{label}<select aria-label={label} value={settings.mouse[key]} onChange={(e) => setSettings((s) => ({ ...s, mouse: { ...s.mouse, [key]: e.target.value as WorkspaceSettings["mouse"][typeof key] } }))}>{["ctrl", "shift", "alt", "none"].map((m) => <option key={m} value={m}>{m === "ctrl" ? "Ctrl / Cmd" : m}</option>)}</select></label>, true);
  for (const [key, label] of [["backButton", "MB4"], ["forwardButton", "MB5"]] as const) replaceFunction(`ui:mouse:${key}`, label, <label>{label}<select aria-label={`${label} action`} value={settings.mouse[key]} onChange={(e) => setSettings((s) => ({ ...s, mouse: { ...s.mouse, [key]: e.target.value as ActionId } }))}>{ACTIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>, true);
  for (const key of ["leftEmpty"] as const) replaceFunction(`ui:camera:${key}`, key === "leftEmpty" ? "Left-drag empty space" : "Right-drag empty space", <label>{key === "leftEmpty" ? "Left-drag empty space" : "Right-drag empty space"}<select aria-label={`Shortcut ${key}`} value={settings.mouse[key]} onChange={(e) => setSettings((s) => ({ ...s, mouse: { ...s.mouse, [key]: e.target.value as WorkspaceSettings["mouse"][typeof key] } }))}>{["pan", "rotate", "none"].map((v) => <option key={v}>{v}</option>)}</select></label>, true);
  replaceFunction("ui:camera:rightEmpty", "World navigation", <FunctionControl id="world.navigate" mirror />, true);
  replaceFunction("newNode", "New node", <button onClick={createNodeInContext}>+ Node</button>);
  replaceFunction("searchUI", "Global UI search", <button aria-label="Global UI search" onClick={() => setSearchOpen(true)}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg></button>);
  replaceFunction("settings", "Workspace settings", <button onClick={() => setSettingsOpen(true)}>Workspace settings</button>);
  replaceFunction("theme", "Toggle neon appearance", <button aria-pressed={settings.appearance.theme === "neon"} onClick={() => runAction("theme")}>Theme: {settings.appearance.theme === "neon" ? "Neon" : "Classic"}</button>);
  replaceFunction("appearance", "Master controller", <button onClick={() => setThemeOpen(true)}>Master controller</button>);
  // Old resident IDs keep their placement and appearance, while editing the same
  // registry as the master controller. Unused legacy controls leave the library.
  const savedThemeControls = new Set([...Object.keys(uiLayout.items), ...[...Object.values(uiLayout.windows), ...uiLayout.frames].flatMap(frame => (frame.members ?? []).filter(m => m.kind === "function").map(m => m.id))]);
  for(const property of PROPERTIES.filter(property => property.category?.id === "visual"))replaceFunction(`ui:master:${property.id}`, property.label, <AppearanceAdjustment property={property.id}/>, true);
  for(const [id,control] of Object.entries(LEGACY_CONTROLS))if(savedThemeControls.has(id))replaceFunction(id,control.label,<label>{control.label}<AppearanceAdjustment property={control.property} target={control.target}/></label>,true);
  for(const id of ["ui:animation:scope","ui:animation:inherit","ui:animation:targets","ui:appearance:scope","ui:appearance:inherit","ui:atmosphere"])if(savedThemeControls.has(id))replaceFunction(id,"Master controller",<button onClick={()=>setThemeOpen(true)}>Open Master controller</button>);
  replaceFunction("ui:appearance:theme", "Theme preset", <label>Theme preset<select aria-label="Theme preset" value={settings.appearance.theme} onChange={event => setSettings(old=>({...old,appearance:{...old.appearance,theme:event.target.value as WorkspaceSettings["appearance"]["theme"]}}))}><option value="neon">Neon</option><option value="classic">Classic</option></select></label>,true);
  replaceFunction("ui:appearance:importFont", "Import font", <button disabled={fontImporting} onClick={() => fontInput.current?.click()}>{fontImporting ? "Importing font…" : "Import font"}</button>);
  replaceFunction("ui:resetAppearance", "Preview default appearance", <button onClick={()=>restoreAppearance(defaultSettings().appearance)}>Preview default appearance</button>);
  replaceFunction("ui:appearance:apply", "Apply appearance", <button disabled={!appearancePending} onClick={applyAppearance}>Apply</button>);
  replaceFunction("ui:appearance:discard", "Discard appearance preview", <button disabled={!appearancePending} onClick={discardAppearance}>Discard</button>);
  replaceFunction("ui:appearance:recovery", "Appearance recovery / checkpoints", <button onClick={()=>setRecoveryOpen(true)}>Recovery</button>);
  replaceFunction("ui:themePreset:name", "Theme template name", <label>Template name<input aria-label="Theme template name" maxLength={80} value={themePresetName} onChange={event => setThemePresetName(event.target.value)} /></label>, true);
  replaceFunction("ui:themePreset:select", "Saved themes", <label>Saved themes<select aria-label="Saved themes" value={selectedThemePreset} onChange={event => { setSelectedThemePreset(event.target.value); setThemePresetName(event.target.value || "My theme"); }}><option value="">Choose a saved theme</option>{themePresets.map(preset => <option key={preset.name} value={preset.name}>{preset.name}</option>)}</select></label>, true);
  replaceFunction("ui:themePreset:save", "Save theme template", <button onClick={saveThemePreset}>Save / update theme</button>);
  replaceFunction("ui:themePreset:apply", "Apply saved theme", <button disabled={!selectedThemePreset} onClick={() => { const preset = themePresets.find(preset => preset.name === selectedThemePreset); if (preset) void applyThemePreset(preset); }}>Apply saved theme</button>);
  replaceFunction("ui:themePreset:delete", "Delete saved theme", <button disabled={!selectedThemePreset} onClick={() => { if (storeThemePresets(themePresets.filter(preset => preset.name !== selectedThemePreset))) setSelectedThemePreset(""); }}>Delete saved theme</button>);
  replaceFunction("ui:themePreset:export", "Export theme template", <button onClick={exportTheme}>Export theme JSON</button>);
  replaceFunction("ui:themePreset:import", "Import theme template", <button onClick={() => themeTemplateInput.current?.click()}>Import theme JSON</button>);
  const animationControls = new Set(["ui:appearance:effect", "ui:appearance:effectIntensity", "ui:appearance:density", "ui:appearance:motion"]);
  for (const fn of uiFunctions) {
    if (fn.id.startsWith("ui:animation:") || animationControls.has(fn.id)) fn.category = "Animations";
    else if (fn.id.startsWith("ui:appearance:") || fn.id.startsWith("ui:themePreset:") || ["ui:glow", "ui:resetAppearance", "appearance", "theme"].includes(fn.id)) fn.category = "Appearance";
  }
  replaceFunction("shortcuts", "Shortcuts", <button aria-label="Toggle shortcut display" aria-pressed={shortcutsPinned} title="Hover to view functions; click to pin the editable shortcut display" onMouseEnter={() => setShortcutsHovered(true)} onClick={() => { setShortcutsPinned((v) => !v); setShortcutsHovered(false); }}>Shortcuts</button>);
  replaceFunction("undo", "Undo", <button onClick={() => undo()} disabled={!actionHistory.candidates("undo").length}>Undo</button>);
  replaceFunction("redo", "Redo", <button onClick={() => redo()} disabled={!actionHistory.candidates("redo").length}>Redo</button>);
  replaceFunction("zoom100", "Reset zoom to 100%", <button title="Reset zoom to 100% at the current orbit target" onClick={() => runAction("zoom100")}>100%</button>);
  replaceFunction("cameraOrigin", "Go to world origin", <button onClick={() => runAction("cameraOrigin")}>Origin</button>);
  replaceFunction("rollLeft", "Roll view left 90°", <button onClick={() => runAction("rollLeft")}>↶ 90°</button>);
  replaceFunction("rollRight", "Roll view right 90°", <button onClick={() => runAction("rollRight")}>↷ 90°</button>);
  replaceFunction("ui:undo", "Undo UI", <button onClick={() => runAction("ui:undo")} disabled={!ui.canUndo}>Undo UI</button>);
  replaceFunction("ui:redo", "Redo UI", <button onClick={() => runAction("ui:redo")} disabled={!ui.canRedo}>Redo UI</button>);
  replaceFunction("ui:newView", "New layout view", <button onClick={newView}>+ Layout view</button>);
  replaceFunction("ui:export", "Export JSON", <button onClick={exportJSON}>Export JSON</button>);
  replaceFunction("ui:saveTemplate", "Save UI template", <button onClick={exportTemplate}>Save UI template</button>);
  replaceFunction("ui:import", "Import JSON", <button onClick={() => fileInput.current?.click()}>Import JSON</button>);
  replaceFunction("ui:loadTemplate", "Load UI template", <button onClick={() => templateInput.current?.click()}>Load UI template</button>);
  replaceFunction("ui:view", "Layout view", <label className="toolbar-snap">View<select aria-label="Layout view" value={document.activeLayoutViewId ?? "authored-layout"} onChange={(e) => switchView(e.target.value)}>{!document.layoutViews?.some((v) => v.id === "authored-layout") && <option value="authored-layout">Authored layout</option>}{document.layoutViews?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>, true);
  replaceFunction("ui:viewRule", "New view rule", <label className="toolbar-snap">New view rule<select aria-label="New view rule" value={layoutRule} onChange={(e) => setLayoutRule(e.target.value as typeof layoutRule)}><option value="hierarchy">Hierarchy · top down</option><option value="flow">Directed flow · chosen roles</option><option value="compact">Compact · 3D</option><option value="manual">Manual · copy current</option></select></label>, true);
  replaceFunction("ui:snap", "Snap spacing", <label className="toolbar-snap">Snap<select aria-label="Snap spacing" value={settings.spatial.spacing} onChange={(e) => setSettings((old) => ({ ...old, spatial: { ...old.spatial, spacing: Number(e.target.value) as GridSpacing } }))}>{[0,.25,.5,1,2,5].map((v) => <option key={v} value={v}>{v || "Off"}</option>)}</select></label>, true);
  replaceFunction("ui:settingsSnap", "Settings snap spacing", <label>Snap spacing<select aria-label="Settings snap spacing" value={settings.spatial.spacing} onChange={(event) => setSettings((old) => ({ ...old, spatial: { ...old.spatial, spacing: Number(event.target.value) as GridSpacing } }))}>{[0, 0.25, 0.5, 1, 2, 5].map((step) => <option key={step} value={step}>{step || "Off"}</option>)}</select></label>, true);
  replaceFunction("ui:sphereDiameter", "Node sphere diameter", <label>Node sphere diameter<input aria-label="Node sphere diameter" type="number" min="0.1" max="5" step="0.05" value={settings.spatial.sphereDiameter} onChange={event => setSettings(old => ({ ...old, spatial: { ...old.spatial, sphereDiameter: Math.max(0.1, Math.min(5, Number(event.target.value) || 0.2)) } }))} /><small>World units · unnamed spheres; individually sized visuals keep their size.</small></label>, true);
  replaceFunction("ui:radius", "Minimum placement clearance radius", <CoupledField bindings={propertyBindings} consumer="spatial.placement" property="placement.radius" />, true);
  replaceFunction("ui:clearance", "Collision clearance", <CoupledField bindings={propertyBindings} consumer="spatial.placement" property="placement.clearance" />, true);
  replaceFunction("ui:subtreeModifier", "Subtree click modifier", <label>Expand/collapse subtree click modifier<select aria-label="Subtree click modifier" value={settings.mouse.subtreeModifier} onChange={(event) => setSettings((old) => ({ ...old, mouse: { ...old.mouse, subtreeModifier: event.target.value as WorkspaceSettings["mouse"]["subtreeModifier"] } }))}><option value="shift">Shift</option><option value="alt">Alt</option><option value="ctrl">Ctrl / Cmd</option><option value="none">Off</option></select></label>, true);
  replaceFunction("ui:startInvestigation", "Start frame", <button onClick={createFrame}>Start frame</button>);
  replaceFunction("ui:defineType", "Define relationship type", <button onClick={createType}>+ Define type</button>);
  replaceFunction("ui:reviewProposal", "Validate and preview", <button onClick={reviewProposal}>Validate and preview</button>);
  replaceFunction("ui:flowType", "View relationship type", flowType ? <label className="toolbar-snap">Order type<select aria-label="View relationship type" value={flowType.id} onChange={(event) => setFlowOrder({ typeId: event.target.value, fromRoleId: "", toRoleId: "" })}>{document.relationshipTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label> : <span>Define a relationship type first</span>, true);
  replaceFunction("ui:flowFrom", "View upstream role", flowType ? <label className="toolbar-snap">Upstream role<select aria-label="View upstream role" value={resolvedOrder.fromRoleId} onChange={(event) => setFlowOrder({ ...resolvedOrder, fromRoleId: event.target.value })}>{flowType.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label> : <span>Define a relationship type first</span>, true);
  replaceFunction("ui:flowTo", "View downstream role", flowType ? <label className="toolbar-snap">Downstream role<select aria-label="View downstream role" value={resolvedOrder.toRoleId} onChange={(event) => setFlowOrder({ ...resolvedOrder, toRoleId: event.target.value })}>{flowType.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label> : <span>Define a relationship type first</span>, true);
  for (const [id, title] of [["reuse", "Reuse identity"], ["hierarchy", "Hierarchy"], ["frames", "Investigative frames"], ["inspector", "Inspector"], ["connections", "Connect nodes"], ["types", "Relationship types"], ["ai", "External AI proposal"], ["relationships", "Relationships"], ["help", "Workspace help"]]) replaceFunction(`panel:${id}`, title, <button onClick={() => revealPanel(id)}>{title}</button>);
  for (const fn of uiFunctions) {
    const metadata = ACTIONS.find(action => action.id === fn.id);
    if (metadata && "configuration" in metadata && metadata.configuration === "history") fn.configuration = <HistoryControls history={actionHistory} />;
  }
  return (
    <><AppearanceRecovery open={recoveryOpen} onOpen={setRecoveryOpen} pending={appearancePending} safe={safeView} onSafe={setSafeView} onApply={applyAppearance} onDiscard={discardAppearance} onReset={() => restoreAppearance(defaultSettings().appearance)} checkpoints={checkpoints} onSave={name => { storeCheckpoints(appendCheckpoint(checkpoints, savedSettings.appearance, name || "Manual checkpoint", true)); }} onRestore={checkpoint => restoreAppearance(checkpoint.appearance)} error={recoveryError} />
    <UIWorkspace appearance={{ masterOpen: themeOpen, activityPreview: setActivityRequests, inspect: setMasterInspection, subtreeModifier: settings.mouse.subtreeModifier, safe: safeView, base: previewAppearance, applied: savedSettings.appearance, fonts: customFonts, commit: (controller: Controller) => { setAppearancePreview(null); setSettings(old => old.appearance.controller === controller ? old : ({ ...old, appearance: { ...old.appearance, controller } })); }, preview: controller => setAppearancePreview(previous => controller ? (controller === (previous ?? ui.settings.appearance).controller ? previous : { ...ui.settings.appearance, controller }) : null), reveal: path => setSearchReveal(path ? { path } : null) }} search={{ open: searchOpen, onClose: () => setSearchOpen(false), onPreview: setSearchReveal, onKeep: reveal => { updateUI(layout => revealSearchPath(layout, reveal)); setSearchReveal(null); } }} shortcuts={{ onInvoke: invokeContextShortcut, bindings: settings.bindings, capturing, blocked: settingsOpen || !!insertContext, onCapture: (id, label) => { captureLabel.current = label; setCapturing(id); }, onClear: id => setSettings(s => ({ ...s, bindings: { ...s.bindings, [id]: "" } })) }} layout={uiLayout} update={updateUI} functions={uiFunctions} command={uiCommand} onReset={() => { updateUI(() => validateUILayout(structuredClone(websiteTemplate.layout))); setCapturing(null); setShortcutsHovered(false); }}><div className="workbench"><OmnicWorkspaceActions selected={!!selectedEntity}
      canShow={!!selectedEntity?.omnic && !!selectedPlacement?.visual && !!(selectedPlacement.visual.assetId || selectedPlacement.visual.character)}
      onOpen={() => selectedEntity && setOmnicEditorId(selectedEntity.id)}
      onCreate={() => { try { createOmnicObject(); } catch(e) { setError(message(e)); } }}
      onShow={() => selectedPlacement && commitDocument({...document,placements:document.placements.map(p=>p.id===selectedPlacement.id?{...p,visual:{size:p.visual?.size,showText:p.visual?.showText}}:p)})} />
      <ShortcutConfiguration mouse={settings.mouse} bindings={propertyBindings} /><FrameResizeController bindings={propertyBindings} /><SearchController bindings={propertyBindings} /><FrameViewportSystem /><HistoryActionBridge history={actionHistory} />
      <input ref={themeTemplateInput} type="file" accept="application/json,.json" hidden aria-label="Import theme template file" onChange={event => void importTheme(event.target.files?.[0])} />
      <input ref={fontInput} type="file" accept=".woff2,.woff,.ttf,.otf" hidden aria-label="Import font file" onChange={event => void importFont(event.target.files?.[0])} />
      <header className="toolbar">
        <div className="brand">
          <strong>Omnium</strong>
          <span>Atlas workbench</span>
        </div>
        <div className="toolbar-actions">
          <FunctionControl id="searchUI" />
          {uiLayout.panels["@organized"] ? <>
          <UIFrameStrip id="@toolbarFrames">
          <UIPanel id="menu:file" title="File" menu>
            {["ui:import", "ui:export", "ui:saveTemplate", "ui:loadTemplate"].map(id => <FunctionControl id={id} key={id} />)}
          </UIPanel>
          <UIPanel id="menu:create" title="Create" menu>
            {["omnic.create", "omnic.open", "panel:reuse", "panel:connections", "panel:types", "panel:frames", "panel:ai", "ui:snap"].map(id => <FunctionControl id={id} key={id} />)}
          </UIPanel>
          <UIPanel id="menu:view" title="View" menu>
            <FunctionControl id="appearance" />
            <FunctionControl id="theme" />
            <FunctionControl id="ui:view" /><FunctionControl id="ui:viewRule" />
            {layoutRule === "flow" && flowType && <>
            <FunctionControl id="ui:flowType" />
            <FunctionControl id="ui:flowFrom" />
            <FunctionControl id="ui:flowTo" />
            </>}
            {["ui:newView", "fitAll", "panel:hierarchy", "panel:inspector", "panel:relationships", "panel:help"].map(id => <FunctionControl id={id} key={id} />)}
          </UIPanel>
          <UIPanel id="menu:workspace" title="Workspace" menu>
            {["settings", "shortcuts", "ui:devMode", "ui:arrange", "ui:createFrame", "ui:select", "ui:compact", "ui:align", "ui:undo", "ui:redo", "ui:reset"].map(id => <FunctionControl id={id} key={id} />)}
          </UIPanel>
          </UIFrameStrip>
          <div className="primary-charting-actions" role="toolbar" aria-label="Charting actions">
            {["newNode", "newChild", "connect", "compactAll", "undo", "redo"].map(id => <FunctionControl id={id} key={id} />)}
          </div>
          </> : <>
            <FunctionControl id="ui:view" /><FunctionControl id="ui:viewRule" />
            {layoutRule === "flow" && flowType && <><FunctionControl id="ui:flowType" /><FunctionControl id="ui:flowFrom" /><FunctionControl id="ui:flowTo" /></>}
            {["ui:newView", "newNode", "compactAll", "ui:snap", "settings", "shortcuts", "undo", "redo", "ui:export", "ui:saveTemplate", "ui:import", "ui:loadTemplate"].map(id => <FunctionControl id={id} key={id} />)}
            <UIArrangeButtons /><FunctionControl id="ui:reset" />
          </>}
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void importJSON(e.target.files?.[0]);
            }}
          />
          <input
            ref={templateInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void importTemplate(e.target.files?.[0]);
            }}
          />
        </div>
        <span className="save-status" role="status">
          {saveStatus} · {atlas.nodes.length} nodes · {atlas.relationships.length} relationships
        </span>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      {!autosave && (
        <div className="error">
          Autosave is paused to protect the unreadable saved document. Export your work before
          replacing it.
          <button
            onClick={() => {
              if (window.confirm("Replace the unreadable local save with the current atlas?")) {
                setAutosave(true);
                setRevision((r) => r + 1);
              }
            }}
          >
            Replace local save
          </button>
        </div>
      )}
      <main className="workspace">
        <aside className="sidebar">
          <UIFrameStrip id="@sidebar" title="Sidebar" vertical>
          <UIPanel id="reuse" title="Reuse identity">
            {field("field:find-existing-identity", "Find existing identity", <label>
              Find an existing entity or subsystem
              <input
                aria-label="Find existing identity"
                value={entityLookup}
                onChange={(e) => setEntityLookup(e.target.value)}
                placeholder="Search labels, aliases or IDs"
              />
            </label>)}
            {entityLookup && (
              <ul className="relationship-list">
                {document.entities
                  .filter((e) =>
                    `${e.id} ${e.label} ${e.aliases.join(" ")}`
                      .toLowerCase()
                      .includes(entityLookup.toLowerCase()),
                  )
                  .slice(0, 20)
                  .map((e) => (
                    <li key={e.id}>
                      <button onClick={() => insertExisting(e.id)}>
                        Insert {e.label || e.id} · {e.id}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            {document.placements
              .filter((p) => p.hidden)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    commitDocument({
                      ...document,
                      placements: document.placements.map((x) =>
                        x.id === p.id ? { ...x, hidden: false } : x,
                      ),
                    })
                  }
                >
                  Show hidden{" "}
                  {document.entities.find((e) => e.id === p.entityId)?.label || p.entityId}
                </button>
              ))}
          </UIPanel>
          <UIPanel id="hierarchy" title="Hierarchy">
            {activeLayout && <>{field("field:view-name", "View name", <label>View name<input aria-label="View name" value={activeLayout.name} onChange={(event) => commitDocument({ ...document, layoutViews: document.layoutViews?.map((v) => v.id === activeLayout.id ? { ...v, name: event.target.value } : v) })} /></label>)}<p>Rule: {activeLayout.rule}. Switching views preserves the arrangement you leave.</p>{activeLayout.rule !== "manual" && <button onClick={reapplyView}>Reapply view rule</button>}{activeLayout.id !== "authored-layout" && <button onClick={removeView}>Remove view</button>}</>}
            {atlas.nodes.length ? (
              <nav aria-label="Node hierarchy">{outline(null)}</nav>
            ) : (
              <p>Add a node to begin your atlas.</p>
            )}
          </UIPanel>
          <UIPanel id="frames" title="Investigative frames">
            {field("field:frame-question", "Frame question", <label>
              Question or objective
              <input
                aria-label="Frame question"
                value={frameQuestion}
                onChange={(e) => setFrameQuestion(e.target.value)}
                placeholder="Optional; selected identity becomes anchor"
              />
            </label>)}
            <FunctionControl id="ui:startInvestigation" />
            {field("field:reopen-frame", "Reopen frame", <label>
              Reopen frame
              <select
                aria-label="Reopen frame"
                value={document.activeFrameId ?? ""}
                onChange={(e) => {
                  commitDocument({ ...document, activeFrameId: e.target.value || null });
                  setSelection(null);
                }}
              >
                <option value="">Whole atlas</option>
                {document.frames
                  .filter((f) => !f.discarded)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name || f.question || f.id}
                    </option>
                  ))}
              </select>
            </label>)}
            {document.frames
              .filter((f) => f.discarded)
              .map((f) => (
                <button
                  key={f.id}
                  onClick={() =>
                    commitDocument({
                      ...document,
                      activeFrameId: f.id,
                      frames: document.frames.map((item) =>
                        item.id === f.id ? { ...item, discarded: false } : item,
                      ),
                    })
                  }
                >
                  Recover discarded frame: {f.name || f.question || f.id}
                </button>
              ))}
            {activeFrame && (
              <>
                <p>
                  Saved at knowledge revision {activeFrame.savedRevision}. Current revision{" "}
                  {document.revision}.
                </p>
                <p>
                  Missing references:{" "}
                  {[...activeFrame.scope.entityIds, ...activeFrame.scope.anchorIds]
                    .filter((id) => !document.entities.some((e) => e.id === id))
                    .concat(
                      activeFrame.scope.relationshipIds.filter(
                        (id) => !document.relationships.some((r) => r.id === id),
                      ),
                    )
                    .join(", ") || "None"}
                </p>
                {field("field:lock-frame-scope", "Lock frame scope", <label>
                  <input
                    type="checkbox"
                    checked={activeFrame.locked}
                    onChange={(e) =>
                      commitDocument({
                        ...document,
                        frames: document.frames.map((f) =>
                          f.id === activeFrame.id ? { ...f, locked: e.target.checked } : f,
                        ),
                      })
                    }
                  />{" "}
                  Lock frame scope
                </label>)}
                {field("field:find-frame-identity", "Find frame identity", <label>
                  Find identity to include
                  <input
                    aria-label="Find frame identity"
                    value={frameLookup}
                    onChange={(e) => setFrameLookup(e.target.value)}
                  />
                </label>)}
                {frameLookup &&
                  document.entities
                    .filter((e) =>
                      `${e.id} ${e.label} ${e.aliases.join(" ")}`
                        .toLowerCase()
                        .includes(frameLookup.toLowerCase()),
                    )
                    .slice(0, 10)
                    .map((e) => (
                      <button
                        key={e.id}
                        disabled={activeFrame.locked}
                        onClick={() => {
                          refineFrame({
                            ...activeFrame.scope,
                            entityIds: [...new Set([...activeFrame.scope.entityIds, e.id])],
                            excludedEntityIds: activeFrame.scope.excludedEntityIds.filter(
                              (id) => id !== e.id,
                            ),
                          });
                          setFrameLookup("");
                        }}
                      >
                        Include {e.label || e.id}
                      </button>
                    ))}
                {activeFrame.scope.entityIds.map((id) => (
                  <div key={id}>
                    {document.entities.find((e) => e.id === id)?.label || `Missing: ${id}`}
                    <button
                      disabled={activeFrame.locked}
                      onClick={() =>
                        refineFrame({
                          ...activeFrame.scope,
                          entityIds: activeFrame.scope.entityIds.filter((x) => x !== id),
                          excludedEntityIds: [
                            ...new Set([...activeFrame.scope.excludedEntityIds, id]),
                          ],
                        })
                      }
                    >
                      Exclude
                    </button>
                  </div>
                ))}
                {field("field:exploration-depth", "Exploration depth", <label>
                  Exploration depth
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={activeFrame.scope.depth ?? ""}
                    disabled={activeFrame.locked}
                    onChange={(e) =>
                      refineFrame({
                        ...activeFrame.scope,
                        depth: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>)}
                <p>Charted relationships in frame</p>
                {document.relationships
                  .filter((r) =>
                    r.participants.every((p) => activeFrame.scope.entityIds.includes(p.entityId)),
                  )
                  .map((r) => (
                    field("field:-" + ":" + (r.id), `Include relationship ${r.label || document.relationshipTypes.find(type => type.id === r.typeId)?.name || r.id}`, <label key={r.id}>
                      <input
                        type="checkbox"
                        disabled={activeFrame.locked}
                        checked={activeFrame.scope.relationshipIds.includes(r.id)}
                        onChange={(e) =>
                          refineFrame({
                            ...activeFrame.scope,
                            relationshipIds: e.target.checked
                              ? [...activeFrame.scope.relationshipIds, r.id]
                              : activeFrame.scope.relationshipIds.filter((id) => id !== r.id),
                          })
                        }
                      />{" "}
                      {r.label || document.relationshipTypes.find((t) => t.id === r.typeId)?.name} (
                      {r.id})
                    </label>)
                  ))}
                {activeFrame.history.length > 0 && (
                  <button
                    disabled={activeFrame.locked}
                    onClick={() => refineFrame(activeFrame.history.at(-1)!.scope)}
                  >
                    Restore previous scope
                  </button>
                )}
                <button
                  onClick={() =>
                    commitDocument({
                      ...document,
                      frames: document.frames.map((f) =>
                        f.id === activeFrame.id
                          ? {
                              ...f,
                              promoted: true,
                              name: f.name || f.question || `Boundary ${f.id.slice(0, 8)}`,
                            }
                          : f,
                      ),
                    })
                  }
                >
                  Promote as reusable boundary
                </button>
                <button onClick={() => commitDocument({ ...document, activeFrameId: null })}>
                  Close frame
                </button>
                <button
                  onClick={() =>
                    commitDocument({
                      ...document,
                      activeFrameId: null,
                      frames: document.frames.map((f) =>
                        f.id === activeFrame.id ? { ...f, discarded: true } : f,
                      ),
                    })
                  }
                >
                  Discard frame
                </button>
              </>
            )}
          </UIPanel>
          <UIPanel id="inspector" title="Inspector" className="inspector">
            {selectedBinder && !binderPopup && <VisualControls key={selection?.id} label="Binder" value={selectedBinder.visual} assets={document.assets ?? []} onChange={(visual) => editBinder({ visual })} onAsset={(asset, visual) => editBinder({ visual }, asset)} />}
            {selectedNode ? (
              <>
                <div className="omnic-object-actions"><FunctionControl id="omnic.open" mirror /><FunctionControl id="omnic.show" mirror /></div>
                <UISection id="node-technical-details" title="Technical details" defaultExpanded={false}>
                  <p>Identity: <code>{selectedEntity?.id}</code>
                  <br />
                  Placement: <code>{selectedNode.id}</code>
                  </p>
                </UISection>
                {selectedPlacement?.variantOwner && <p>Variant of {document.entities.find((e) => e.id === document.placements.find((p) => p.id === selectedPlacement.variantOwner!.placementId)?.entityId)?.label}</p>}
                <p>
                  {document.placements.filter((p) => p.entityId === selectedEntity?.id).length}{" "}
                  placement(s) reference this identity.
                </p>
                <button onClick={() => selectedEntity && navigateIdentity(selectedEntity.id)}>
                  Navigate other reference
                </button>
                <p>
                  Structural contents:{" "}
                  {document.compositions.filter((c) => c.parentId === selectedEntity?.id).length}
                </p>
                {document.compositions.some((c) => c.parentId === selectedEntity?.id) && (
                  <>
                    <button
                      onClick={() =>
                        selectedNode.collapsed
                          ? commitDocument(expandPlacement(document, selectedNode.id))
                          : patchNode(selectedNode.id, { collapsed: true })
                      }
                    >
                      {selectedNode.collapsed
                        ? "Expand structural contents"
                        : "Collapse structural contents"}
                    </button>
                    {!selectedNode.collapsed &&
                      document.compositions
                        .filter((c) => c.parentId === selectedEntity?.id)
                        .map((c) => (
                          <div key={c.id} className="structural-parent-row"><button onClick={() => navigateIdentity(c.childId)}>
                            {document.entities.find((e) => e.id === c.childId)?.label || c.childId}
                          </button><button onClick={() => setSelection({ kind: "composition", id: c.id })}>Edit composition binder</button></div>
                        ))}
                  </>
                )}
                <p>
                  Relationships:{" "}
                  {document.relationships
                    .filter((r) => r.participants.some((p) => p.entityId === selectedEntity?.id))
                    .map(
                      (r) =>
                        `${document.relationshipTypes.find((t) => t.id === r.typeId)?.name ?? r.typeId} (${r.id})`,
                    )
                    .join(", ") || "None charted"}
                </p>
                {field("field:node-name", "Node name", <label>
                  Name
                  <input
                    aria-label="Node name"
                    value={selectedNode.label}
                    maxLength={500}
                    onChange={(e) => patchNode(selectedNode.id, { label: e.target.value })}
                  />
                </label>)}
                <VisualControls key={[...selectedIds].sort().join("|")} label="Node" sphereDiameter={settings.spatial.sphereDiameter} value={selectedPlacement?.visual} assets={document.assets ?? []} onChange={editNodeVisual} onAsset={(asset, visual) => editNodeVisual(visual, asset)} />
                <AppearanceControls label="Node" value={selectedPlacement?.appearance} defaults={nodeThemeDefaults} onPreview={appearance => setColorPreview({ kind: "node", id: selectedNode.id, color: appearance.color })} onChange={(appearance) => commitDocument({ ...document, placements: document.placements.map((p) => p.id === selectedNode.id ? { ...p, appearance } : p) })} />
                {field("field:entity-aliases", "Entity aliases", <label>
                  Aliases (comma-separated)
                  <input
                    aria-label="Entity aliases"
                    value={selectedEntity?.aliases.join(", ") ?? ""}
                    onChange={(e) => {
                      if (!selectedEntity) return;
                      commitDocument({
                        ...document,
                        entities: document.entities.map((item) =>
                          item.id === selectedEntity.id
                            ? {
                                ...item,
                                aliases: e.target.value
                                  .split(",")
                                  .map((alias) => alias.trim())
                                  .filter(Boolean),
                              }
                            : item,
                        ),
                      });
                    }}
                  />
                </label>)}
                {field("field:node-notes", "Node notes", <label>
                  Notes
                  <textarea
                    aria-label="Node notes"
                    value={selectedNode.notes}
                    maxLength={10000}
                    rows={4}
                    onChange={(e) => patchNode(selectedNode.id, { notes: e.target.value })}
                  />
                </label>)}
                {field("field:node-parent", "Node parent", <label>
                  Visual parent (placement only)
                  <select
                    aria-label="Node parent"
                    value={selectedNode.parentId ?? ""}
                    onChange={(e) => {
                      try { commitDocument(reparentVisual(document, selectedNode.id, e.target.value || null, settings.spatial)); }
                      catch (error) { setError(message(error)); }
                    }}
                  >
                    <option value="">None (root)</option>
                    {atlas.nodes
                      .filter((n) => n.id !== selectedNode.id && !forbiddenParents.has(n.id))
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label || "Untitled node"}
                        </option>
                      ))}
                  </select>
                </label>)}
                {field("field:structural-container", "Structural container", <label>
                  Structural container
                  <select
                    aria-label="Structural container"
                    value=""
                    onChange={(e) => {
                      if (!selectedEntity) return;
                      if (
                        e.target.value &&
                        !document.compositions.some(
                          (c) => c.parentId === e.target.value && c.childId === selectedEntity.id,
                        )
                      )
                        commitDocument({
                          ...document,
                          compositions: [
                            ...document.compositions,
                            { id: newId(), parentId: e.target.value, childId: selectedEntity.id },
                          ],
                        });
                    }}
                  >
                    <option value="">Add structural container…</option>
                    {document.entities
                      .filter((e) => e.id !== selectedEntity?.id)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.label || e.id}
                        </option>
                      ))}
                  </select>
                </label>)}
                {document.compositions
                  .filter((c) => c.childId === selectedEntity?.id)
                  .map((c) => (
                    <div key={c.id} className="structural-parent-row">
                      {document.entities.find((e) => e.id === c.parentId)?.label || c.parentId}
                      <button
                        onClick={() =>
                          commitDocument({
                            ...document,
                            compositions: document.compositions.filter((x) => x.id !== c.id),
                          })
                        }
                      >
                        Remove structural containment
                      </button>
                    </div>
                  ))}
                <UISection legacyTag="DIV" id="spatial-position" title="3D position (local XYZ)" className="spatial-fields">
                  {(["x", "y", "z"] as const).map((axis) => {
                    const fallback = {
                      x: selectedNode.position.x / 100,
                      y: selectedNode.parentId ? -2 : 0,
                      z: selectedNode.position.y / 100,
                    };
                    const coordinates = selectedNode.spatialPosition ?? fallback;
                    return (
                      field("field:" + (`3D ${axis.toUpperCase()} position`), `3D ${axis.toUpperCase()} position`, <label key={axis}>
                        {axis.toUpperCase()}
                        <input
                          aria-label={`3D ${axis.toUpperCase()} position`}
                          type="number"
                          step="0.1"
                          min="-10000"
                          max="10000"
                          value={coordinates[axis]}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (Number.isFinite(value) && Math.abs(value) <= 10000)
                              patchNode(selectedNode.id, {
                                spatialPosition: { ...coordinates, [axis]: value },
                              });
                          }}
                        />
                      </label>)
                    );
                  })}
                  {selectedNode.spatialPosition && (
                    <button
                      onClick={() => patchNode(selectedNode.id, { spatialPosition: {
                        x: selectedNode.position.x / 100,
                        y: selectedNode.parentId ? -2 : 0,
                        z: selectedNode.position.y / 100,
                      } })}
                    >
                      Move near legacy 2D position
                    </button>
                  )}
                </UISection>
                <button onClick={() => addNode(selectedNode.id)}>+ Child node</button>
                {field("field:hide-this-placement", "Hide this placement", <label>
                  <input
                    type="checkbox"
                    checked={selectedPlacement?.hidden ?? false}
                    onChange={(e) =>
                      commitDocument({
                        ...document,
                        placements: document.placements.map((p) =>
                          p.id === selectedNode.id ? { ...p, hidden: e.target.checked } : p,
                        ),
                      })
                    }
                  />{" "}
                  Hide this placement
                </label>)}
                <button onClick={() => removePlacement(selectedNode.id)}>
                  Remove this placement
                </button>
                <button
                  className="danger"
                  onClick={() => selectedEntity && deleteIdentity(selectedEntity.id)}
                >
                  Delete identity and all references
                </button>
                {forbiddenParents.size > 0 && (
                  <button
                    onClick={() => {
                      patchNode(selectedNode.id, { collapsed: !selectedNode.collapsed });
                    }}
                  >
                    {selectedNode.collapsed ? "Expand children" : "Collapse children"}
                  </button>
                )}
              </>
            ) : selectedComposition ? (
              <>
                <p>{document.entities.find((e) => e.id === selectedComposition.parentId)?.label} → {document.entities.find((e) => e.id === selectedComposition.childId)?.label}</p>
                <p>Authored structural composition. This binder is independent of spatial positioning.</p>
                <BinderControls {...binderThemeProps} composition defaultText={selectedBinderText} value={selectedComposition} onChange={editBinder} />
              </>
            ) : selectedRelationship ? (
              <>
                <UISection id="relationship-technical-details" title="Technical details" defaultExpanded={false}><p>Relationship ID: <code>{selectedRelationship.id}</code></p></UISection>
                {selectedRelationData && <BinderControls {...binderThemeProps} defaultText={selectedBinderText} value={selectedRelationData} onChange={updateRelation} />}
                {field("field:relationship-type", "Relationship type", <label>
                  Type
                  <select
                    aria-label="Relationship type"
                    value={selectedRelationData?.typeId ?? ""}
                    onChange={(e) => {
                      const type = document.relationshipTypes.find((t) => t.id === e.target.value);
                      if (type && selectedRelationData)
                        updateRelation({
                          typeId: type.id,
                          participants: selectedRelationData.participants
                            .slice(0, 2)
                            .map((p, i) => ({ ...p, roleId: type.roles[i].id })),
                        });
                    }}
                  >
                    {document.relationshipTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.symbol} {t.name}
                      </option>
                    ))}
                  </select>
                </label>)}
                {field("field:relationship-label", "Relationship label", <label>
                  Label
                  <input
                    aria-label="Relationship label"
                    maxLength={500}
                    value={selectedRelationship.label}
                    onChange={(e) =>
                      commit({
                        ...atlas,
                        relationships: atlas.relationships.map((r) =>
                          r.id === selectedRelationship.id ? { ...r, label: e.target.value } : r,
                        ),
                      })
                    }
                  />
                </label>)}
                {field("field:relationship-source", "Relationship source", <label>
                  From
                  <select
                    aria-label="Relationship source"
                    value={selectedRelationship.source}
                    onChange={(e) =>
                      commit({
                        ...atlas,
                        relationships: atlas.relationships.map((r) =>
                          r.id === selectedRelationship.id ? { ...r, source: e.target.value } : r,
                        ),
                      })
                    }
                  >
                    {options()}
                  </select>
                </label>)}
                {field("field:relationship-target", "Relationship target", <label>
                  To
                  <select
                    aria-label="Relationship target"
                    value={selectedRelationship.target}
                    onChange={(e) =>
                      commit({
                        ...atlas,
                        relationships: atlas.relationships.map((r) =>
                          r.id === selectedRelationship.id ? { ...r, target: e.target.value } : r,
                        ),
                      })
                    }
                  >
                    {options()}
                  </select>
                </label>)}
                {selectedRelationData?.participants.slice(0, 2).map((participant, i) => {
                  const type = document.relationshipTypes.find(
                    (t) => t.id === selectedRelationData.typeId,
                  );
                  return (
                    field("field:participant-role" + ":" + (i), "Participant role", <label key={i}>
                      Participant {i + 1} role
                      <select
                        value={participant.roleId}
                        onChange={(e) =>
                          updateRelation({
                            participants: selectedRelationData.participants.map((p, index) =>
                              index === i ? { ...p, roleId: e.target.value } : p,
                            ),
                          })
                        }
                      >
                        {type?.roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </label>)
                  );
                })}
                <button
                  className="danger"
                  onClick={() => {
                    commit({
                      ...atlas,
                      relationships: atlas.relationships.filter(
                        (r) => r.id !== selectedRelationship.id,
                      ),
                    });
                    setSelection(null);
                  }}
                >
                  Delete relationship
                </button>
              </>
            ) : (
              <p>Select a node or relationship to edit it.</p>
            )}
          </UIPanel>
          <UIPanel id="connections" title="Connect nodes">
            <p>Choose endpoints below to add a directed relationship.</p>
            {field("field:new-relationship-source", "New relationship source", <label>
              From
              <select
                aria-label="New relationship source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Choose node</option>
                {options()}
              </select>
            </label>)}
            {field("field:new-relationship-target", "New relationship target", <label>
              To
              <select
                aria-label="New relationship target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Choose node</option>
                {options()}
              </select>
            </label>)}
            <button
              disabled={
                !atlas.nodes.some((n) => n.id === source) ||
                !atlas.nodes.some((n) => n.id === target)
              }
              onClick={() => connect({ source, target })}
            >
              Add relationship
            </button>
          </UIPanel>
          <UIPanel id="types" title="Relationship types">
            <FunctionControl id="ui:defineType" />
            {document.relationshipTypes.map((type) => (
              <div key={type.id}>
                {field("field:" + (`Type name ${type.id}`), `Type name ${type.id}`, <label>
                  Type name{" "}
                  <input
                    aria-label={`Type name ${type.id}`}
                    value={type.name}
                    onChange={(e) => patchType(type.id, { name: e.target.value })}
                  />
                </label>)}
                {field("field:" + (`Type symbol ${type.id}`), `Type symbol ${type.id}`, <label>
                  Display symbol{" "}
                  <input
                    aria-label={`Type symbol ${type.id}`}
                    value={type.symbol}
                    maxLength={50}
                    onChange={(e) => patchType(type.id, { symbol: e.target.value })}
                  />
                </label>)}
                {field("field:" + (`Type definition ${type.id}`), `Type definition ${type.id}`, <label>
                  Definition{" "}
                  <textarea
                    aria-label={`Type definition ${type.id}`}
                    value={type.definition}
                    onChange={(e) => patchType(type.id, { definition: e.target.value })}
                  />
                </label>)}
                {type.roles.slice(0, 2).map((role, i) => (
                  field("field:" + (`Role ${i + 1} ${type.id}`), `Role ${i + 1} ${type.id}`, <label key={role.id}>
                    Role {i + 1}
                    <input
                      aria-label={`Role ${i + 1} ${type.id}`}
                      value={role.name}
                      onChange={(e) =>
                        patchType(type.id, {
                          roles: type.roles.map((r) =>
                            r.id === role.id ? { ...r, name: e.target.value } : r,
                          ),
                        })
                      }
                    />
                  </label>)
                ))}
              </div>
            ))}
          </UIPanel>
          <UIPanel id="ai" title="External AI proposal">
            <p>
              Export the atlas JSON for an external AI. Ask it for an <code>omnium-changeset</code>{" "}
              with this document revision ({document.revision}) and stable IDs. Valid structure
              still needs your factual review.
            </p>
            {field("field:change-set-json", "Change set JSON", <textarea
              aria-label="Change set JSON"
              rows={7}
              value={proposalText}
              onChange={(e) => {
                setProposalText(e.target.value);
                setProposalPreview(null);
              }}
              placeholder="Paste change-set JSON"
            />)}
            <button onClick={() => proposalInput.current?.click()}>
              Load change-set JSON file
            </button>
            <input
              ref={proposalInput}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && file.size > 5_000_000)
                  setError("Change set exceeds the 5 MB import limit.");
                else if (file)
                  void file
                    .text()
                    .then((value) => {
                      setProposalText(value);
                      setProposalPreview(null);
                    })
                    .catch((error) => setError(message(error)));
                event.target.value = "";
              }}
            />
            <FunctionControl id="ui:reviewProposal" />
            {proposalPreview && (
              <div className="proposal-preview">
                <p>Proposed changes at revision {document.revision}:</p>
                <ul>
                  {proposalPreview.lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    if (window.confirm("Apply these reviewed structural changes?")) {
                      commitDocument(proposalPreview.next);
                      setProposalText("");
                    }
                  }}
                >
                  Approve and apply atomically
                </button>
              </div>
            )}
          </UIPanel>
          {
            <UIPanel id="relationships" title="Relationships">
                <p>
                3D links connect through collapsed ancestors. This list retains every relationship.
              </p>
              {!atlas.relationships.length && <p>No relationships yet.</p>}
              <ul className="relationship-list">
                {atlas.relationships.map((r) => (
                  <li key={r.id}>
                    <button
                      className={selection?.id === r.id ? "active" : ""}
                      onClick={() => setSelection({ kind: "relationship", id: r.id })}
                    >
                      {atlas.nodes.find((n) => n.id === r.source)?.label || "Untitled"} →{" "}
                      {atlas.nodes.find((n) => n.id === r.target)?.label || "Untitled"}
                      <small>{r.label || "Unlabelled relationship"}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </UIPanel>
          }
          <UIPanel id="scene" title="Scene">
            <ScenePanel node={selectedNode && selectedEntity ? { id: selectedNode.id, label: selectedEntity.label, notes: selectedEntity.notes } : null}
              revision={document.revision} bindings={propertyBindings} onApply={sceneBackground.apply}
              hasBackground={!!sceneBackground.reference} backgroundError={sceneBackground.error} backgroundKey={sceneReferenceKey(sceneBackground.reference)}
              onForgetLocal={sceneBackground.forgetLocal} nodeExists={id => sceneNodeIdsRef.current.has(id)} />
          </UIPanel>
          <UIPanel id="help" title="Workspace help" className="help">
            <p>
              Left-drag empty space to pan; right-drag to rotate; scroll to zoom. Drag a name to move it. Shift-drag it onto another name to nest. Click a binder to edit its operators and appearance.
            </p>
            <FunctionControl id="compactSelected" />
            <FunctionControl id="compactFrame" />
            <p>
              Autosave is specific to this browser and origin. Export JSON for a portable backup.
              This is a private local atlas.
            </p>
          </UIPanel>
          </UIFrameStrip>
        </aside>
        <div className="canvas" aria-label="Atlas canvas">
          <WorkspaceBoundary><Suspense fallback={<div className="spatial-loading">Opening 3D workspace…</div>}>
            <SpatialWorkspace
              bindings={propertyBindings}
              history={actionHistory}
              onTransformNodes={(ids, rotation, pivot, layout) => commitDocument(transformPlacements(document, ids, rotation, pivot, layout))}
              wallpaperURL={safeView ? null : sceneBackground.url}
              atlas={atlas}
              document={document}
              selectedId={selection?.kind === "node" ? selection.id : null}
              variantDisplay={variantDisplay}
              selectedIds={selectedIds}
              onSelection={selectMany}
              onAction={runAction}
              optionNodeId={optionNodeId}
              expandedVariants={expandedVariants}
              onToggleVariants={toggleVariants}
              onAddVariant={createVariant}
              onDismissOptions={() => setOptionNodeId(null)}
              settings={renderSettings}
              focusContextIds={focusContextIds}
              colorPreview={colorPreview}
              onFocusContextChange={setFocusContextIds}
              heldNudges={heldNudges}
              command={navCommand}
              constraintAxis={constraintAxis}
              onNodeSelect={selectNodeImmediately}
              onNodeClick={nodeClicked}
              onNodeDoubleClick={nodeDoubleClicked}
              onSubtreeClick={nodeSubtreeClicked}
              onBinderSelect={(id, kind, point) => {
                setSelection({ kind: kind === "variant" ? "variantBinder" : kind === "visual" ? "visualBinder" : kind, id });
                setBinderPopup({ x: Math.min(point.x + 12, window.innerWidth - 370), y: Math.min(point.y + 12, window.innerHeight - 460) });
              }}
              resolveMove={(id, local) => moveDisplayedNode(id, local, true)}
              onMove={(id, local) => { try { moveDisplayedNode(id, local); } catch (e) { setError(message(e)); } }}
              canNest={nestReason}
              onNest={nest}
              onContextAction={contextAction}
            />
          </Suspense></WorkspaceBoundary>
          {!atlas.nodes.length && (
            <div className="empty-state">
              <h1>Build your atlas</h1>
              <button onClick={() => addNode(null)}>+ Add first node</button>
            </div>
          )}
        </div>
      </main>
      {connectionSource && <div className="operation-banner" role="status">Select another name to connect from {atlas.nodes.find((n) => n.id === connectionSource)?.label || "selected node"}. <button onClick={() => setConnectionSource(null)}>Cancel</button></div>}
      {insertContext && <FloatingWindow id="insert-existing" title="Insert existing entity" width={440} height={430} modal onClose={() => setInsertContext(null)}>
        {field("field:insert-existing-search", "Search existing entities", <label>Search existing entities<input autoFocus aria-label="Search existing entities" value={insertQuery} onChange={(event) => setInsertQuery(event.target.value)} placeholder="Search label, alias, or ID" /></label>)}
        <div className="entity-results">{document.entities.filter((entity) => `${entity.id} ${entity.label} ${entity.aliases.join(" ")}`.toLowerCase().includes(insertQuery.toLowerCase())).slice(0, 30).map((entity) => <button key={entity.id} onClick={() => insertExisting(entity.id, insertContext.parentId, insertContext.world)}>{entity.label || entity.id}<small>{entity.id}</small></button>)}</div>
        <button onClick={() => setInsertContext(null)}>Close</button>
      </FloatingWindow>}
      {(shortcutsPinned || shortcutsHovered) && <div onMouseLeave={() => setShortcutsHovered(false)}><ShortcutDisplay onInteract={() => setShortcutsPinned(true)} settings={renderSettings} onChange={setSettings} capturing={capturing} onCapture={setCapturing} onAction={runAction} onClose={() => { setShortcutsPinned(false); setShortcutsHovered(false); }} /></div>}
      {binderPopup && selectedBinder && <FloatingWindow id="binder-editor" openingKey={`${selection?.kind}:${selection?.id}:${binderPopup.x}:${binderPopup.y}`} title="Binder editor" className="binder-editor" x={binderPopup.x} y={binderPopup.y} width={370} height={560} onClose={() => setBinderPopup(null)} closeLabel="Close binder editor"><BinderControls {...binderThemeProps} value={selectedBinder} defaultText={selectedBinderText} onChange={editBinder} composition={selection?.kind === "composition"} /><VisualControls key={selection?.id} label="Binder" value={selectedBinder.visual} assets={document.assets ?? []} onChange={(visual) => editBinder({ visual })} onAsset={(asset, visual) => editBinder({ visual }, asset)} /></FloatingWindow>}
      {omnicObject && <FloatingWindow id="omnic-composer" title={`Omnic · ${omnicObject.label || "object"}`} width={600} height={650} onClose={() => setOmnicEditorId(null)}>
        <Suspense fallback={<p>Opening Omnic composer…</p>}><OmnicComposer key={omnicObject.id} entity={omnicObject} objects={document.entities} history={actionHistory} onSave={saveOmnic}
          onCopy={(recipe,label) => createOmnicObject(recipe,label,omnicObject.id)} onClose={() => setOmnicEditorId(null)} /></Suspense>
      </FloatingWindow>}
      {themeOpen && <FloatingWindow id="theme" openAtCursor={false} openingKey={masterInspection || undefined} title="Master controller" width={350} height={600} x={Math.max(8, window.innerWidth - 374)} y={90} onClose={() => setThemeOpen(false)} onMinimize={() => {
        if (appearancePending) { setAppearanceExit("minimize"); return false; }
        return true;
      }} footer={appearancePending ? <AppearancePreviewActions awaitingChoice={!!appearanceExit} onContinue={() => setAppearanceExit(null)} /> : undefined}>
        <MasterController history={actionHistory} bindings={propertyBindings} visualStatus={<p role="status">{appearancePending ? "Preview — Apply to save these appearance changes." : "Appearance saved. Hold Esc for 2 seconds for recovery."}</p>}>
        {/* Keep the original theme subsection identities when nesting them in Visuals. */}
        <EmbeddedGroup id={`section:${stableUIHash("window:theme")}:theme-utilities`} title="Theme utilities" className="ui-section" nativeTag="transparent">
          {["ui:appearance:theme", "ui:appearance:importFont", "ui:resetAppearance"].map(id => <FunctionControl key={id} id={id} />)}
        </EmbeddedGroup>
        <EmbeddedGroup id={`section:${stableUIHash("window:theme")}:theme-templates`} title="Theme templates" className="ui-section" nativeTag="transparent">
          <p>Save colors, window appearance and animations together.</p>
          {["name", "select", "save", "apply", "delete", "export", "import"].map(action => <FunctionControl key={action} id={`ui:themePreset:${action}`} />)}

        </EmbeddedGroup>
        </MasterController>
      </FloatingWindow>}
      {settingsOpen && <FloatingWindow id="settings" title="Workspace settings" width={520} height={640} onClose={() => setSettingsOpen(false)}>
        <CloudPanel />
        <FunctionControl id="appearance" palette />
        <UISection id="spatial-settings" title="Spatial settings">
          {["ui:sphereDiameter", "ui:settingsSnap", "ui:radius", "ui:clearance", "isolateFocus"].map(id => <FunctionControl key={id} id={id} />)}
        </UISection>
        <UISection id="mouse-settings" title="Mouse & gestures">
          <FunctionControl id="ui:subtreeModifier" />
          {(["leftEmpty", "rightEmpty"] as const).map(key => <FunctionControl key={key} id={`ui:camera:${key}`} />)}
          {["selectionModifier", "nestModifier", "subtreeModifier"].map(key => <FunctionControl key={key} id={`ui:gesture:${key}`} />)}
          {["backButton", "forwardButton"].map(key => <FunctionControl key={key} id={`ui:mouse:${key}`} />)}
        </UISection>
        <UISection id="keyboard-actions" title="Shortcuts & gestures">
          {ACTIONS.some(action => keyConflict(settings.bindings, action.id, settings.bindings[action.id])) && <p role="alert">Some bindings conflict. Reassign or clear the duplicate keys.</p>}
          {Array.from(new Set(ACTIONS.map(action => action.category))).map(category => <UISection key={category} id={`shortcuts-${category}`} title={category} className="settings-category">
            {ACTIONS.filter(action => action.category === category).map(action => <FunctionControl key={action.id} id={`shortcut:${action.id}`} />)}
            <ShortcutGestures category={category} />
          </UISection>)}
        </UISection>
        <div className="dialog-actions"><FunctionControl id="ui:reset" palette /><button title="Reset mouse, keybindings and spatial preferences" onClick={() => { setSettings(old => ({ ...defaultSettings(), appearance: old.appearance })); setCapturing(null); }}>Reset controls</button><button onClick={() => { setSettingsOpen(false); setCapturing(null); }}>Close</button></div>
      </FloatingWindow>}
    </div><WindowSparkles source={renderSource} appearance={renderedAppearance} /></UIWorkspace></>
  );
}
export default function App() {
  return <Workbench />;
}

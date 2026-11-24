import {createHeldCommands,createReleaseShortcuts} from '../ui/releaseShortcuts.ts';
import {pointerCombo} from '../ui/activationCombo.ts';
import type {ShortcutDefinition} from '../ui/shortcuts.ts';
import type {ThemeVariation} from './themeControls.ts';
export const THEME_COLORS_SHORTCUT:ShortcutDefinition={category:'Omnium',id:'world:theme-colors',label:'Theme color inclusions',defaultKey:'F6',scope:'application'};
export function createThemeShortcutCommands(queue:ReturnType<typeof createReleaseShortcuts>,binding:()=>string,run:(kind:ThemeVariation)=>void){const commands=createHeldCommands<MouseEvent>(queue,()=>[{binding:binding(),run:id=>run(id as ThemeVariation)}],()=>[{id:'macro',binding:'MB4'},{id:'micro',binding:'MB5'}],(event,key)=>pointerCombo(event,[],false,true)===key);return {handle(event:MouseEvent){const command=commands.match(event);if(!command)return false;queue.consume(command.prefix);command.run();return true;}};}

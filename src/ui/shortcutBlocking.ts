/** The consolidated workspace is a regular working surface, not a modal dialog. */
export function shortcutsBlocked(settingsOpen:boolean, workspaceOnly:boolean, insertionOpen:boolean):boolean {
 return insertionOpen || (settingsOpen && !workspaceOnly);
}

/** A primary click on a control remains that control's input in the consolidated workspace. */
export function protectWorkspacePrimaryPress(workspaceOnly:boolean,button:number,modifiers:boolean,controlOwner:unknown):boolean {
 return workspaceOnly && button===0 && !modifiers && !!controlOwner;
}

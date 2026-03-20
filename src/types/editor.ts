export interface EditorState {
  content: string;
  cursorLine: number;
  cursorColumn: number;
  dirty: boolean;
}

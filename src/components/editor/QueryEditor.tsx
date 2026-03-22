import { cancelExecution, executeQuery } from "@/api/query";
import { useConnectionStore } from "@/stores/connectionStore";
import { useEditorStore } from "@/stores/editorStore";
import { useResultStore } from "@/stores/resultStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTabStore } from "@/stores/tabStore";
import type { Tab } from "@/types/tab";
import { dbCol } from "@/utils/mongo";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useCallback, useRef } from "react";
import { Breadcrumb } from "./Breadcrumb";
import { EditorToolbar } from "./EditorToolbar";
import { registerCompletionProvider } from "./providers/completionProvider";
import { registerHoverProvider } from "./providers/hoverProvider";
import { setupMonacoLanguage } from "./providers/mongoLanguage";

interface QueryEditorProps {
  tab: Tab;
}

export function QueryEditor({ tab }: QueryEditorProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const setContent = useEditorStore((s) => s.setContent);
  const setCursor = useEditorStore((s) => s.setCursor);
  const editorState = useEditorStore((s) => s.editors.get(tab.id));
  const updateTab = useTabStore((s) => s.updateTab);
  const setResult = useResultStore((s) => s.setResult);
  const setLoading = useResultStore((s) => s.setLoading);
  const setExecuting = useResultStore((s) => s.setExecuting);
  const isExecuting = useResultStore((s) => s.executing.get(tab.id) ?? false);
  const setError = useResultStore((s) => s.setError);
  const clearError = useResultStore((s) => s.clearError);
  const settings = useSettingsStore((s) => s.settings);

  const col = tab.collection ?? "collection";
  const initialContent =
    editorState?.content ??
    tab.content ??
    `${dbCol(col)}.find({})\n    .projection({})\n    .sort({_id:-1})\n    .limit(0)`;

  const handleRunQuery = useCallback(async () => {
    if (!tab.connectionId || !tab.database) return;
    const editor = editorRef.current;
    if (!editor) return;

    const selection = editor.getSelection();
    let queryText: string;
    if (selection && !selection.isEmpty()) {
      queryText = editor.getModel()?.getValueInRange(selection) ?? "";
    } else {
      queryText = editor.getValue();
    }

    if (!queryText.trim()) return;

    setLoading(tab.id, true);
    setExecuting(tab.id, true);
    clearError(tab.id);
    try {
      const result = await executeQuery({
        connectionId: tab.connectionId,
        database: tab.database,
        collection: tab.collection,
        queryText: queryText.trim(),
        page: 1,
        pageSize: settings.defaultPageSize,
      });
      setResult(tab.id, result);
      if (result.isRawOutput) {
        useResultStore.getState().setViewMode(tab.id, "json");
      } else {
        useResultStore.getState().setViewMode(tab.id, "tree");
      }
    } catch (err) {
      setError(tab.id, err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(tab.id, false);
      setExecuting(tab.id, false);
    }
  }, [tab, settings.defaultPageSize, setLoading, setExecuting, clearError, setResult, setError]);

  const handleStopQuery = useCallback(async () => {
    if (!tab.connectionId) return;
    try {
      await cancelExecution(tab.connectionId);
    } catch {
      // Cancellation is best-effort
    }
  }, [tab.connectionId]);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      // Setup language and providers
      setupMonacoLanguage(monaco);
      registerCompletionProvider(monaco);
      registerHoverProvider(monaco);

      // Run Query shortcut: Ctrl/Cmd+Enter
      editor.addAction({
        id: "run-query",
        label: "Run Query",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => {
          handleRunQuery();
        },
      });

      // Cursor position tracking
      editor.onDidChangeCursorPosition((e) => {
        setCursor(tab.id, e.position.lineNumber, e.position.column);
      });

      // Content change tracking
      editor.onDidChangeModelContent(() => {
        const value = editor.getValue();
        setContent(tab.id, value);
        updateTab(tab.id, { dirty: true });
      });

      // Position cursor inside find({}) and focus
      const cursorCol = `${dbCol(tab.collection ?? "collection")}.find({`.length + 1;
      editor.setPosition({ lineNumber: 1, column: cursorCol });
      editor.focus();

      // Auto-execute query on first open if tab has a connection context
      if (tab.connectionId && tab.database && tab.collection && !editorState?.content) {
        handleRunQuery();
      }
    },
    [tab.id, handleRunQuery, setCursor, setContent, updateTab],
  );

  return (
    <div className="flex h-full flex-col">
      <Breadcrumb
        connectionName={
          tab.connectionId
            ? useConnectionStore.getState().activeConnections.get(tab.connectionId)?.config.name
            : undefined
        }
        database={tab.database}
        collection={tab.collection}
      />
      <EditorToolbar
        onRun={handleRunQuery}
        onStop={handleStopQuery}
        onExplain={handleRunQuery}
        isExecuting={isExecuting}
      />
      <div className="flex-1 min-h-0">
        <Editor
          defaultLanguage="mongoShell"
          defaultValue={initialContent}
          theme={`mongostudio-${useSettingsStore.getState().resolvedTheme}`}
          onMount={handleEditorMount}
          options={{
            fontSize: settings.editorFontSize,
            tabSize: settings.editorTabSize,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            renderLineHighlight: "line",
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            wordBasedSuggestions: "off",
            folding: true,
            automaticLayout: true,
            padding: { top: 8 },
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
            fontLigatures: true,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true },
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
          beforeMount={(monaco) => {
            const darkTokenRules = [
              { token: "keyword", foreground: "C586C0" },
              { token: "string", foreground: "CE9178" },
              { token: "number", foreground: "B5CEA8" },
              { token: "comment", foreground: "6A9955" },
              { token: "operator", foreground: "D4D4D4" },
              { token: "method", foreground: "DCDCAA" },
              { token: "function", foreground: "DCDCAA" },
              { token: "variable.predefined", foreground: "4FC1FF" },
              { token: "type", foreground: "4EC9B0" },
            ];

            // Dark (default — NoSQLBooster-based)
            monaco.editor.defineTheme("mongostudio-dark", {
              base: "vs-dark",
              inherit: true,
              rules: darkTokenRules,
              colors: {
                "editor.background": "#1e1e1e",
                "editor.foreground": "#cccccc",
                "editor.lineHighlightBackground": "#2a2a2a",
                "editorCursor.foreground": "#43C5DB",
                "editor.selectionBackground": "#264f78",
                "editor.inactiveSelectionBackground": "#3a3d41",
                "editorLineNumber.foreground": "#6a6a6a",
              },
            });

            // Light
            monaco.editor.defineTheme("mongostudio-light", {
              base: "vs",
              inherit: true,
              rules: [
                { token: "keyword", foreground: "AF00DB" },
                { token: "string", foreground: "A31515" },
                { token: "number", foreground: "098658" },
                { token: "comment", foreground: "008000" },
                { token: "operator", foreground: "000000" },
                { token: "method", foreground: "795E26" },
                { token: "function", foreground: "795E26" },
                { token: "variable.predefined", foreground: "0070C1" },
                { token: "type", foreground: "267F99" },
              ],
              colors: {
                "editor.background": "#f8f8f8",
                "editor.foreground": "#1e1e1e",
                "editor.lineHighlightBackground": "#f0f0f0",
                "editorCursor.foreground": "#000000",
                "editor.selectionBackground": "#add6ff",
                "editor.inactiveSelectionBackground": "#e5ebf1",
              },
            });

            // Emerald (original green-accent dark)
            monaco.editor.defineTheme("mongostudio-emerald", {
              base: "vs-dark",
              inherit: true,
              rules: darkTokenRules,
              colors: {
                "editor.background": "#1e1e1e",
                "editor.foreground": "#d4d4d4",
                "editor.lineHighlightBackground": "#2a2a2a",
                "editorCursor.foreground": "#aeafad",
                "editor.selectionBackground": "#264f78",
                "editor.inactiveSelectionBackground": "#3a3d41",
              },
            });

            // VS Code Dark
            monaco.editor.defineTheme("mongostudio-vscode-dark", {
              base: "vs-dark",
              inherit: true,
              rules: darkTokenRules,
              colors: {
                "editor.background": "#1e1e1e",
                "editor.foreground": "#d4d4d4",
                "editor.lineHighlightBackground": "#2a2d2e",
                "editorCursor.foreground": "#aeafad",
                "editor.selectionBackground": "#264f78",
                "editor.inactiveSelectionBackground": "#3a3d41",
              },
            });
          }}
        />
      </div>
    </div>
  );
}

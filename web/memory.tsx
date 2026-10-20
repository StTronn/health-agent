import { ChevronDown, ChevronLeft, ChevronRight, FileText, Folder, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { call, type Session } from "@/lib/api";

type Files = Record<string, string>;
type Tree = { [name: string]: Tree | string }; // folder or file path

const toTree = (paths: string[]) => {
  const root: Tree = {};
  for (const path of paths.sort()) {
    const parts = path.replace(/^family\//, "").split("/");
    let node = root;
    for (const dir of parts.slice(0, -1)) node = (node[`${dir}/`] ??= {}) as Tree;
    node[parts.at(-1)!] = path;
  }
  return root;
};

/** Read-only view of the household's files (the agent's memory). Refetches on mount and whenever `version` changes. */
export function Memory({ session, version }: { session: Session; version: number }) {
  const [files, setFiles] = useState<Files>({});
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const last = useRef<Files>(undefined);

  const refresh = async () => {
    setLoading(true);
    try {
      const { files } = await call<{ files: Files }>(session, "files");
      const prev = last.current;
      if (prev) setChanged(new Set(Object.keys(files).filter((p) => prev[p] !== files[p])));
      last.current = files;
      setFiles(files);
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => void refresh(), [session, version]);

  const toggle = (dir: string) => setClosed((s) => (s.delete(dir) ? new Set(s) : new Set(s.add(dir))));
  const render = (tree: Tree, depth = 0, prefix = ""): React.ReactNode =>
    Object.entries(tree).sort(([a, x], [b, y]) => +(typeof x === "string") - +(typeof y === "string") || a.localeCompare(b)).map(([name, node]) => {
      const pad = { paddingLeft: `${depth * 16 + 8}px` };
      if (typeof node === "string") return (
        <button key={node} type="button" style={pad} onClick={() => setOpen(node)}
          className="flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left hover:bg-muted">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{name}</span>
          {changed.has(node) && <span className="ml-auto size-2 shrink-0 rounded-full bg-primary" title="Updated" />}
        </button>
      );
      const key = prefix + name;
      const isOpen = !closed.has(key);
      return (
        <div key={key}>
          <button type="button" style={pad} onClick={() => toggle(key)} className="flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left hover:bg-muted">
            {isOpen ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
            <Folder className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{name}</span>
          </button>
          {isOpen && render(node, depth + 1, key)}
        </div>
      );
    });

  const count = Object.keys(files).length;
  return (
    <div className="flex h-full min-h-0 w-full flex-col text-sm">
      <div className="flex h-[57px] shrink-0 items-center gap-2 border-b px-4">
        {open ? (
          <Button variant="ghost" size="icon-sm" aria-label="Back" onClick={() => setOpen(undefined)}><ChevronLeft /></Button>
        ) : null}
        <span className="min-w-0 flex-1 truncate font-medium">{open ? open.replace(/^family\//, "") : "Memory"}</span>
        {!open && <span className="text-muted-foreground text-xs tabular-nums">{count} files</span>}
        <Button variant="ghost" size="icon-sm" aria-label="Refresh" title="Refresh" disabled={loading} onClick={() => void refresh()}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {error ? <p className="p-2 text-destructive">{error}</p>
          : open ? <MessageResponse className="p-2 leading-relaxed">{files[open] ?? ""}</MessageResponse>
          : count ? render(toTree(Object.keys(files)))
          : <p className="p-2 text-muted-foreground">{loading ? "Loading…" : "No files yet."}</p>}
      </div>
    </div>
  );
}

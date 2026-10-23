import { useCallback, useEffect, useRef, useState } from "react";
import { flushProject, getProject, getState, saveProject } from "@/src/engine/store";
import type { Layer, Page, Project } from "@/src/engine/types";

type Entry = { label: string; pages: Page[] };

// Editor state with undo/redo, live (gesture) changes, debounced autosave and persisted edit history.
export function useEditor(id: string) {
  const [project, setProject] = useState<Project | undefined>(() => getProject(id));
  const [pages, setPages] = useState<Page[]>(() => getProject(id)?.pages ?? []);
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const past = useRef<Entry[]>([]); const future = useRef<Entry[]>([]); const base = useRef<Page[] | null>(null);
  const pagesRef = useRef(pages); pagesRef.current = pages;
  const projRef = useRef(project); projRef.current = project;
  const [, force] = useState(0);

  useEffect(() => () => { flushProject(id); }, [id]);

  const persist = useCallback((nextPages: Page[], label: string, meta: Partial<Project> = {}) => {
    const p = projRef.current; if (!p) return;
    const t = Date.now();
    const next: Project = { ...p, ...meta, pages: nextPages, log: [{ t, label }, ...p.log].slice(0, 300), history: [{ t, label, pages: nextPages }, ...p.history].slice(0, 15) };
    setProject(next);
    if (getState().settings.autosave) { saveProject(next); setDirty(false); } else setDirty(true);
  }, []);

  const live = useCallback((fn: (layers: Layer[]) => Layer[]) => {
    if (!base.current) base.current = pagesRef.current;
    setPages((ps) => ps.map((pg, i) => (i === pageIndexRef.current ? { ...pg, layers: fn(pg.layers) } : pg)));
  }, []);
  const pageIndexRef = useRef(pageIndex); pageIndexRef.current = pageIndex;

  const commit = useCallback((label: string, fn?: (layers: Layer[]) => Layer[]) => {
    const before = base.current ?? pagesRef.current; base.current = null;
    const after = fn ? pagesRef.current.map((pg, i) => (i === pageIndexRef.current ? { ...pg, layers: fn(pg.layers) } : pg)) : pagesRef.current;
    if (after === before) return;
    past.current = [...past.current, { label, pages: before }].slice(-80); future.current = [];
    pagesRef.current = after; setPages(after); persist(after, label); force((x) => x + 1);
  }, [persist]);

  const setAllPages = useCallback((label: string, next: Page[], meta: Partial<Project> = {}) => {
    past.current = [...past.current, { label, pages: pagesRef.current }].slice(-80); future.current = [];
    pagesRef.current = next; setPages(next); persist(next, label, meta); force((x) => x + 1);
  }, [persist]);

  const undo = useCallback(() => {
    const e = past.current.pop(); if (!e) return;
    future.current.push({ label: e.label, pages: pagesRef.current });
    pagesRef.current = e.pages; setPages(e.pages); persist(e.pages, `Undo ${e.label}`); setPageIndex((i) => Math.min(i, e.pages.length - 1)); force((x) => x + 1);
  }, [persist]);
  const redo = useCallback(() => {
    const e = future.current.pop(); if (!e) return;
    past.current.push({ label: e.label, pages: pagesRef.current });
    pagesRef.current = e.pages; setPages(e.pages); persist(e.pages, `Redo ${e.label}`); force((x) => x + 1);
  }, [persist]);

  const setMeta = useCallback((meta: Partial<Project>) => {
    const p = projRef.current; if (!p) return; const next = { ...p, ...meta }; setProject(next); saveProject({ ...next, pages: pagesRef.current });
  }, []);
  const saveNow = useCallback(async () => { const p = projRef.current; if (!p) return; saveProject({ ...p, pages: pagesRef.current }, { immediate: true }); setDirty(false); }, []);

  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const sel = page ? page.layers.filter((l) => selected.includes(l.id)) : [];
  return { project, pages, page, pageIndex, setPageIndex, selected, setSelected, sel, live, commit, setAllPages, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0, undoLabel: past.current[past.current.length - 1]?.label, setMeta, dirty, saveNow, sessionHistory: past.current };
}
export type Editor = ReturnType<typeof useEditor>;

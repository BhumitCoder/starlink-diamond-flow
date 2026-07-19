import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen, Folder, Plus, Trash2, Upload, X, Play,
  ChevronRight, Edit2, Check, AlertCircle, Image as ImageIcon,
  Video, ZoomIn, Download, MoreVertical,
} from "lucide-react";
import { loadDb, updateDb, uid } from "@/lib/db";
import type { CatalogFolder, CatalogItem } from "@/lib/db";
import { useAuth } from "@/lib/auth";

/* ─────────────────────────────────────────────────────────────── */
/*  Helpers                                                        */
/* ─────────────────────────────────────────────────────────────── */
const MAX_IMAGE_PX = 1200;
const MAX_FILE_MB  = 15;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img  = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_PX / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ─────────────────────────────────────────────────────────────── */
/*  Lightbox                                                       */
/* ─────────────────────────────────────────────────────────────── */
function Lightbox({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <p className="text-white/80 text-sm font-medium truncate max-w-[70%]">{item.name}</p>
        <div className="flex items-center gap-2">
          <a
            href={item.data}
            download={item.name}
            className="h-10 w-10 rounded-full bg-white/10 active:bg-white/20 flex items-center justify-center text-white"
          >
            <Download className="h-5 w-5" />
          </a>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-white/10 active:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center px-4 pb-4 min-h-0">
        {item.type === "image" ? (
          <img
            src={item.data}
            alt={item.name}
            className="max-w-full max-h-full object-contain rounded-xl select-none"
            onClick={onClose}
          />
        ) : (
          <video
            src={item.data}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full rounded-xl"
          />
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Folder action menu (3-dot) — works on mobile & desktop        */
/* ─────────────────────────────────────────────────────────────── */
function FolderMenu({
  onRename, onDelete,
}: { onRename: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="h-8 w-8 rounded-xl bg-white/90 border border-border/60 grid place-items-center shadow-sm text-muted-foreground hover:text-foreground active:bg-secondary transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-9 z-30 w-36 bg-white rounded-xl border border-border/60 shadow-lg overflow-hidden"
          >
            <button
              onClick={() => { setOpen(false); onRename(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-secondary active:bg-secondary transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5 text-muted-foreground" /> Rename
            </button>
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 active:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Drop-zone / upload area                                        */
/* ─────────────────────────────────────────────────────────────── */
function UploadZone({ onFiles }: { onFiles: (f: FileList) => void }) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => ref.current?.click()}
      className={`flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-colors select-none
        ${dragging ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/50 hover:bg-secondary/30"}`}
    >
      <div className={`h-14 w-14 rounded-2xl grid place-items-center transition-colors
        ${dragging ? "bg-primary/10" : "bg-secondary"}`}>
        <Upload className={`h-7 w-7 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">
          {dragging ? "Drop to upload" : "Tap to upload"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Images &amp; videos · max {MAX_FILE_MB} MB each</p>
      </div>
      <input ref={ref} type="file" accept="image/*,video/*" multiple className="hidden"
        onChange={e => { if (e.target.files) onFiles(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Main page                                                      */
/* ─────────────────────────────────────────────────────────────── */
export function CatalogPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "employee";

  const [folders, setFolders]               = useState<CatalogFolder[]>([]);
  const [items, setItems]                   = useState<CatalogItem[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const [newFolderName, setNewFolderName]   = useState("");
  const [showNewFolder, setShowNewFolder]   = useState(false);
  const [renamingId, setRenamingId]         = useState<string | null>(null);
  const [renameVal, setRenameVal]           = useState("");
  const [lightboxItem, setLightboxItem]     = useState<CatalogItem | null>(null);
  const [uploading, setUploading]           = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm]   = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Load */
  const reload = useCallback(() => {
    const db = loadDb();
    setFolders(db.catalogFolders ?? []);
    setItems(db.catalogItems ?? []);
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener("starlink-db-updated", reload);
    return () => window.removeEventListener("starlink-db-updated", reload);
  }, [reload]);

  const activeFolder = folders.find(f => f.id === activeFolderId) ?? null;
  const folderItems  = items.filter(it => it.folderId === activeFolderId);

  /* ── Folder CRUD ── */
  function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    updateDb(db => {
      db.catalogFolders.push({ id: uid("cf_"), name, createdBy: user!.id, createdAt: new Date().toISOString() });
    });
    setNewFolderName("");
    setShowNewFolder(false);
  }

  function renameFolder(id: string) {
    const val = renameVal.trim();
    if (!val) return;
    updateDb(db => { const f = db.catalogFolders.find(f => f.id === id); if (f) f.name = val; });
    setRenamingId(null);
  }

  function deleteFolder(id: string) {
    updateDb(db => {
      db.catalogFolders = db.catalogFolders.filter(f => f.id !== id);
      db.catalogItems   = db.catalogItems.filter(it => it.folderId !== id);
    });
    setDeleteConfirm(null);
    if (activeFolderId === id) setActiveFolderId(null);
  }

  /* ── Upload ── */
  async function handleFiles(files: FileList) {
    if (!activeFolderId) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const mb = file.size / 1024 / 1024;
        if (mb > MAX_FILE_MB) { setError(`"${file.name}" exceeds ${MAX_FILE_MB} MB — skipped.`); continue; }
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        if (!isImage && !isVideo) { setError(`"${file.name}" is not a supported file — skipped.`); continue; }
        const data = isImage ? await compressImage(file) : await readAsBase64(file);
        updateDb(db => {
          db.catalogItems.push({
            id: uid("ci_"), folderId: activeFolderId,
            name: file.name, type: isImage ? "image" : "video",
            data, createdBy: user!.id, createdAt: new Date().toISOString(),
          });
        });
      }
    } catch { setError("Upload failed. Try a smaller file."); }
    finally { setUploading(false); reload(); }
  }

  function deleteItem(id: string) {
    updateDb(db => { db.catalogItems = db.catalogItems.filter(it => it.id !== id); });
    setDeleteConfirm(null);
  }

  /* ─────────────────────── Folder grid ─────────────────────────── */
  function FolderGrid() {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-display font-bold text-brand-dark">Catalog</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {folders.length} folder{folders.length !== 1 ? "s" : ""}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => { setShowNewFolder(true); setNewFolderName(""); }}
              className="flex items-center gap-2 px-4 h-10 rounded-xl btn-hero text-sm font-medium shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>New Folder</span>
            </button>
          )}
        </div>

        {/* New-folder input row */}
        <AnimatePresence>
          {showNewFolder && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4 rounded-2xl border border-primary/30 bg-primary/5">
                <Folder className="h-5 w-5 text-primary shrink-0" />
                <input
                  autoFocus
                  className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
                  placeholder="Folder name…"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") createFolder();
                    if (e.key === "Escape") setShowNewFolder(false);
                  }}
                />
                <button
                  onClick={createFolder}
                  className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowNewFolder(false)}
                  className="h-9 w-9 rounded-xl bg-secondary grid place-items-center shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {folders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 grid place-items-center">
              <FolderOpen className="h-10 w-10 text-primary/40" />
            </div>
            <div>
              <p className="font-semibold text-brand-dark">No folders yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                {canEdit
                  ? "Create a folder to start organising your product catalog."
                  : "No catalog folders have been created yet."}
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowNewFolder(true)}
                className="flex items-center gap-2 px-5 h-11 rounded-xl btn-hero text-sm font-medium"
              >
                <Plus className="h-4 w-4" /> New Folder
              </button>
            )}
          </div>
        )}

        {/* Folders */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {folders.map(folder => {
            const count = items.filter(it => it.folderId === folder.id).length;
            const thumb = items.find(it => it.folderId === folder.id && it.type === "image");
            const isRenaming = renamingId === folder.id;

            return (
              <motion.div
                key={folder.id}
                whileTap={{ scale: 0.97 }}
                className="relative"
              >
                {/* Card */}
                <button
                  onClick={() => { if (!isRenaming) setActiveFolderId(folder.id); }}
                  className="w-full flex flex-col rounded-2xl border border-border/60 active:border-primary/40 bg-white shadow-sm overflow-hidden text-left"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video w-full bg-gradient-to-br from-amber-50 to-amber-100 overflow-hidden relative">
                    {thumb ? (
                      <img src={thumb.data} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Folder className="h-10 w-10 text-amber-400" />
                      </div>
                    )}
                  </div>

                  {/* Name row */}
                  <div className="px-3 pt-2.5 pb-1 flex items-center gap-2">
                    <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    {isRenaming ? (
                      <input
                        autoFocus
                        className="flex-1 text-sm font-medium bg-transparent outline-none border-b border-primary min-w-0"
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => {
                          if (e.key === "Enter") { e.stopPropagation(); renameFolder(folder.id); }
                          if (e.key === "Escape") { e.stopPropagation(); setRenamingId(null); }
                        }}
                      />
                    ) : (
                      <span className="text-sm font-medium text-foreground truncate">{folder.name}</span>
                    )}
                  </div>
                  <div className="px-3 pb-2.5 text-[11px] text-muted-foreground">
                    {count} item{count !== 1 ? "s" : ""}
                  </div>
                </button>

                {/* 3-dot menu — always visible, never hidden behind hover */}
                {canEdit && !isRenaming && (
                  <div className="absolute top-2 right-2">
                    <FolderMenu
                      onRename={() => { setRenamingId(folder.id); setRenameVal(folder.name); }}
                      onDelete={() => setDeleteConfirm(folder.id)}
                    />
                  </div>
                )}

                {/* Confirm rename button */}
                {isRenaming && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); renameFolder(folder.id); }}
                      className="h-8 w-8 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-sm"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setRenamingId(null); }}
                      className="h-8 w-8 rounded-xl bg-secondary grid place-items-center shadow-sm"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ─────────────────────── Gallery view ────────────────────────── */
  function Gallery() {
    if (!activeFolder) return null;

    return (
      <div className="space-y-5">
        {/* Breadcrumb row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <button
              onClick={() => setActiveFolderId(null)}
              className="text-sm text-primary font-medium active:underline shrink-0"
            >
              Catalog
            </button>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold text-brand-dark truncate">{activeFolder.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              · {folderItems.length} item{folderItems.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Upload button (quick-tap, separate from drop zone) */}
          {canEdit && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 h-10 rounded-xl btn-hero text-sm font-medium shrink-0 disabled:opacity-60"
            >
              {uploading
                ? <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Upload className="h-4 w-4" />
              }
              {uploading ? "Uploading…" : "Upload"}
            </button>
          )}
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 text-destructive text-sm"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="shrink-0 p-1">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
        />

        {/* Empty state with drop zone */}
        {folderItems.length === 0 ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 grid place-items-center">
                <ImageIcon className="h-8 w-8 text-primary/40" />
              </div>
              <div>
                <p className="font-semibold text-brand-dark">No items yet</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {canEdit ? "Upload images or videos below." : "No items in this folder yet."}
                </p>
              </div>
            </div>
            {canEdit && <UploadZone onFiles={handleFiles} />}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Gallery grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {folderItems.map(item => (
                <motion.div
                  key={item.id}
                  whileTap={{ scale: 0.97 }}
                  className="relative rounded-2xl overflow-hidden border border-border/60 bg-white shadow-sm"
                >
                  {/* Thumbnail tap → lightbox */}
                  <button
                    onClick={() => setLightboxItem(item)}
                    className="block w-full aspect-square bg-secondary/30 overflow-hidden relative"
                  >
                    {item.type === "image" ? (
                      <img src={item.data} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200">
                        <Video className="h-10 w-10 text-slate-400" />
                      </div>
                    )}

                    {/* Video always shows play icon; image shows zoom on hover */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {item.type === "video" ? (
                        <div className="h-12 w-12 rounded-full bg-black/40 flex items-center justify-center">
                          <Play className="h-6 w-6 text-white ml-0.5" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-black/0 hover:bg-black/30 flex items-center justify-center transition-colors">
                          <ZoomIn className="h-5 w-5 text-white opacity-0 hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </div>

                    {/* Type badge */}
                    <div className="absolute top-2 left-2">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-black/50 text-white backdrop-blur-sm">
                        {item.type === "video" ? <Video className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
                        {item.type}
                      </span>
                    </div>
                  </button>

                  {/* Name */}
                  <div className="px-2.5 py-2 text-[11px] text-foreground font-medium truncate leading-tight" title={item.name}>
                    {item.name}
                  </div>

                  {/* Delete — always visible on mobile (top-right of thumbnail) */}
                  {canEdit && (
                    <button
                      onClick={() => setDeleteConfirm(item.id)}
                      className="absolute top-2 right-2 h-8 w-8 rounded-lg bg-white/90 border border-border/60 grid place-items-center text-muted-foreground hover:text-destructive active:text-destructive shadow-sm transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Drop zone below gallery for more uploads */}
            {canEdit && <UploadZone onFiles={handleFiles} />}
          </div>
        )}
      </div>
    );
  }

  /* ─────────────────────── Delete modal ────────────────────────── */
  function DeleteModal() {
    const isFolder = folders.some(f => f.id === deleteConfirm);
    const folder   = folders.find(f => f.id === deleteConfirm);
    const item     = items.find(it => it.id === deleteConfirm);
    const childCnt = folder ? items.filter(it => it.folderId === folder.id).length : 0;

    return (
      <AnimatePresence>
        {deleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setDeleteConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 32 }}
              className="fixed inset-x-4 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 max-w-sm w-full sm:w-full"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            >
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 grid place-items-center mb-4">
                <Trash2 className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="font-semibold text-brand-dark text-lg mb-1">
                {isFolder ? "Delete Folder?" : "Delete Item?"}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                {isFolder
                  ? <>Delete <strong>{folder?.name}</strong>{childCnt > 0 ? ` and all ${childCnt} item${childCnt !== 1 ? "s" : ""} inside it` : ""}? This cannot be undone.</>
                  : <>Delete <strong>{item?.name}</strong>? This cannot be undone.</>}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary active:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => isFolder ? deleteFolder(deleteConfirm!) : deleteItem(deleteConfirm!)}
                  className="flex-1 h-11 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium active:opacity-90 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  /* ─────────────────────────── Render ──────────────────────────── */
  return (
    <div className="max-w-7xl mx-auto">
      {activeFolderId ? <Gallery /> : <FolderGrid />}
      <DeleteModal />
      <AnimatePresence>
        {lightboxItem && <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}
      </AnimatePresence>
    </div>
  );
}

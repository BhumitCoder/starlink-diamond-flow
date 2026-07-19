import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen, Folder, Plus, Trash2, Upload, X, Play,
  ChevronRight, Edit2, Check, AlertCircle, Image as ImageIcon,
  Video, ZoomIn, Download,
} from "lucide-react";
import { loadDb, saveDb, updateDb, uid } from "@/lib/db";
import type { CatalogFolder, CatalogItem } from "@/lib/db";
import { useAuth } from "@/lib/auth";

/* ── helpers ─────────────────────────────────────────────────── */
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
      canvas.width  = w;
      canvas.height = h;
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

/* ── Lightbox ─────────────────────────────────────────────────── */
function Lightbox({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.92 }}
          className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center"
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 z-10 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {item.type === "image" ? (
            <img src={item.data} alt={item.name} className="max-h-[80vh] max-w-full object-contain rounded-xl" />
          ) : (
            <video
              src={item.data}
              controls
              autoPlay
              className="max-h-[80vh] max-w-full rounded-xl"
            />
          )}

          <div className="mt-3 text-white/70 text-sm text-center">{item.name}</div>

          {/* Download */}
          <a
            href={item.data}
            download={item.name}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <Download className="h-4 w-4" /> Download
          </a>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Main page ─────────────────────────────────────────────────── */
export function CatalogPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "employee";

  const [folders, setFolders]         = useState<CatalogFolder[]>([]);
  const [items, setItems]             = useState<CatalogItem[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // UI state
  const [newFolderName, setNewFolderName]       = useState("");
  const [showNewFolder, setShowNewFolder]       = useState(false);
  const [renamingId, setRenamingId]             = useState<string | null>(null);
  const [renameVal, setRenameVal]               = useState("");
  const [lightboxItem, setLightboxItem]         = useState<CatalogItem | null>(null);
  const [uploading, setUploading]               = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm]       = useState<string | null>(null); // id to confirm delete

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Load ── */
  function reload() {
    const db = loadDb();
    setFolders(db.catalogFolders ?? []);
    setItems(db.catalogItems ?? []);
  }
  useEffect(() => {
    reload();
    window.addEventListener("starlink-db-updated", reload);
    return () => window.removeEventListener("starlink-db-updated", reload);
  }, []);

  /* ── Derived ── */
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
    updateDb(db => {
      const f = db.catalogFolders.find(f => f.id === id);
      if (f) f.name = val;
    });
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
  async function handleFiles(files: FileList | null) {
    if (!files || !activeFolderId) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const mb = file.size / 1024 / 1024;
        if (mb > MAX_FILE_MB) {
          setError(`"${file.name}" is too large (max ${MAX_FILE_MB} MB). Skipped.`);
          continue;
        }
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        if (!isImage && !isVideo) {
          setError(`"${file.name}" is not a supported image or video. Skipped.`);
          continue;
        }
        const data = isImage ? await compressImage(file) : await readAsBase64(file);
        updateDb(db => {
          db.catalogItems.push({
            id: uid("ci_"),
            folderId: activeFolderId,
            name: file.name,
            type: isImage ? "image" : "video",
            data,
            createdBy: user!.id,
            createdAt: new Date().toISOString(),
          });
        });
      }
    } catch {
      setError("Upload failed. Try a smaller file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      reload();
    }
  }

  function deleteItem(id: string) {
    updateDb(db => { db.catalogItems = db.catalogItems.filter(it => it.id !== id); });
    setDeleteConfirm(null);
  }

  /* ── Render: folder grid (root view) ── */
  function renderFolders() {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-display font-bold text-brand-dark">Catalog</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {folders.length} folder{folders.length !== 1 ? "s" : ""}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-hero text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> New Folder
            </button>
          )}
        </div>

        {/* New folder input */}
        <AnimatePresence>
          {showNewFolder && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 p-4 rounded-2xl border border-primary/30 bg-primary/5"
            >
              <Folder className="h-5 w-5 text-primary shrink-0" />
              <input
                autoFocus
                className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
                placeholder="Folder name…"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setShowNewFolder(false); }}
              />
              <button onClick={createFolder} className="h-8 w-8 rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => setShowNewFolder(false)} className="h-8 w-8 rounded-xl bg-secondary grid place-items-center shrink-0">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Folders grid */}
        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 grid place-items-center">
              <FolderOpen className="h-10 w-10 text-primary/40" />
            </div>
            <div>
              <p className="font-semibold text-brand-dark">No folders yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                {canEdit ? "Create a folder to start uploading your product catalog." : "No catalog folders have been created yet."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {folders.map(folder => {
              const count = items.filter(it => it.folderId === folder.id).length;
              const thumb = items.find(it => it.folderId === folder.id && it.type === "image");
              const isRenaming = renamingId === folder.id;
              return (
                <motion.div
                  key={folder.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative"
                >
                  <button
                    onClick={() => { if (!isRenaming) setActiveFolderId(folder.id); }}
                    className="w-full flex flex-col rounded-2xl border border-border/60 hover:border-primary/40 hover:shadow-md bg-white transition-all overflow-hidden"
                  >
                    {/* Thumbnail or placeholder */}
                    <div className="aspect-video w-full bg-gradient-to-br from-amber-50 to-amber-100 overflow-hidden relative">
                      {thumb ? (
                        <img src={thumb.data} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Folder className="h-12 w-12 text-amber-400" />
                        </div>
                      )}
                    </div>
                    {/* Label */}
                    <div className="px-3 py-2.5 flex items-center gap-2">
                      <Folder className="h-4 w-4 text-amber-500 shrink-0" />
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
                        <span className="text-sm font-medium text-foreground truncate text-left">{folder.name}</span>
                      )}
                    </div>
                    <div className="px-3 pb-2.5 text-xs text-muted-foreground text-left">
                      {count} item{count !== 1 ? "s" : ""}
                    </div>
                  </button>

                  {/* Action buttons (admin/employee) */}
                  {canEdit && !isRenaming && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); setRenamingId(folder.id); setRenameVal(folder.name); }}
                        className="h-7 w-7 rounded-lg bg-white/90 border border-border/60 grid place-items-center text-muted-foreground hover:text-foreground shadow-sm"
                        title="Rename"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirm(folder.id); }}
                        className="h-7 w-7 rounded-lg bg-white/90 border border-border/60 grid place-items-center text-muted-foreground hover:text-destructive shadow-sm"
                        title="Delete folder"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ── Render: gallery inside a folder ── */
  function renderGallery() {
    if (!activeFolder) return null;
    return (
      <div className="space-y-6">
        {/* Breadcrumb + header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveFolderId(null)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              Catalog
            </button>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold text-brand-dark">{activeFolder.name}</span>
            <span className="text-xs text-muted-foreground">({folderItems.length} item{folderItems.length !== 1 ? "s" : ""})</span>
          </div>

          {canEdit && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-hero text-sm font-medium disabled:opacity-60"
            >
              {uploading ? (
                <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Uploading…" : "Upload"}
            </button>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 text-destructive text-sm"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto shrink-0"><X className="h-4 w-4" /></button>
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
          onChange={e => handleFiles(e.target.files)}
        />

        {/* Gallery grid */}
        {folderItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 grid place-items-center">
              <ImageIcon className="h-10 w-10 text-primary/40" />
            </div>
            <div>
              <p className="font-semibold text-brand-dark">No items yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                {canEdit ? "Click Upload to add images or videos to this folder." : "No items have been added to this folder yet."}
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-hero text-sm font-medium"
              >
                <Upload className="h-4 w-4" /> Upload Files
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {folderItems.map(item => (
              <motion.div
                key={item.id}
                whileHover={{ scale: 1.02 }}
                className="group relative rounded-2xl overflow-hidden border border-border/60 hover:border-primary/40 hover:shadow-md bg-white transition-all"
              >
                {/* Thumbnail */}
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
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    {item.type === "video" ? (
                      <Play className="h-10 w-10 text-white drop-shadow opacity-70 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <ZoomIn className="h-8 w-8 text-white drop-shadow opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  {/* Type badge */}
                  <div className="absolute top-2 left-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/40 text-white backdrop-blur-sm">
                      {item.type === "video" ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                      {item.type}
                    </span>
                  </div>
                </button>

                {/* Name */}
                <div className="px-3 py-2 text-xs text-foreground font-medium truncate" title={item.name}>
                  {item.name}
                </div>

                {/* Delete (admin/employee) */}
                {canEdit && (
                  <button
                    onClick={() => setDeleteConfirm(item.id)}
                    className="absolute top-2 right-2 h-7 w-7 rounded-lg bg-white/90 border border-border/60 grid place-items-center text-muted-foreground hover:text-destructive shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Delete confirm modal ── */
  function DeleteModal() {
    const isFolder = folders.some(f => f.id === deleteConfirm);
    const folder   = folders.find(f => f.id === deleteConfirm);
    const item     = items.find(it => it.id === deleteConfirm);

    return (
      <AnimatePresence>
        {deleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setDeleteConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full pointer-events-auto">
                <div className="h-12 w-12 rounded-2xl bg-destructive/10 grid place-items-center mb-4">
                  <Trash2 className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="font-semibold text-brand-dark text-lg mb-1">
                  {isFolder ? "Delete Folder?" : "Delete Item?"}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {isFolder
                    ? <>Delete <strong>{folder?.name}</strong> and all its {items.filter(it => it.folderId === folder?.id).length} item(s)? This cannot be undone.</>
                    : <>Delete <strong>{item?.name}</strong>? This cannot be undone.</>}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (isFolder) deleteFolder(deleteConfirm!);
                      else deleteItem(deleteConfirm!);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {activeFolderId ? renderGallery() : renderFolders()}
      <DeleteModal />
      {lightboxItem && <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}
    </div>
  );
}

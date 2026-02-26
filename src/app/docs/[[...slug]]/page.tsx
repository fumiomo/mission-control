'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { RootFolder, TreeNode } from '@/app/api/docs/tree/route';

// ── Tree node component ────────────────────────────────────────────────────

interface FileNodeProps {
  node: TreeNode;
  depth: number;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}

function FileNode({ node, depth, selectedSlug, onSelect }: FileNodeProps) {
  const [open, setOpen] = useState(false);
  const indent = depth * 12;

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-mc-bg-secondary text-mc-text-secondary hover:text-mc-text transition-colors text-sm"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
          )}
          <Folder className="w-3.5 h-3.5 flex-shrink-0 text-mc-accent-yellow" />
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && (
          <div>
            {node.children.map((child) => (
              <FileNode
                key={child.slugPath}
                node={child}
                depth={depth + 1}
                selectedSlug={selectedSlug}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedSlug === node.slugPath;
  return (
    <button
      onClick={() => onSelect(node.slugPath)}
      className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
        isSelected
          ? 'bg-mc-accent/20 text-mc-text border border-mc-accent/30'
          : 'text-mc-text-secondary hover:bg-mc-bg-secondary hover:text-mc-text'
      }`}
      style={{ paddingLeft: `${8 + indent}px` }}
    >
      <FileText className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ── Root folder section ────────────────────────────────────────────────────

interface RootSectionProps {
  root: RootFolder;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}

function RootSection({ root, selectedSlug, onSelect }: RootSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-mc-bg-secondary text-mc-text transition-colors text-xs font-semibold uppercase tracking-wide"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-mc-text-secondary" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-mc-text-secondary" />
        )}
        <span className="truncate">{root.displayName}</span>
      </button>
      {open && (
        <div className="mt-0.5">
          {root.children.length === 0 ? (
            <p className="text-xs text-mc-text-secondary px-6 py-1">No .md files found</p>
          ) : (
            root.children.map((node) => (
              <FileNode
                key={node.slugPath}
                node={node}
                depth={0}
                selectedSlug={selectedSlug}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [roots, setRoots] = useState<RootFolder[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load tree on mount
  useEffect(() => {
    fetch('/api/docs/tree')
      .then((r) => r.json())
      .then((data) => setRoots(data))
      .catch(() => {});
  }, []);

  // Load file content when slug changes
  const handleSelect = useCallback(async (slug: string) => {
    setSelectedSlug(slug);
    setContent(null);
    setContentError(null);
    setLoadingContent(true);
    // On mobile: collapse sidebar after selection
    if (window.innerWidth < 768) setSidebarOpen(false);
    try {
      const res = await fetch(`/api/docs/content?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setContent(data.content);
    } catch (e) {
      setContentError(String(e));
    } finally {
      setLoadingContent(false);
    }
  }, []);

  const selectedName = selectedSlug?.split('/').pop() ?? null;

  return (
    <div className="min-h-screen bg-mc-bg text-mc-text font-mono flex flex-col">
      {/* Header */}
      <div className="border-b border-mc-border bg-mc-bg-secondary flex-shrink-0">
        <div className="max-w-full px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-mc-text-secondary hover:text-mc-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="w-px h-4 bg-mc-border" />
          <FileText className="w-4 h-4 text-mc-accent-purple" />
          <h1 className="text-base font-semibold">Docs</h1>
          {selectedName && (
            <>
              <div className="w-px h-4 bg-mc-border" />
              <span className="text-sm text-mc-text-secondary truncate">{selectedName}</span>
            </>
          )}
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="ml-auto md:hidden text-xs px-2 py-1 border border-mc-border rounded text-mc-text-secondary hover:text-mc-text transition-colors"
          >
            {sidebarOpen ? 'Hide tree' : 'Show tree'}
          </button>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'flex' : 'hidden'
          } md:flex flex-col w-full md:w-64 lg:w-72 flex-shrink-0 border-b md:border-b-0 md:border-r border-mc-border bg-mc-bg-secondary overflow-y-auto`}
        >
          <div className="p-2">
            {roots.length === 0 ? (
              <p className="text-xs text-mc-text-secondary px-2 py-4 text-center">Loading…</p>
            ) : (
              roots.map((root) => (
                <RootSection
                  key={root.key}
                  root={root}
                  selectedSlug={selectedSlug}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>
        </aside>

        {/* Content area */}
        <main className={`flex-1 overflow-y-auto ${sidebarOpen ? 'hidden md:block' : 'block'}`}>
          {!selectedSlug && (
            <div className="flex items-center justify-center h-full text-mc-text-secondary text-sm">
              Select a file from the tree to view it.
            </div>
          )}

          {loadingContent && (
            <div className="flex items-center justify-center h-full text-mc-text-secondary text-sm animate-pulse">
              Loading…
            </div>
          )}

          {contentError && (
            <div className="p-6">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {contentError}
              </div>
            </div>
          )}

          {content !== null && !loadingContent && (
            <article className="prose prose-invert prose-sm max-w-none p-6 lg:p-8">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}

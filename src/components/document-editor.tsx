"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import type { AccessRole, DocumentDetail, UserOption } from "@/lib/types";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 700;
const DEFAULT_TITLE = "Untitled document";

const ROLE_BADGE: Record<AccessRole, string> = {
  owner: "Owner",
  editor: "Can edit",
  viewer: "View only",
};

type Patch = { title?: string; contentHtml?: string };

export function DocumentEditor({ docId }: { docId: string }) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);
  const pending = useRef<Patch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Saves run one at a time so an older request can never overwrite a newer one.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const canEdit = doc?.role === "owner" || doc?.role === "editor";
  const isOwner = doc?.role === "owner";

  useEffect(() => {
    let cancelled = false;
    api<DocumentDetail>(`/api/documents/${docId}`)
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        setTitle(d.title);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  // Put the saved HTML into the editable surface once. After that the DOM is the source of truth,
  // so React re-renders do not reset the caret.
  useEffect(() => {
    if (doc && surfaceRef.current && !initialised.current) {
      surfaceRef.current.innerHTML = doc.contentHtml;
      initialised.current = true;
    }
  }, [doc]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    queue.current = queue.current.then(async () => {
      const patch = pending.current;
      if (Object.keys(patch).length === 0) return;
      pending.current = {};
      setSaveState("saving");
      try {
        await api(`/api/documents/${docId}`, { method: "PATCH", body: JSON.stringify(patch) });
        setSaveState((s) => (Object.keys(pending.current).length === 0 ? "saved" : s));
        setSaveError(null);
      } catch (e) {
        // Keep the failed changes queued so the next edit or retry sends them.
        pending.current = { ...patch, ...pending.current };
        setSaveState("error");
        setSaveError((e as Error).message);
      }
    });
    return queue.current;
  }, [docId]);

  const scheduleSave = useCallback(
    (patch: Patch) => {
      pending.current = { ...pending.current, ...patch };
      setSaveState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    },
    [flush],
  );

  // Last-chance save when the tab is closed or hidden. keepalive lets the request outlive the page.
  useEffect(() => {
    function sendOnHide() {
      if (Object.keys(pending.current).length === 0) return;
      void fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending.current),
        keepalive: true,
      });
      pending.current = {};
    }
    window.addEventListener("pagehide", sendOnHide);
    return () => window.removeEventListener("pagehide", sendOnHide);
  }, [docId]);

  function onTitleChange(value: string) {
    setTitle(value);
    scheduleSave({ title: value.trim() || DEFAULT_TITLE });
  }

  function onTitleBlur() {
    if (!title.trim()) setTitle(DEFAULT_TITLE);
  }

  function onSurfaceInput() {
    if (surfaceRef.current) scheduleSave({ contentHtml: surfaceRef.current.innerHTML });
  }

  function format(command: string, value?: string) {
    if (!canEdit) return;
    surfaceRef.current?.focus();
    document.execCommand(command, false, value);
    onSurfaceInput();
  }

  if (loadError) {
    return (
      <main className="page-center">
        <p className="error" role="alert">{loadError}</p>
        <Link href="/">Back to documents</Link>
      </main>
    );
  }

  if (!doc) return <main className="page-center"><p className="muted">Loading…</p></main>;

  return (
    <main className="editor-page">
      <header className="editor-header">
        <Link href="/" className="back" aria-label="Back to documents">←</Link>
        <input
          className="title-input"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleBlur}
          readOnly={!canEdit}
          aria-label="Document title"
          maxLength={200}
        />
        <span className={`badge ${doc.role}`}>{ROLE_BADGE[doc.role]}</span>
        <SaveIndicator state={saveState} error={saveError} />
        {isOwner && (
          <button className="secondary" onClick={() => setShowShare((v) => !v)} aria-expanded={showShare}>
            Share
          </button>
        )}
      </header>

      {canEdit ? (
        <div className="toolbar" role="toolbar" aria-label="Formatting">
          <ToolButton label="Bold" onAction={() => format("bold")} title="Bold (Ctrl+B)"><b>B</b></ToolButton>
          <ToolButton label="Italic" onAction={() => format("italic")} title="Italic (Ctrl+I)"><i>I</i></ToolButton>
          <ToolButton label="Underline" onAction={() => format("underline")} title="Underline (Ctrl+U)"><u>U</u></ToolButton>
          <span className="sep" />
          <ToolButton label="Heading 1" onAction={() => format("formatBlock", "H1")}>H1</ToolButton>
          <ToolButton label="Heading 2" onAction={() => format("formatBlock", "H2")}>H2</ToolButton>
          <ToolButton label="Heading 3" onAction={() => format("formatBlock", "H3")}>H3</ToolButton>
          <ToolButton label="Normal text" onAction={() => format("formatBlock", "P")}>¶</ToolButton>
          <span className="sep" />
          <ToolButton label="Bulleted list" onAction={() => format("insertUnorderedList")}>• List</ToolButton>
          <ToolButton label="Numbered list" onAction={() => format("insertOrderedList")}>1. List</ToolButton>
        </div>
      ) : (
        <p className="readonly-note">You have view-only access. Ask the owner for edit permission.</p>
      )}

      <div
        ref={surfaceRef}
        className="page-surface"
        contentEditable={canEdit}
        suppressContentEditableWarning
        onInput={onSurfaceInput}
        aria-label="Document content"
        aria-readonly={!canEdit}
        role="textbox"
        aria-multiline="true"
      />

      {showShare && isOwner && <SharePanel docId={docId} initialShares={doc.shares} />}
    </main>
  );
}

function ToolButton({
  label,
  title,
  onAction,
  children,
}: {
  label: string;
  title?: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="tool"
      aria-label={label}
      title={title ?? label}
      // Keep the text selection when the button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onAction}
    >
      {children}
    </button>
  );
}

function SaveIndicator({ state, error }: { state: SaveState; error: string | null }) {
  const text = {
    idle: "",
    dirty: "Unsaved changes",
    saving: "Saving…",
    saved: "All changes saved",
    error: error ?? "Save failed",
  }[state];
  return (
    <span className={`save-state ${state}`} role="status" aria-live="polite">
      {text}
    </span>
  );
}

function SharePanel({ docId, initialShares }: { docId: string; initialShares: DocumentDetail["shares"] }) {
  const [shares, setShares] = useState(initialShares);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ users: UserOption[] }>("/api/users")
      .then((d) => setUsers(d.users))
      .catch(() => setUsers([]));
  }, []);

  async function share(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api<{ shares: DocumentDetail["shares"] }>(`/api/documents/${docId}/shares`, {
        method: "POST",
        body: JSON.stringify({ username, role }),
      });
      setShares(res.shares);
      setUsername("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function revoke(userId: string) {
    setError(null);
    try {
      const res = await api<{ shares: DocumentDetail["shares"] }>(`/api/documents/${docId}/shares/${userId}`, {
        method: "DELETE",
      });
      setShares(res.shares);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const candidates = users.filter((u) => !shares.some((s) => s.username === u.username));

  return (
    <section className="share-panel" aria-label="Sharing">
      <h2>Share this document</h2>
      <form onSubmit={share} className="share-form">
        <input
          list="share-users"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username, e.g. bob"
          aria-label="Username to share with"
          required
        />
        <datalist id="share-users">
          {candidates.map((u) => (
            <option key={u.username} value={u.username}>{u.displayName}</option>
          ))}
        </datalist>
        <select value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")} aria-label="Access level">
          <option value="viewer">View only</option>
          <option value="editor">Can edit</option>
        </select>
        <button className="primary" type="submit">Share</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}

      <h3>People with access</h3>
      <ul className="share-list">
        {shares.length === 0 && <li className="muted">Only you have access.</li>}
        {shares.map((s) => (
          <li key={s.userId}>
            <span>
              <strong>{s.displayName}</strong> <span className="muted">@{s.username}</span>
            </span>
            <span className="share-actions">
              <span className={`badge ${s.role}`}>{ROLE_BADGE[s.role]}</span>
              <button className="ghost" onClick={() => revoke(s.userId)}>Remove</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

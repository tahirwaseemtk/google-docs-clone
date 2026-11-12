"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/lib/validation";
import type { DocumentList, DocumentSummary, SessionUser, SharedDocumentSummary } from "@/lib/types";

const ROLE_LABEL = { editor: "Can edit", viewer: "View only" } as const;

export default function DashboardPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [docs, setDocs] = useState<DocumentList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await api<{ user: SessionUser | null }>("/api/session");
        if (!session.user) {
          router.replace("/login");
          return;
        }
        const list = await api<DocumentList>("/api/documents");
        if (!cancelled) {
          setUser(session.user);
          setDocs(list);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function createDocument() {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/documents", {
        method: "POST",
        body: JSON.stringify({}),
      });
      router.push(`/docs/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { id } = await api<{ id: string }>("/api/documents/import", { method: "POST", body: form });
      router.push(`/docs/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function signOut() {
    await api("/api/session", { method: "DELETE" });
    router.replace("/login");
  }

  if (!user || !docs) {
    return <main className="page-center">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}</main>;
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <strong className="brand">Ajaia Docs</strong>
        <div className="topbar-right">
          <span className="muted">Signed in as {user.displayName}</span>
          <button className="ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="dash-actions">
        <button className="primary" onClick={createDocument} disabled={busy}>+ New document</button>
        <div className="import">
          <button className="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
            Import file
          </button>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept={ALLOWED_UPLOAD_EXTENSIONS.join(",")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
          <span className="hint">
            Supports {ALLOWED_UPLOAD_EXTENSIONS.join(" and ")} files up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB.
          </span>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <section>
        <h2>My documents</h2>
        <DocList
          items={docs.owned}
          empty="You have not created any documents yet."
          renderMeta={() => <span className="badge owner">Owner</span>}
        />
      </section>

      <section>
        <h2>Shared with me</h2>
        <DocList
          items={docs.shared}
          empty="Nothing has been shared with you yet."
          renderMeta={(d) => (
            <span className={`badge ${(d as SharedDocumentSummary).role}`}>
              {ROLE_LABEL[(d as SharedDocumentSummary).role]}
            </span>
          )}
          showOwner
        />
      </section>
    </main>
  );
}

function DocList({
  items,
  empty,
  renderMeta,
  showOwner = false,
}: {
  items: DocumentSummary[];
  empty: string;
  renderMeta: (d: DocumentSummary) => ReactNode;
  showOwner?: boolean;
}) {
  if (items.length === 0) return <p className="muted">{empty}</p>;
  return (
    <ul className="doc-list">
      {items.map((d) => (
        <li key={d.id}>
          <Link href={`/docs/${d.id}`} className="doc-row">
            <span className="doc-title">{d.title}</span>
            <span className="doc-meta">
              {renderMeta(d)}
              {showOwner && <span className="muted">by {d.ownerName}</span>}
              <span className="muted">Updated {new Date(d.updatedAt).toLocaleString()}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

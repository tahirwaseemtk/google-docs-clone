"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { UserOption } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<{ users: UserOption[] }>("/api/users")
      .then((d) => setUsers(d.users))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function signIn(username: string) {
    setBusy(username);
    setError(null);
    try {
      await api("/api/session", { method: "POST", body: JSON.stringify({ username }) });
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <main className="login">
      <div className="login-card">
        <h1>Ajaia Docs</h1>
        <p className="muted">
          Sample sign-in. Pick a demo account. No password is needed for this assessment.
        </p>
        {error && <p className="error" role="alert">{error}</p>}
        <ul className="user-list">
          {users.map((u) => (
            <li key={u.username}>
              <button
                className="user-button"
                onClick={() => signIn(u.username)}
                disabled={busy !== null}
              >
                <span className="avatar">{u.displayName.charAt(0)}</span>
                <span>
                  <strong>{u.displayName}</strong>
                  <span className="muted"> @{u.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

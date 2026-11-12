// Types shared by server and client code. Keep this file free of server-only imports.

export type ShareRole = "editor" | "viewer";
export type AccessRole = "owner" | ShareRole;

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
}

export interface UserOption {
  username: string;
  displayName: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  ownerName: string;
  updatedAt: string;
}

export interface SharedDocumentSummary extends DocumentSummary {
  role: ShareRole;
}

export interface DocumentList {
  owned: DocumentSummary[];
  shared: SharedDocumentSummary[];
}

export interface ShareInfo {
  userId: string;
  username: string;
  displayName: string;
  role: ShareRole;
}

export interface DocumentDetail {
  id: string;
  title: string;
  contentHtml: string;
  ownerId: string;
  ownerName: string;
  role: AccessRole;
  createdAt: string;
  updatedAt: string;
  shares: ShareInfo[];
}

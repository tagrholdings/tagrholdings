"use client";

import * as React from "react";

export interface WorkspaceSummary {
  slug: string;
  name: string;
  /** The person's role there ("admin" for a super admin who isn't a member). */
  role: "admin" | "member";
}

export interface WorkspaceContextValue {
  slug: string;
  name: string;
  role: "admin" | "member";
  isSuperAdmin: boolean;
  /** This workspace's own leads-inbox address (null until INBOUND_EMAIL_DOMAIN is configured). */
  inboundAddress: string | null;
  /** Everything the person can switch to (all workspaces for a super admin). */
  workspaces: WorkspaceSummary[];
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

/**
 * The current workspace for everything under `app/(hub)/w/[workspace]` — set once by HubChrome, read by the header,
 * sidebar and switcher. A context (not props) because the header is rendered per page by HubPage, a Server Component
 * several levels away from the layout that knows the workspace.
 */
export function WorkspaceProvider({ value, children }: { value: WorkspaceContextValue; children: React.ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = React.useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace() must be used inside a workspace (app/(hub)/w/[workspace]).");
  return value;
}

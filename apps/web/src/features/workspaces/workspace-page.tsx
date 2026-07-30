import {
  type FolderSummary,
  type RequestSummary,
} from "@api-client/contracts";
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  FilePlus2,
  FolderClosed,
  FolderPlus,
  Plus,
  Save,
  Send,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { RequestEditor } from "../requests/request-editor";
import { InvitationDialog } from "../invitations/invitation-dialog";
import { TeamMembersDialog } from "../teams/team-members-dialog";
import { EnvironmentControls } from "../environments/environment-controls";
import { ExecutionHistoryDialog } from "../history/execution-history-dialog";
import { useEnvironments } from "../environments/environment-queries";
import { CollectionCreateForm } from "./collection-create-form";
import {
  FolderCreateForm,
  RequestCreateForm,
} from "./navigation-create-form";
import { WorkspaceCreateForm } from "./workspace-create-form";
import {
  useWorkspaces,
  useWorkspaceTree,
} from "./workspace-queries";

export function WorkspacePage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const navigate = useNavigate();
  const workspaces = useWorkspaces();
  const activeWorkspace =
    workspaces.data?.find(({ id }) => id === routeWorkspaceId) ??
    workspaces.data?.[0];
  const tree = useWorkspaceTree(activeWorkspace?.id);
  const environments = useEnvironments(activeWorkspace?.id);
  const canEdit =
    activeWorkspace?.role === "owner" || activeWorkspace?.role === "editor";
  const [activeRequestId, setActiveRequestId] = useState<string>();
  const [openRequestIds, setOpenRequestIds] = useState<string[]>([]);
  const [dirtyRequestIds, setDirtyRequestIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedCollectionIds, setCollapsedCollectionIds] =
    useState<Set<string>>(() => new Set());
  const [selectedEnvironmentId, setSelectedEnvironmentId] =
    useState<string>();
  const [inviting, setInviting] = useState(false);
  const [showingHistory, setShowingHistory] = useState(false);
  const [managingTeam, setManagingTeam] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [creatingChild, setCreatingChild] = useState<{
    collectionId: string;
    kind: "folder" | "request";
  }>();
  const initializedWorkspaceId = useRef<string | undefined>(undefined);

  useEffect(() => {
    setActiveRequestId(undefined);
    setOpenRequestIds([]);
    setDirtyRequestIds(new Set());
    setCollapsedCollectionIds(new Set());
    setSelectedEnvironmentId(undefined);
  }, [activeWorkspace?.id]);

  function selectRequest(requestId: string) {
    setOpenRequestIds((current) =>
      current.includes(requestId) ? current : [...current, requestId],
    );
    setActiveRequestId(requestId);
  }

  function closeRequest(requestId: string) {
    if (
      dirtyRequestIds.has(requestId) &&
      !window.confirm(
        "Dieser Request enthält ungespeicherte Änderungen. Möchtest du den Tab wirklich schließen?",
      )
    ) {
      return;
    }

    setDirtyRequestIds((current) => {
      if (!current.has(requestId)) return current;
      const next = new Set(current);
      next.delete(requestId);
      return next;
    });
    setOpenRequestIds((current) => {
      const closingIndex = current.indexOf(requestId);
      const next = current.filter((id) => id !== requestId);
      if (activeRequestId === requestId) {
        setActiveRequestId(
          next[Math.min(Math.max(closingIndex, 0), next.length - 1)],
        );
      }
      return next;
    });
  }

  function setRequestDirty(requestId: string, dirty: boolean) {
    setDirtyRequestIds((current) => {
      if (current.has(requestId) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(requestId);
      else next.delete(requestId);
      return next;
    });
  }

  useEffect(() => {
    if (
      activeWorkspace?.id &&
      initializedWorkspaceId.current !== activeWorkspace.id &&
      tree.data?.requests[0]
    ) {
      const firstRequestId = tree.data.requests[0].id;
      initializedWorkspaceId.current = activeWorkspace.id;
      setOpenRequestIds([firstRequestId]);
      setActiveRequestId(firstRequestId);
    }
  }, [activeWorkspace?.id, tree.data]);

  const activeRequest = tree.data?.requests.find(
    ({ id }) => id === activeRequestId,
  );
  const openRequests = openRequestIds.flatMap((requestId) => {
    const request = tree.data?.requests.find(({ id }) => id === requestId);
    return request ? [request] : [];
  });
  const hasDirtyRequests = dirtyRequestIds.size > 0;
  const requestsByCollection = useMemo(() => {
    const result = new Map<string, NonNullable<typeof tree.data>["requests"]>();
    for (const request of tree.data?.requests ?? []) {
      if (request.folderId) continue;
      const key = request.collectionId ?? "unassigned";
      result.set(key, [...(result.get(key) ?? []), request]);
    }
    return result;
  }, [tree.data]);
  const requestsByFolder = useMemo(() => {
    const result = new Map<string, RequestSummary[]>();
    for (const request of tree.data?.requests ?? []) {
      if (!request.folderId) continue;
      result.set(request.folderId, [
        ...(result.get(request.folderId) ?? []),
        request,
      ]);
    }
    return result;
  }, [tree.data]);
  const foldersByParent = useMemo(() => {
    const result = new Map<string, FolderSummary[]>();
    for (const folder of tree.data?.folders ?? []) {
      const key = folder.parentFolderId ?? `collection:${folder.collectionId}`;
      result.set(key, [...(result.get(key) ?? []), folder]);
    }
    return result;
  }, [tree.data]);

  if (workspaces.isPending) {
    return <main className="centered-state">Workspaces werden geladen …</main>;
  }
  if (workspaces.isError) {
    return (
      <main className="centered-state">
        <h1>Workspaces konnten nicht geladen werden</h1>
        <button className="button secondary" onClick={() => workspaces.refetch()}>
          Erneut versuchen
        </button>
      </main>
    );
  }
  if (!activeWorkspace) {
    return (
      <main className="centered-state">
        <h1>Noch kein Workspace</h1>
        <p>Erstelle als Nächstes den ersten gemeinsamen Team-Workspace.</p>
        <WorkspaceCreateForm />
      </main>
    );
  }

  return (
    <div className="workspace-layout">
      <aside className="sidebar" aria-label="Workspace-Navigation">
        <label className="workspace-select">
          <span className="workspace-select-control">
            <span className="eyebrow">Workspace</span>
            <span className="sr-only">Workspace auswählen</span>
            <select
              value={activeWorkspace.id}
              onChange={(event) => {
                if (
                  hasDirtyRequests &&
                  !window.confirm(
                    "In offenen Tabs gibt es ungespeicherte Änderungen. Möchtest du den Workspace wirklich wechseln?",
                  )
                ) {
                  event.target.value = activeWorkspace.id;
                  return;
                }
                navigate(`/workspaces/${event.target.value}`);
              }}
            >
              {workspaces.data?.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </span>
          <ChevronDown aria-hidden="true" size={16} />
        </label>

        <div className="sidebar-heading">
          <span>Collections</span>
          {canEdit ? (
            <button
              className="icon-button compact"
              onClick={() => setCreatingCollection(true)}
              type="button"
              aria-label="Collection erstellen"
            >
              <Plus aria-hidden="true" size={16} />
            </button>
          ) : null}
        </div>

        {creatingCollection ? (
          <CollectionCreateForm
            onClose={() => setCreatingCollection(false)}
            workspaceId={activeWorkspace.id}
          />
        ) : null}

        {tree.isPending ? (
          <p className="sidebar-state">Navigation wird geladen …</p>
        ) : tree.isError ? (
          <button
            className="sidebar-state retry-link"
            onClick={() => tree.refetch()}
          >
            Laden erneut versuchen
          </button>
        ) : (
          <nav className="collection-tree">
            {tree.data?.collections.map((collection) => (
              <div key={collection.id}>
                <div className="tree-row tree-parent">
                  <button
                    aria-expanded={!collapsedCollectionIds.has(collection.id)}
                    className="tree-toggle"
                    onClick={() =>
                      setCollapsedCollectionIds((current) => {
                        const next = new Set(current);
                        if (next.has(collection.id)) next.delete(collection.id);
                        else next.add(collection.id);
                        return next;
                      })
                    }
                    type="button"
                  >
                    {collapsedCollectionIds.has(collection.id) ? (
                      <ChevronRight aria-hidden="true" size={15} />
                    ) : (
                      <ChevronDown aria-hidden="true" size={15} />
                    )}
                    <FolderClosed aria-hidden="true" size={16} />
                    <span>{collection.name}</span>
                  </button>
                  {canEdit ? (
                    <span className="tree-actions">
                      <button
                        aria-label={`Request in ${collection.name} erstellen`}
                        className="icon-button compact"
                        onClick={(event) => {
                          event.stopPropagation();
                          setCreatingChild({
                            collectionId: collection.id,
                            kind: "request",
                          });
                        }}
                        type="button"
                      >
                        <FilePlus2 aria-hidden="true" size={14} />
                      </button>
                      <button
                        aria-label={`Ordner in ${collection.name} erstellen`}
                        className="icon-button compact"
                        onClick={(event) => {
                          event.stopPropagation();
                          setCreatingChild({
                            collectionId: collection.id,
                            kind: "folder",
                          });
                        }}
                        type="button"
                      >
                        <FolderPlus aria-hidden="true" size={14} />
                      </button>
                    </span>
                  ) : null}
                </div>
                <div
                  className="tree-children"
                  hidden={collapsedCollectionIds.has(collection.id)}
                >
                  {creatingChild?.collectionId === collection.id &&
                  creatingChild.kind === "folder" ? (
                    <FolderCreateForm
                      collectionId={collection.id}
                      onClose={() => setCreatingChild(undefined)}
                      workspaceId={activeWorkspace.id}
                    />
                  ) : null}
                  {creatingChild?.collectionId === collection.id &&
                  creatingChild.kind === "request" ? (
                    <RequestCreateForm
                      collectionId={collection.id}
                      onClose={() => setCreatingChild(undefined)}
                      onCreated={selectRequest}
                      workspaceId={activeWorkspace.id}
                    />
                  ) : null}
                  {(foldersByParent.get(`collection:${collection.id}`) ?? []).map(
                    (folder) => (
                      <FolderTreeNode
                        activeRequestId={activeRequestId}
                        folder={folder}
                        foldersByParent={foldersByParent}
                        key={folder.id}
                        onSelectRequest={selectRequest}
                        requestsByFolder={requestsByFolder}
                      />
                    ),
                  )}
                  {(requestsByCollection.get(collection.id) ?? []).map(
                    (request) => (
                      <RequestTreeRow
                        active={activeRequestId === request.id}
                        key={request.id}
                        method={request.method}
                        name={request.name}
                        onClick={() => selectRequest(request.id)}
                      />
                    ),
                  )}
                </div>
              </div>
            ))}
            {(requestsByCollection.get("unassigned") ?? []).map((request) => (
              <RequestTreeRow
                active={activeRequestId === request.id}
                key={request.id}
                method={request.method}
                name={request.name}
                onClick={() => selectRequest(request.id)}
              />
            ))}
            {tree.data?.requests.length === 0 ? (
              <p className="sidebar-state">Noch keine Requests vorhanden.</p>
            ) : null}
          </nav>
        )}

        <button
          className="history-link"
          onClick={() => setShowingHistory(true)}
          type="button"
        >
          <Clock3 aria-hidden="true" size={16} />
          Verlauf
        </button>
      </aside>

      <section className="request-workbench">
        {activeRequest ? (
          <>
            <div
              aria-label="Geöffnete Requests"
              className="request-tabs"
              role="tablist"
            >
              {openRequests.map((request) => (
                <div
                  className={`request-tab ${
                    request.id === activeRequestId ? "active" : ""
                  }`}
                  key={request.id}
                >
                  <button
                    aria-selected={request.id === activeRequestId}
                    className="request-tab-select"
                    onClick={() => setActiveRequestId(request.id)}
                    role="tab"
                    type="button"
                  >
                    <span
                      className={`method method-${request.method.toLowerCase()}`}
                    >
                      {request.method}
                    </span>
                    <span>{request.name}</span>
                    {dirtyRequestIds.has(request.id) ? (
                      <span
                        aria-label="Ungespeicherte Änderungen"
                        className="dirty-indicator"
                      />
                    ) : null}
                  </button>
                  <button
                    aria-label={`${request.name} schließen`}
                    className="request-tab-close"
                    onClick={() => closeRequest(request.id)}
                    type="button"
                  >
                    <X aria-hidden="true" size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="request-toolbar">
              <div>
                <span className="breadcrumb">{activeWorkspace.name} /</span>
                <h1>{activeRequest.name}</h1>
              </div>
              <div className="toolbar-actions">
                {activeWorkspace.role === "owner" ? (
                  <>
                    <button
                      className="button secondary"
                      onClick={() => setManagingTeam(true)}
                      type="button"
                    >
                      <Users aria-hidden="true" size={16} />
                      Team
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setInviting(true)}
                      type="button"
                    >
                      <UserPlus aria-hidden="true" size={16} />
                      Einladen
                    </button>
                  </>
                ) : null}
                <EnvironmentControls
                  canEditShared={canEdit}
                  onSelect={setSelectedEnvironmentId}
                  selectedId={selectedEnvironmentId}
                  workspaceId={activeWorkspace.id}
                />
                {canEdit ? (
                  <button
                    className="button secondary"
                    form={`request-form-${activeRequest.id}`}
                    name="intent"
                    type="submit"
                    value="save"
                  >
                    <Save aria-hidden="true" size={16} />
                    Speichern
                  </button>
                ) : null}
                <button
                  className="button primary"
                  form={`request-form-${activeRequest.id}`}
                  name="intent"
                  type="submit"
                  value="execute"
                >
                  <Send aria-hidden="true" size={16} />
                  Senden
                </button>
              </div>
            </div>
            {openRequests.map((request) => (
              <div hidden={request.id !== activeRequestId} key={request.id}>
                <RequestEditor
                  formId={`request-form-${request.id}`}
                  requestId={request.id}
                  workspaceId={activeWorkspace.id}
                  onDirtyChange={(dirty) =>
                    setRequestDirty(request.id, dirty)
                  }
                  readOnly={!canEdit}
                  variables={
                    environments.data?.find(
                      ({ id }) => id === selectedEnvironmentId,
                    )?.variables ?? []
                  }
                />
              </div>
            ))}
          </>
        ) : (
          <div className="centered-state workbench-empty">
            <h1>Kein Request ausgewählt</h1>
            <p>Wähle einen Request oder erstelle einen neuen.</p>
            {activeWorkspace.role === "owner" ? (
              <div className="empty-actions">
                <button
                  className="button secondary"
                  onClick={() => setManagingTeam(true)}
                  type="button"
                >
                  <Users aria-hidden="true" size={16} />
                  Team verwalten
                </button>
                <button
                  className="button secondary"
                  onClick={() => setInviting(true)}
                  type="button"
                >
                  <UserPlus aria-hidden="true" size={16} />
                  Mitglied einladen
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>
      {inviting ? (
        <InvitationDialog
          onClose={() => setInviting(false)}
          teamId={activeWorkspace.teamId}
        />
      ) : null}
      {managingTeam ? (
        <TeamMembersDialog
          onClose={() => setManagingTeam(false)}
          teamId={activeWorkspace.teamId}
        />
      ) : null}
      {showingHistory ? (
        <ExecutionHistoryDialog
          onClose={() => setShowingHistory(false)}
          workspaceId={activeWorkspace.id}
        />
      ) : null}
    </div>
  );
}

interface FolderTreeNodeProps {
  activeRequestId: string | undefined;
  folder: FolderSummary;
  foldersByParent: Map<string, FolderSummary[]>;
  requestsByFolder: Map<string, RequestSummary[]>;
  onSelectRequest: (requestId: string) => void;
}

function FolderTreeNode({
  activeRequestId,
  folder,
  foldersByParent,
  requestsByFolder,
  onSelectRequest,
}: FolderTreeNodeProps) {
  return (
    <div>
      <div className="tree-row nested-folder">
        <FolderClosed aria-hidden="true" size={14} />
        <span>{folder.name}</span>
      </div>
      <div className="tree-children">
        {(foldersByParent.get(folder.id) ?? []).map((child) => (
          <FolderTreeNode
            activeRequestId={activeRequestId}
            folder={child}
            foldersByParent={foldersByParent}
            key={child.id}
            onSelectRequest={onSelectRequest}
            requestsByFolder={requestsByFolder}
          />
        ))}
        {(requestsByFolder.get(folder.id) ?? []).map((request) => (
          <RequestTreeRow
            active={activeRequestId === request.id}
            key={request.id}
            method={request.method}
            name={request.name}
            onClick={() => onSelectRequest(request.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface RequestTreeRowProps {
  active: boolean;
  method: string;
  name: string;
  onClick: () => void;
}

function RequestTreeRow({
  active,
  method,
  name,
  onClick,
}: RequestTreeRowProps) {
  return (
    <button
      className={`tree-row request-row ${active ? "active" : ""}`}
      onClick={onClick}
      type="button"
    >
      <span className={`method method-${method.toLowerCase()}`}>{method}</span>
      <span>{name}</span>
    </button>
  );
}

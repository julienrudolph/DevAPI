import {
  type FolderSummary,
  type RequestSummary,
} from "@api-client/contracts";
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  FilePlus2,
  FolderClosed,
  FolderInput,
  FolderPlus,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Send,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { RequestEditor } from "../requests/request-editor";
import {
  useDuplicateRequest,
  useMoveRequest,
} from "../requests/request-queries";
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

interface PersistedTabs {
  activeRequestId?: string;
  openRequestIds: string[];
}

function tabStorageKey(workspaceId: string): string {
  return `devapi:workspace-tabs:${workspaceId}`;
}

function readPersistedTabs(
  workspaceId: string,
  availableRequestIds: Set<string>,
): PersistedTabs | undefined {
  try {
    const stored = localStorage.getItem(tabStorageKey(workspaceId));
    if (stored === null) return undefined;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return undefined;
    const candidate = parsed as Record<string, unknown>;
    if (!Array.isArray(candidate.openRequestIds)) return undefined;
    const openRequestIds = Array.isArray(candidate.openRequestIds)
      ? candidate.openRequestIds.filter(
          (id): id is string =>
            typeof id === "string" && availableRequestIds.has(id),
        )
      : [];
    const activeRequestId =
      typeof candidate.activeRequestId === "string" &&
      openRequestIds.includes(candidate.activeRequestId)
        ? candidate.activeRequestId
        : openRequestIds[0];
    return { activeRequestId, openRequestIds: [...new Set(openRequestIds)] };
  } catch {
    return undefined;
  }
}

export function reorderRequestIds(
  requestIds: string[],
  draggedId: string,
  targetId: string,
): string[] {
  if (draggedId === targetId) return requestIds;
  const draggedIndex = requestIds.indexOf(draggedId);
  const targetIndex = requestIds.indexOf(targetId);
  if (draggedIndex < 0 || targetIndex < 0) return requestIds;
  const next = [...requestIds];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged!);
  return next;
}

export function WorkspacePage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const navigate = useNavigate();
  const workspaces = useWorkspaces();
  const activeWorkspace =
    workspaces.data?.find(({ id }) => id === routeWorkspaceId) ??
    workspaces.data?.[0];
  const tree = useWorkspaceTree(activeWorkspace?.id);
  const environments = useEnvironments(activeWorkspace?.id);
  const duplicateRequest = useDuplicateRequest(activeWorkspace?.id ?? "");
  const moveRequest = useMoveRequest(activeWorkspace?.id ?? "");
  const canEdit =
    activeWorkspace?.role === "owner" || activeWorkspace?.role === "editor";
  const [activeRequestId, setActiveRequestId] = useState<string>();
  const [openRequestIds, setOpenRequestIds] = useState<string[]>([]);
  const [dirtyRequestIds, setDirtyRequestIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedCollectionIds, setCollapsedCollectionIds] =
    useState<Set<string>>(() => new Set());
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [restoredWorkspaceId, setRestoredWorkspaceId] = useState<string>();
  const [selectedEnvironmentId, setSelectedEnvironmentId] =
    useState<string>();
  const [inviting, setInviting] = useState(false);
  const [showingHistory, setShowingHistory] = useState(false);
  const [managingTeam, setManagingTeam] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [movingRequest, setMovingRequest] = useState(false);
  const [destinationCollectionId, setDestinationCollectionId] =
    useState<string>();
  const [destinationFolderId, setDestinationFolderId] = useState<string>("");
  const [managementError, setManagementError] = useState<string>();
  const [creatingChild, setCreatingChild] = useState<{
    collectionId: string;
    kind: "folder" | "request";
  }>();
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setActiveRequestId(undefined);
    setOpenRequestIds([]);
    setDirtyRequestIds(new Set());
    setCollapsedCollectionIds(new Set());
    setCollapsedFolderIds(new Set());
    setRestoredWorkspaceId(undefined);
    setSelectedEnvironmentId(undefined);
    setSearchQuery("");
    setMovingRequest(false);
    setDestinationCollectionId(undefined);
    setDestinationFolderId("");
    setManagementError(undefined);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === "p" &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function selectRequest(requestId: string) {
    setOpenRequestIds((current) =>
      current.includes(requestId) ? current : [...current, requestId],
    );
    setActiveRequestId(requestId);
  }

  function closeRequest(requestId: string) {
    closeRequests(
      [requestId],
      "Dieser Request enthält ungespeicherte Änderungen. Möchtest du den Tab wirklich schließen?",
    );
  }

  function closeRequests(requestIds: string[], dirtyConfirmation: string) {
    const closingIds = new Set(requestIds);
    const closesDirtyRequest = requestIds.some((id) =>
      dirtyRequestIds.has(id),
    );
    if (closesDirtyRequest && !window.confirm(dirtyConfirmation)) return;
    setDirtyRequestIds((current) => {
      if (![...closingIds].some((id) => current.has(id))) return current;
      const next = new Set(current);
      for (const id of closingIds) next.delete(id);
      return next;
    });
    setOpenRequestIds((current) => {
      const next = current.filter((id) => !closingIds.has(id));
      if (activeRequestId && closingIds.has(activeRequestId)) {
        setActiveRequestId(next.at(-1));
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
      restoredWorkspaceId !== activeWorkspace.id &&
      tree.data
    ) {
      const availableIds = new Set(
        tree.data.requests.map((request) => request.id),
      );
      const persisted = readPersistedTabs(activeWorkspace.id, availableIds);
      const initialIds =
        persisted
          ? persisted.openRequestIds
          : tree.data.requests[0]
            ? [tree.data.requests[0].id]
            : [];
      setOpenRequestIds(initialIds);
      setActiveRequestId(persisted?.activeRequestId ?? initialIds[0]);
      setRestoredWorkspaceId(activeWorkspace.id);
    }
  }, [activeWorkspace?.id, restoredWorkspaceId, tree.data]);

  useEffect(() => {
    if (
      activeWorkspace?.id &&
      restoredWorkspaceId === activeWorkspace.id
    ) {
      localStorage.setItem(
        tabStorageKey(activeWorkspace.id),
        JSON.stringify({ activeRequestId, openRequestIds }),
      );
    }
  }, [
    activeRequestId,
    activeWorkspace?.id,
    openRequestIds,
    restoredWorkspaceId,
  ]);

  const activeRequest = tree.data?.requests.find(
    ({ id }) => id === activeRequestId,
  );
  const openRequests = openRequestIds.flatMap((requestId) => {
    const request = tree.data?.requests.find(({ id }) => id === requestId);
    return request ? [request] : [];
  });
  const hasDirtyRequests = dirtyRequestIds.size > 0;
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const matchingRequests = useMemo(
    () =>
      normalizedSearch
        ? (tree.data?.requests ?? []).filter((request) =>
            [request.name, request.method, request.url].some((value) =>
              value.toLocaleLowerCase().includes(normalizedSearch),
            ),
          )
        : [],
    [normalizedSearch, tree.data?.requests],
  );
  const matchingCollections = useMemo(
    () =>
      normalizedSearch
        ? (tree.data?.collections ?? []).filter((collection) =>
            collection.name.toLocaleLowerCase().includes(normalizedSearch),
          )
        : [],
    [normalizedSearch, tree.data?.collections],
  );
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

        <label className="workspace-search">
          <Search aria-hidden="true" size={14} />
          <span className="sr-only">Workspace durchsuchen</span>
          <input
            aria-label="Workspace durchsuchen"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Requests durchsuchen"
            ref={searchInputRef}
            type="search"
            value={searchQuery}
          />
          <kbd>⌘/Ctrl P</kbd>
        </label>

        {tree.isPending ? (
          <p className="sidebar-state">Navigation wird geladen …</p>
        ) : tree.isError ? (
          <button
            className="sidebar-state retry-link"
            onClick={() => tree.refetch()}
          >
            Laden erneut versuchen
          </button>
        ) : normalizedSearch ? (
          <div className="workspace-search-results">
            {matchingCollections.map((collection) => (
              <button
                key={collection.id}
                onClick={() => {
                  setCollapsedCollectionIds((current) => {
                    const next = new Set(current);
                    next.delete(collection.id);
                    return next;
                  });
                  setSearchQuery("");
                }}
                type="button"
              >
                <FolderClosed aria-hidden="true" size={14} />
                <span>
                  <strong>{collection.name}</strong>
                  <small>Collection</small>
                </span>
              </button>
            ))}
            {matchingRequests.map((request) => (
              <button
                key={request.id}
                onClick={() => {
                  selectRequest(request.id);
                  setSearchQuery("");
                }}
                type="button"
              >
                <span
                  className={`method method-${request.method.toLowerCase()}`}
                >
                  {request.method}
                </span>
                <span>
                  <strong>{request.name}</strong>
                  <small>{request.url}</small>
                </span>
              </button>
            ))}
            {matchingCollections.length === 0 &&
            matchingRequests.length === 0 ? (
              <p className="sidebar-state">Keine Treffer gefunden.</p>
            ) : null}
          </div>
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
                        collapsedFolderIds={collapsedFolderIds}
                        folder={folder}
                        foldersByParent={foldersByParent}
                        key={folder.id}
                        onToggleFolder={(folderId) =>
                          setCollapsedFolderIds((current) => {
                            const next = new Set(current);
                            if (next.has(folderId)) next.delete(folderId);
                            else next.add(folderId);
                            return next;
                          })
                        }
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
            <div className="request-tabs-bar">
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
                    draggable
                    key={request.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", request.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const draggedId =
                        event.dataTransfer.getData("text/plain");
                      setOpenRequestIds((current) =>
                        reorderRequestIds(current, draggedId, request.id),
                      );
                    }}
                  >
                    <button
                      aria-selected={request.id === activeRequestId}
                      className="request-tab-select"
                      onClick={() => setActiveRequestId(request.id)}
                      onKeyDown={(event) => {
                        if (!event.altKey) return;
                        const currentIndex = openRequestIds.indexOf(request.id);
                        const targetIndex =
                          event.key === "ArrowLeft"
                            ? currentIndex - 1
                            : event.key === "ArrowRight"
                              ? currentIndex + 1
                              : currentIndex;
                        const targetId = openRequestIds[targetIndex];
                        if (!targetId || targetId === request.id) return;
                        event.preventDefault();
                        setOpenRequestIds((current) =>
                          reorderRequestIds(current, request.id, targetId),
                        );
                      }}
                      role="tab"
                      title="Zum Sortieren ziehen oder Alt + Pfeiltaste verwenden"
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
              <details className="request-tab-menu">
                <summary aria-label="Tab-Aktionen">
                  <MoreHorizontal aria-hidden="true" size={16} />
                </summary>
                <div className="request-tab-menu-popover">
                  <button
                    disabled={openRequestIds.length <= 1}
                    onClick={() =>
                      closeRequests(
                        openRequestIds.filter(
                          (requestId) => requestId !== activeRequestId,
                        ),
                        "Andere Tabs enthalten ungespeicherte Änderungen. Möchtest du sie wirklich schließen?",
                      )
                    }
                    type="button"
                  >
                    Andere Tabs schließen
                  </button>
                  <button
                    onClick={() =>
                      closeRequests(
                        openRequestIds,
                        "Offene Tabs enthalten ungespeicherte Änderungen. Möchtest du wirklich alle schließen?",
                      )
                    }
                    type="button"
                  >
                    Alle Tabs schließen
                  </button>
                </div>
              </details>
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
                {canEdit && activeRequest.collectionId ? (
                  <>
                    <button
                      className="button secondary"
                      disabled={duplicateRequest.isPending}
                      onClick={() => {
                        setManagementError(undefined);
                        void duplicateRequest
                          .mutateAsync({
                            requestId: activeRequest.id,
                            collectionId: activeRequest.collectionId!,
                            folderId: activeRequest.folderId,
                          })
                          .then((duplicated) => selectRequest(duplicated.id))
                          .catch(() =>
                            setManagementError(
                              "Der Request konnte nicht dupliziert werden.",
                            ),
                          );
                      }}
                      title="Dupliziert die zuletzt gespeicherte Version"
                      type="button"
                    >
                      <Copy aria-hidden="true" size={16} />
                      Duplizieren
                    </button>
                    <button
                      className="button secondary"
                      disabled={dirtyRequestIds.has(activeRequest.id)}
                      onClick={() => {
                        setDestinationCollectionId(activeRequest.collectionId!);
                        setDestinationFolderId(activeRequest.folderId ?? "");
                        setManagementError(undefined);
                        setMovingRequest(true);
                      }}
                      title={
                        dirtyRequestIds.has(activeRequest.id)
                          ? "Speichere den Request vor dem Verschieben"
                          : undefined
                      }
                      type="button"
                    >
                      <FolderInput aria-hidden="true" size={16} />
                      Verschieben
                    </button>
                  </>
                ) : null}
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
      {movingRequest && activeRequest ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="move-request-title"
            aria-modal="true"
            className="conflict-dialog"
            role="dialog"
          >
            <h2 id="move-request-title">Request verschieben</h2>
            <p>
              Wähle die neue Collection und optional einen zugehörigen Ordner.
            </p>
            <div className="move-request-fields">
              <label>
                Collection
                <select
                  onChange={(event) => {
                    setDestinationCollectionId(event.target.value);
                    setDestinationFolderId("");
                  }}
                  value={destinationCollectionId}
                >
                  {tree.data?.collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ordner
                <select
                  onChange={(event) =>
                    setDestinationFolderId(event.target.value)
                  }
                  value={destinationFolderId}
                >
                  <option value="">Kein Ordner</option>
                  {tree.data?.folders
                    .filter(
                      (folder) =>
                        folder.collectionId === destinationCollectionId,
                    )
                    .map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {managementError ? (
              <p className="field-error" role="alert">
                {managementError}
              </p>
            ) : null}
            <div className="dialog-actions">
              <button
                className="button secondary"
                onClick={() => setMovingRequest(false)}
                type="button"
              >
                Abbrechen
              </button>
              <button
                className="button primary"
                disabled={!destinationCollectionId || moveRequest.isPending}
                onClick={() => {
                  if (!destinationCollectionId) return;
                  setManagementError(undefined);
                  void moveRequest
                    .mutateAsync({
                      requestId: activeRequest.id,
                      collectionId: destinationCollectionId,
                      folderId: destinationFolderId || null,
                    })
                    .then(() => setMovingRequest(false))
                    .catch(() =>
                      setManagementError(
                        "Der Request konnte nicht verschoben werden. Lade bei einem Konflikt die aktuelle Version.",
                      ),
                    );
                }}
                type="button"
              >
                Verschieben
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

interface FolderTreeNodeProps {
  activeRequestId: string | undefined;
  collapsedFolderIds: Set<string>;
  folder: FolderSummary;
  foldersByParent: Map<string, FolderSummary[]>;
  requestsByFolder: Map<string, RequestSummary[]>;
  onSelectRequest: (requestId: string) => void;
  onToggleFolder: (folderId: string) => void;
}

function FolderTreeNode({
  activeRequestId,
  collapsedFolderIds,
  folder,
  foldersByParent,
  requestsByFolder,
  onSelectRequest,
  onToggleFolder,
}: FolderTreeNodeProps) {
  const collapsed = collapsedFolderIds.has(folder.id);
  return (
    <div>
      <div className="tree-row nested-folder">
        <button
          aria-expanded={!collapsed}
          className="tree-toggle"
          onClick={() => onToggleFolder(folder.id)}
          type="button"
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" size={14} />
          ) : (
            <ChevronDown aria-hidden="true" size={14} />
          )}
          <FolderClosed aria-hidden="true" size={14} />
          <span>{folder.name}</span>
        </button>
      </div>
      <div className="tree-children" hidden={collapsed}>
        {(foldersByParent.get(folder.id) ?? []).map((child) => (
          <FolderTreeNode
            activeRequestId={activeRequestId}
            collapsedFolderIds={collapsedFolderIds}
            folder={child}
            foldersByParent={foldersByParent}
            key={child.id}
            onSelectRequest={onSelectRequest}
            onToggleFolder={onToggleFolder}
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

import {
  type FolderSummary,
  type RequestSummary,
} from "@api-client/contracts";
import {
  Dropdown,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowDownload20Regular,
  ArrowUpload20Regular,
  Copy20Regular,
  Delete20Regular,
  Dismiss20Regular,
  History20Regular,
  MoreHorizontal20Regular,
  Navigation20Regular,
  People20Regular,
  PeopleAdd20Regular,
  Save20Regular,
  Send20Regular,
} from "@fluentui/react-icons";
import {
  ChevronDown,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  FilePlus2,
  FolderClosed,
  FolderInput,
  FolderPlus,
  Pencil,
  Search,
} from "lucide-react";
import {
  Children,
  isValidElement,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router";

import {
  Button,
  Dialog,
  DialogFooter,
  IconButton,
  Select,
} from "../../components/ui";
import { RequestEditor } from "../requests/request-editor";
import { RequestConflictError } from "../requests/request-api";
import {
  useDeleteRequest,
  useDuplicateRequest,
  useMoveRequest,
} from "../requests/request-queries";
import { InvitationDialog } from "../invitations/invitation-dialog";
import { TeamMembersDialog } from "../teams/team-members-dialog";
import { EnvironmentControls } from "../environments/environment-controls";
import { ExecutionHistoryDialog } from "../history/execution-history-dialog";
import { OpenApiImportDialog } from "../import/openapi-import-dialog";
import { useEnvironments } from "../environments/environment-queries";
import { CollectionCreateForm } from "./collection-create-form";
import {
  FolderCreateForm,
  RequestCreateForm,
} from "./navigation-create-form";
import { WorkspaceCreateForm } from "./workspace-create-form";
import { NavigationMutationError } from "./workspace-api";
import {
  useDeleteCollection,
  useDeleteFolder,
  useExportWorkspace,
  useUpdateCollection,
  useUpdateFolder,
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

type DraggedNavigationItem =
  | { kind: "folder"; item: FolderSummary }
  | { kind: "request"; item: RequestSummary };

function TreeActionMenu({
  children,
  className = "tree-menu",
  label,
  triggerClassName = "tree-menu-trigger",
}: {
  children: ReactNode;
  className?: string;
  label: string;
  triggerClassName?: string;
}) {
  return (
    <div className={className}>
      <Menu positioning="below-end">
        <MenuTrigger disableButtonEnhancement>
          <IconButton
            aria-label={label}
            className={triggerClassName}
            size="compact"
          >
            <MoreHorizontal20Regular aria-hidden="true" />
          </IconButton>
        </MenuTrigger>
        <MenuPopover className="tree-menu-popover">
          <MenuList>
          {Children.map(children, (child) => {
            if (
              !isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(child)
            ) {
              return child;
            }
            const onClick = child.props.onClick;
            return (
              <MenuItem
                aria-label={child.props["aria-label"]}
                className={
                  child.props.className === "danger"
                    ? "relay-danger"
                    : undefined
                }
                disabled={child.props.disabled}
                onClick={(event) =>
                  onClick?.(
                    event as unknown as MouseEvent<HTMLButtonElement>,
                  )
                }
                title={child.props.title}
              >
                {child.props.children}
              </MenuItem>
            );
          })}
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
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
  const deleteRequest = useDeleteRequest(activeWorkspace?.id ?? "");
  const deleteCollection = useDeleteCollection(activeWorkspace?.id ?? "");
  const deleteFolder = useDeleteFolder(activeWorkspace?.id ?? "");
  const updateCollection = useUpdateCollection(activeWorkspace?.id ?? "");
  const updateFolder = useUpdateFolder(activeWorkspace?.id ?? "");
  const exportWorkspace = useExportWorkspace();
  const canEdit =
    activeWorkspace?.role === "owner" || activeWorkspace?.role === "editor";
  const [activeRequestId, setActiveRequestId] = useState<string>();
  const [compactNavigation, setCompactNavigation] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarCloseRef = useRef<HTMLButtonElement>(null);
  const sidebarTriggerRef = useRef<HTMLButtonElement>(null);
  const [openRequestIds, setOpenRequestIds] = useState<string[]>([]);
  const [dirtyRequestIds, setDirtyRequestIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedCollectionIds, setCollapsedCollectionIds] =
    useState<Set<string>>(() => new Set());
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 850px)");
    const update = () => {
      setCompactNavigation(media.matches);
      if (!media.matches) setSidebarOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    sidebarCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSidebar();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);
  const [restoredWorkspaceId, setRestoredWorkspaceId] = useState<string>();
  const [selectedEnvironmentId, setSelectedEnvironmentId] =
    useState<string>();
  const [inviting, setInviting] = useState(false);
  const [showingHistory, setShowingHistory] = useState(false);
  const [showingOpenApiImport, setShowingOpenApiImport] = useState(false);
  const [managingTeam, setManagingTeam] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [movingRequest, setMovingRequest] = useState(false);
  const [destinationCollectionId, setDestinationCollectionId] =
    useState<string>();
  const [destinationFolderId, setDestinationFolderId] = useState<string>("");
  const [managementError, setManagementError] = useState<string>();
  const [draggedNavigationItem, setDraggedNavigationItem] =
    useState<DraggedNavigationItem>();
  const [dropTarget, setDropTarget] = useState<string>();
  const [creatingChild, setCreatingChild] = useState<{
    collectionId: string;
    parentFolderId: string | null;
    kind: "folder" | "request";
  }>();
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (
      activeWorkspace &&
      routeWorkspaceId !== activeWorkspace.id
    ) {
      navigate(`/workspaces/${activeWorkspace.id}`, { replace: true });
    }
  }, [activeWorkspace, navigate, routeWorkspaceId]);

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
    setDraggedNavigationItem(undefined);
    setDropTarget(undefined);
    setCreatingWorkspace(false);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "p") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (!activeRequestId) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (key === "w") {
        event.preventDefault();
        closeRequest(activeRequestId);
        return;
      }
      const intent =
        key === "s" && canEdit
          ? "save"
          : event.key === "Enter"
            ? "execute"
            : undefined;
      if (!intent) return;
      event.preventDefault();
      document
        .querySelector<HTMLButtonElement>(
          `button[form="request-form-${activeRequestId}"][value="${intent}"]`,
        )
        ?.click();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeRequestId, canEdit, dirtyRequestIds]);

  function selectRequest(requestId: string) {
    setOpenRequestIds((current) =>
      current.includes(requestId) ? current : [...current, requestId],
    );
    setActiveRequestId(requestId);
    setSidebarOpen(false);
  }

  function closeSidebar() {
    setSidebarOpen(false);
    sidebarTriggerRef.current?.focus();
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

  function removeDeletedRequest(requestId: string) {
    setDirtyRequestIds((current) => {
      const next = new Set(current);
      next.delete(requestId);
      return next;
    });
    setOpenRequestIds((current) => {
      const next = current.filter((id) => id !== requestId);
      setActiveRequestId((active) =>
        active === requestId ? next.at(-1) : active,
      );
      return next;
    });
  }

  function navigationDeleteMessage(
    error: unknown,
    item: "Collection" | "Ordner",
    action: "gelöscht" | "bearbeitet" = "gelöscht",
  ): string {
    if (error instanceof NavigationMutationError) {
      if (error.code.endsWith("_NOT_EMPTY")) {
        return item === "Collection"
          ? "Die Collection enthält noch Requests oder Ordner. Verschiebe oder lösche diese zuerst."
          : "Der Ordner enthält noch Requests oder Unterordner. Verschiebe oder lösche diese zuerst.";
      }
      if (error.code.endsWith("_VERSION_CONFLICT")) {
        return `${item} wurde zwischenzeitlich geändert. Lade den Workspace neu und versuche es erneut.`;
      }
      if (error.code === "FORBIDDEN") {
        return `Du darfst diesen ${item} nicht ${action === "gelöscht" ? "löschen" : "bearbeiten"}.`;
      }
    }
    return `${item} konnte nicht ${action} werden.`;
  }

  function removeCollection(collection: {
    id: string;
    name: string;
    version: number;
  }) {
    if (
      !window.confirm(
        `Leere Collection „${collection.name}“ löschen? Enthaltene Requests oder Ordner werden nicht automatisch gelöscht.`,
      )
    ) {
      return;
    }
    setManagementError(undefined);
    void deleteCollection
      .mutateAsync({
        collectionId: collection.id,
        expectedVersion: collection.version,
      })
      .catch((error: unknown) =>
        setManagementError(navigationDeleteMessage(error, "Collection")),
      );
  }

  function removeFolder(folder: FolderSummary) {
    if (
      !window.confirm(
        `Leeren Ordner „${folder.name}“ löschen? Enthaltene Requests oder Unterordner werden nicht automatisch gelöscht.`,
      )
    ) {
      return;
    }
    setManagementError(undefined);
    void deleteFolder
      .mutateAsync({
        folderId: folder.id,
        expectedVersion: folder.version,
      })
      .catch((error: unknown) =>
        setManagementError(navigationDeleteMessage(error, "Ordner")),
      );
  }

  function updateCollectionItem(
    collection: { id: string; name: string; version: number },
    change: { name?: string; targetPosition?: number },
  ) {
    setManagementError(undefined);
    void updateCollection
      .mutateAsync({
        collectionId: collection.id,
        expectedVersion: collection.version,
        ...change,
      })
      .catch((error: unknown) =>
        setManagementError(
          navigationDeleteMessage(error, "Collection", "bearbeitet"),
        ),
      );
  }

  function updateFolderItem(
    folder: FolderSummary,
    change: {
      name?: string;
      targetPosition?: number;
      destination?: {
        collectionId: string;
        parentFolderId: string | null;
      };
    },
  ) {
    setManagementError(undefined);
    void updateFolder
      .mutateAsync({
        folderId: folder.id,
        expectedVersion: folder.version,
        ...change,
      })
      .catch((error: unknown) =>
        setManagementError(
          navigationDeleteMessage(error, "Ordner", "bearbeitet"),
        ),
      );
  }

  function duplicateNavigationRequest(request: RequestSummary) {
    if (!request.collectionId) return;
    setManagementError(undefined);
    void duplicateRequest
      .mutateAsync({
        requestId: request.id,
        collectionId: request.collectionId,
        folderId: request.folderId,
      })
      .then((duplicated) => selectRequest(duplicated.id))
      .catch(() =>
        setManagementError("Der Request konnte nicht dupliziert werden."),
      );
  }

  function startMovingRequest(request: RequestSummary) {
    if (!request.collectionId || dirtyRequestIds.has(request.id)) return;
    selectRequest(request.id);
    setDestinationCollectionId(request.collectionId);
    setDestinationFolderId(request.folderId ?? "");
    setManagementError(undefined);
    setMovingRequest(true);
  }

  function removeRequestItem(request: RequestSummary) {
    const dirtyWarning = dirtyRequestIds.has(request.id)
      ? " Ungespeicherte Änderungen gehen ebenfalls verloren."
      : "";
    if (
      !window.confirm(
        `Request „${request.name}“ löschen?${dirtyWarning} Die gespeicherte Fassung bleibt intern als Revision erhalten.`,
      )
    ) {
      return;
    }
    setManagementError(undefined);
    void deleteRequest
      .mutateAsync({
        requestId: request.id,
        expectedVersion: request.version,
      })
      .then(() => removeDeletedRequest(request.id))
      .catch((error: unknown) => {
        setManagementError(
          error instanceof RequestConflictError
            ? "Der Request wurde zwischenzeitlich geändert. Lade den aktuellen Stand und versuche das Löschen erneut."
            : "Der Request konnte nicht gelöscht werden.",
        );
      });
  }

  function canDropNavigationItem(
    collectionId: string,
    parentFolderId: string | null,
  ) {
    if (!draggedNavigationItem) return false;
    if (draggedNavigationItem.kind === "request") {
      return !dirtyRequestIds.has(draggedNavigationItem.item.id);
    }
    if (parentFolderId === draggedNavigationItem.item.id) return false;
    let currentParentId = parentFolderId;
    while (currentParentId) {
      if (currentParentId === draggedNavigationItem.item.id) return false;
      currentParentId =
        tree.data?.folders.find(({ id }) => id === currentParentId)
          ?.parentFolderId ?? null;
    }
    return !(
      draggedNavigationItem.item.collectionId === collectionId &&
      draggedNavigationItem.item.parentFolderId === parentFolderId
    );
  }

  function dropNavigationItem(
    collectionId: string,
    parentFolderId: string | null,
  ) {
    const dragged = draggedNavigationItem;
    const allowed = canDropNavigationItem(collectionId, parentFolderId);
    setDropTarget(undefined);
    setDraggedNavigationItem(undefined);
    if (!dragged || !allowed) return;
    setManagementError(undefined);
    if (dragged.kind === "request") {
      void moveRequest
        .mutateAsync({
          requestId: dragged.item.id,
          collectionId,
          folderId: parentFolderId,
        })
        .catch(() =>
          setManagementError(
            "Der Request konnte nicht verschoben werden. Lade bei einem Konflikt die aktuelle Version.",
          ),
        );
      return;
    }
    updateFolderItem(dragged.item, {
      destination: { collectionId, parentFolderId },
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
        <Button onClick={() => workspaces.refetch()}>
          Erneut versuchen
        </Button>
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
    <div
      className={`workspace-layout ${sidebarOpen ? "sidebar-open" : ""}`}
    >
      <IconButton
        aria-controls="workspace-sidebar"
        aria-expanded={sidebarOpen}
        aria-label="Workspace-Navigation öffnen"
        className="mobile-sidebar-trigger"
        onClick={() => setSidebarOpen(true)}
        ref={sidebarTriggerRef}
      >
        <Navigation20Regular aria-hidden="true" />
      </IconButton>
      {compactNavigation && sidebarOpen ? (
        <button
          aria-label="Workspace-Navigation schließen"
          className="sidebar-backdrop"
          onClick={closeSidebar}
          type="button"
        />
      ) : null}
      <aside
        aria-hidden={compactNavigation && !sidebarOpen}
        aria-label="Workspace-Navigation"
        className="sidebar"
        id="workspace-sidebar"
        inert={compactNavigation && !sidebarOpen ? true : undefined}
      >
        <IconButton
          aria-label="Workspace-Navigation schließen"
          className="mobile-sidebar-close"
          onClick={closeSidebar}
          ref={sidebarCloseRef}
        >
          <Dismiss20Regular aria-hidden="true" />
        </IconButton>
        <div className="workspace-switcher">
          <div className="workspace-select">
            <span className="eyebrow">Workspace</span>
            <Dropdown
              aria-label="Workspace auswählen"
              className="workspace-select-dropdown"
              onOptionSelect={(_, data) => {
                if (!data.optionValue) return;
                if (
                  hasDirtyRequests &&
                  !window.confirm(
                    "In offenen Tabs gibt es ungespeicherte Änderungen. Möchtest du den Workspace wirklich wechseln?",
                  )
                ) {
                  return;
                }
                navigate(`/workspaces/${data.optionValue}`);
              }}
              selectedOptions={[activeWorkspace.id]}
              value={activeWorkspace.name}
            >
              {workspaces.data?.map((workspace) => (
                <Option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </Option>
              ))}
            </Dropdown>
          </div>
          <IconButton
            aria-label="Workspace erstellen"
            className="workspace-create-button"
            disabled={activeWorkspace.role !== "owner"}
            onClick={() => setCreatingWorkspace(true)}
            title={
              activeWorkspace.role === "owner"
                ? "Workspace in diesem Team erstellen"
                : "Nur Team-Owner können Workspaces erstellen"
            }
          >
            <Add20Regular aria-hidden="true" />
          </IconButton>
        </div>

        <div className="sidebar-heading">
          <span>Collections</span>
          {canEdit ? (
            <IconButton
              aria-label="Collection erstellen"
              onClick={() => setCreatingCollection(true)}
              size="compact"
            >
              <Add20Regular aria-hidden="true" />
            </IconButton>
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
            {tree.data?.collections.map((collection, collectionIndex) => (
              <div key={collection.id}>
                <div
                  className={`tree-row tree-parent ${
                    dropTarget === `collection:${collection.id}`
                      ? "drop-target"
                      : ""
                  }`}
                  onDragLeave={() => setDropTarget(undefined)}
                  onDragOver={(event) => {
                    if (!canDropNavigationItem(collection.id, null)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropTarget(`collection:${collection.id}`);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    dropNavigationItem(collection.id, null);
                  }}
                >
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
                    <TreeActionMenu label={`${collection.name} Optionen`}>
                      <button
                        aria-label={`${collection.name} nach oben`}
                        disabled={
                          collectionIndex === 0 || updateCollection.isPending
                        }
                        onClick={() =>
                          updateCollectionItem(collection, {
                            targetPosition: collectionIndex - 1,
                          })
                        }
                        role="menuitem"
                        type="button"
                      >
                        <ArrowUp aria-hidden="true" size={14} />
                        Nach oben
                      </button>
                      <button
                        aria-label={`${collection.name} nach unten`}
                        disabled={
                          collectionIndex ===
                            (tree.data?.collections.length ?? 0) - 1 ||
                          updateCollection.isPending
                        }
                        onClick={() =>
                          updateCollectionItem(collection, {
                            targetPosition: collectionIndex + 1,
                          })
                        }
                        role="menuitem"
                        type="button"
                      >
                        <ArrowDown aria-hidden="true" size={14} />
                        Nach unten
                      </button>
                      <button
                        aria-label={`${collection.name} umbenennen`}
                        onClick={() => {
                          const name = window.prompt(
                            "Neuer Collection-Name",
                            collection.name,
                          );
                          if (name?.trim() && name.trim() !== collection.name) {
                            updateCollectionItem(collection, {
                              name: name.trim(),
                            });
                          }
                        }}
                        role="menuitem"
                        type="button"
                      >
                        <Pencil aria-hidden="true" size={14} />
                        Umbenennen
                      </button>
                      <button
                        aria-label={`Request in ${collection.name} erstellen`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setCreatingChild({
                            collectionId: collection.id,
                            parentFolderId: null,
                            kind: "request",
                          });
                        }}
                        role="menuitem"
                        type="button"
                      >
                        <FilePlus2 aria-hidden="true" size={14} />
                        Request erstellen
                      </button>
                      <button
                        aria-label={`Ordner in ${collection.name} erstellen`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setCreatingChild({
                            collectionId: collection.id,
                            parentFolderId: null,
                            kind: "folder",
                          });
                        }}
                        role="menuitem"
                        type="button"
                      >
                        <FolderPlus aria-hidden="true" size={14} />
                        Ordner erstellen
                      </button>
                      <button
                        aria-label={`${collection.name} löschen`}
                        className="danger"
                        disabled={deleteCollection.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeCollection(collection);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        <Delete20Regular aria-hidden="true" />
                        Löschen
                      </button>
                    </TreeActionMenu>
                  ) : null}
                </div>
                <div
                  className="tree-children"
                  hidden={collapsedCollectionIds.has(collection.id)}
                >
                  {creatingChild?.collectionId === collection.id &&
                  creatingChild.parentFolderId === null &&
                  creatingChild.kind === "folder" ? (
                    <FolderCreateForm
                      collectionId={collection.id}
                      onClose={() => setCreatingChild(undefined)}
                      workspaceId={activeWorkspace.id}
                    />
                  ) : null}
                  {creatingChild?.collectionId === collection.id &&
                  creatingChild.parentFolderId === null &&
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
                        canEdit={canEdit}
                        collapsedFolderIds={collapsedFolderIds}
                        creatingChild={creatingChild}
                        draggedNavigationItem={draggedNavigationItem}
                        dirtyRequestIds={dirtyRequestIds}
                        dropTarget={dropTarget}
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
                        onDeleteFolder={removeFolder}
                        onDeleteRequest={removeRequestItem}
                        onDragEnd={() => {
                          setDraggedNavigationItem(undefined);
                          setDropTarget(undefined);
                        }}
                        onDragStart={setDraggedNavigationItem}
                        onDropFolder={(collectionId, parentFolderId) =>
                          dropNavigationItem(collectionId, parentFolderId)
                        }
                        onDragOverFolder={(target, collectionId, folderId) => {
                          if (!canDropNavigationItem(collectionId, folderId)) {
                            return false;
                          }
                          setDropTarget(target);
                          return true;
                        }}
                        onDuplicateRequest={duplicateNavigationRequest}
                        onMoveRequest={startMovingRequest}
                        onUpdateFolder={updateFolderItem}
                        onStartCreating={setCreatingChild}
                        onStopCreating={() => setCreatingChild(undefined)}
                        requestsByFolder={requestsByFolder}
                        workspaceId={activeWorkspace.id}
                      />
                    ),
                  )}
                  {(requestsByCollection.get(collection.id) ?? []).map(
                    (request) => (
                      <RequestTreeRow
                        active={activeRequestId === request.id}
                        canEdit={canEdit}
                        dirty={dirtyRequestIds.has(request.id)}
                        key={request.id}
                        onDelete={() => removeRequestItem(request)}
                        onDragEnd={() => setDraggedNavigationItem(undefined)}
                        onDragStart={() =>
                          setDraggedNavigationItem({
                            kind: "request",
                            item: request,
                          })
                        }
                        onDuplicate={() => duplicateNavigationRequest(request)}
                        onMove={() => startMovingRequest(request)}
                        onClick={() => selectRequest(request.id)}
                        request={request}
                      />
                    ),
                  )}
                </div>
              </div>
            ))}
            {(requestsByCollection.get("unassigned") ?? []).map((request) => (
              <RequestTreeRow
                active={activeRequestId === request.id}
                canEdit={canEdit}
                dirty={dirtyRequestIds.has(request.id)}
                key={request.id}
                onDelete={() => removeRequestItem(request)}
                onDragEnd={() => setDraggedNavigationItem(undefined)}
                onDragStart={() =>
                  setDraggedNavigationItem({ kind: "request", item: request })
                }
                onDuplicate={() => duplicateNavigationRequest(request)}
                onMove={() => startMovingRequest(request)}
                onClick={() => selectRequest(request.id)}
                request={request}
              />
            ))}
            {tree.data?.requests.length === 0 ? (
              <p className="sidebar-state">Noch keine Requests vorhanden.</p>
            ) : null}
          </nav>
        )}

        {managementError && !movingRequest ? (
          <p className="sidebar-state field-error" role="alert">
            {managementError}
          </p>
        ) : null}

        <div className="sidebar-footer-actions">
          {canEdit && (tree.data?.collections.length ?? 0) > 0 ? (
            <button
              className="history-link"
              onClick={() => setShowingOpenApiImport(true)}
              type="button"
            >
              <ArrowUpload20Regular aria-hidden="true" />
              OpenAPI importieren
            </button>
          ) : null}
          <button
            className="history-link"
            disabled={exportWorkspace.isPending || !tree.data}
            onClick={async () => {
              if (!tree.data) return;
              if (
                hasDirtyRequests &&
                !window.confirm(
                  "Der Export enthält nur gespeicherte Versionen. Trotzdem fortfahren?",
                )
              ) {
                return;
              }
              setManagementError(undefined);
              try {
                await exportWorkspace.mutateAsync({
                  workspace: activeWorkspace,
                  tree: tree.data,
                });
              } catch {
                setManagementError(
                  "Der Workspace konnte nicht exportiert werden.",
                );
              }
            }}
            type="button"
          >
            <ArrowDownload20Regular aria-hidden="true" />
            {exportWorkspace.isPending
              ? "Export wird erstellt …"
              : "Workspace exportieren"}
          </button>
          <button
            className="history-link"
            onClick={() => setShowingHistory(true)}
            type="button"
          >
            <History20Regular aria-hidden="true" />
            Verlauf
          </button>
        </div>
      </aside>

      <section className="request-workbench">
        {activeRequest ? (
          <>
            <div className="request-tabs-bar">
              <div
                aria-label="Geöffnete Requests"
                className="request-tabs"
                role="navigation"
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
                      aria-label={`${request.method} ${request.name} Tab`}
                      aria-pressed={request.id === activeRequestId}
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
                      <Dismiss20Regular aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              <TreeActionMenu
                className="request-tab-menu"
                label="Tab-Aktionen"
                triggerClassName="tree-menu-trigger"
              >
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
              </TreeActionMenu>
            </div>
            <div className="request-toolbar">
              <div>
                <span className="breadcrumb">{activeWorkspace.name} /</span>
                <h1>{activeRequest.name}</h1>
              </div>
              <div className="toolbar-actions">
                {activeWorkspace.role === "owner" ? (
                  <>
                    <Button
                      onClick={() => setManagingTeam(true)}
                    >
                      <People20Regular aria-hidden="true" />
                      Team
                    </Button>
                    <Button
                      onClick={() => setInviting(true)}
                    >
                      <PeopleAdd20Regular aria-hidden="true" />
                      Einladen
                    </Button>
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
                    <Button
                      disabled={duplicateRequest.isPending}
                      onClick={() => duplicateNavigationRequest(activeRequest)}
                      title="Dupliziert die zuletzt gespeicherte Version"
                    >
                      <Copy20Regular aria-hidden="true" />
                      Duplizieren
                    </Button>
                    <Button
                      disabled={dirtyRequestIds.has(activeRequest.id)}
                      onClick={() => startMovingRequest(activeRequest)}
                      title={
                        dirtyRequestIds.has(activeRequest.id)
                          ? "Speichere den Request vor dem Verschieben"
                          : undefined
                      }
                    >
                      <FolderInput aria-hidden="true" size={16} />
                      Verschieben
                    </Button>
                  </>
                ) : null}
                {canEdit ? (
                  <Button
                    disabled={deleteRequest.isPending}
                    onClick={() => removeRequestItem(activeRequest)}
                    variant="danger"
                  >
                    <Delete20Regular aria-hidden="true" />
                    Löschen
                  </Button>
                ) : null}
                {canEdit ? (
                  <Button
                    form={`request-form-${activeRequest.id}`}
                    name="intent"
                    type="submit"
                    value="save"
                  >
                    <Save20Regular aria-hidden="true" />
                    Speichern
                  </Button>
                ) : null}
                <Button
                  form={`request-form-${activeRequest.id}`}
                  name="intent"
                  type="submit"
                  value="execute"
                  variant="primary"
                >
                  <Send20Regular aria-hidden="true" />
                  Senden
                </Button>
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
                <Button
                  onClick={() => setManagingTeam(true)}
                >
                  <People20Regular aria-hidden="true" />
                  Team verwalten
                </Button>
                <Button
                  onClick={() => setInviting(true)}
                >
                  <PeopleAdd20Regular aria-hidden="true" />
                  Mitglied einladen
                </Button>
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
          onOpenRequest={selectRequest}
          workspaceId={activeWorkspace.id}
        />
      ) : null}
      {showingOpenApiImport && tree.data ? (
        <OpenApiImportDialog
          collections={tree.data.collections}
          onClose={() => setShowingOpenApiImport(false)}
          onImported={(requests) => {
            setShowingOpenApiImport(false);
            const last = requests.at(-1);
            if (last) selectRequest(last.id);
          }}
          workspaceId={activeWorkspace.id}
        />
      ) : null}
      {movingRequest && activeRequest ? (
        <Dialog
          onClose={() => setMovingRequest(false)}
          titleId="move-request-title"
        >
            <h2 id="move-request-title">Request verschieben</h2>
            <p>
              Wähle die neue Collection und optional einen zugehörigen Ordner.
            </p>
            <div className="move-request-fields">
              <label>
                Collection
                <Select
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
                </Select>
              </label>
              <label>
                Ordner
                <Select
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
                </Select>
              </label>
            </div>
            {managementError ? (
              <p className="field-error" role="alert">
                {managementError}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                onClick={() => setMovingRequest(false)}
              >
                Abbrechen
              </Button>
              <Button
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
                variant="primary"
              >
                Verschieben
              </Button>
            </DialogFooter>
        </Dialog>
      ) : null}
      {creatingWorkspace ? (
        <Dialog
          className="workspace-create-dialog"
          onClose={() => setCreatingWorkspace(false)}
          titleId="create-workspace-title"
        >
            <h2 id="create-workspace-title">Workspace erstellen</h2>
            <p>
              Lege einen weiteren gemeinsamen Workspace im Team von{" "}
              <strong>{activeWorkspace.name}</strong> an. Bestehende
              Teammitglieder erhalten automatisch Zugriff.
            </p>
            <WorkspaceCreateForm teamId={activeWorkspace.teamId} />
            <DialogFooter>
              <Button
                onClick={() => setCreatingWorkspace(false)}
              >
                Abbrechen
              </Button>
            </DialogFooter>
        </Dialog>
      ) : null}
    </div>
  );
}

interface FolderTreeNodeProps {
  activeRequestId: string | undefined;
  canEdit: boolean;
  collapsedFolderIds: Set<string>;
  creatingChild:
    | {
        collectionId: string;
        parentFolderId: string | null;
        kind: "folder" | "request";
      }
    | undefined;
  folder: FolderSummary;
  draggedNavigationItem: DraggedNavigationItem | undefined;
  dirtyRequestIds: Set<string>;
  dropTarget: string | undefined;
  foldersByParent: Map<string, FolderSummary[]>;
  requestsByFolder: Map<string, RequestSummary[]>;
  onSelectRequest: (requestId: string) => void;
  onDeleteFolder: (folder: FolderSummary) => void;
  onDeleteRequest: (request: RequestSummary) => void;
  onDragEnd: () => void;
  onDragStart: (item: DraggedNavigationItem) => void;
  onDragOverFolder: (
    target: string,
    collectionId: string,
    folderId: string,
  ) => boolean;
  onDropFolder: (collectionId: string, folderId: string) => void;
  onDuplicateRequest: (request: RequestSummary) => void;
  onMoveRequest: (request: RequestSummary) => void;
  onUpdateFolder: (
    folder: FolderSummary,
    change: {
      name?: string;
      targetPosition?: number;
      destination?: {
        collectionId: string;
        parentFolderId: string | null;
      };
    },
  ) => void;
  onStartCreating: (value: {
    collectionId: string;
    parentFolderId: string | null;
    kind: "folder" | "request";
  }) => void;
  onStopCreating: () => void;
  onToggleFolder: (folderId: string) => void;
  workspaceId: string;
}

function FolderTreeNode({
  activeRequestId,
  canEdit,
  collapsedFolderIds,
  creatingChild,
  draggedNavigationItem,
  dirtyRequestIds,
  dropTarget,
  folder,
  foldersByParent,
  requestsByFolder,
  onSelectRequest,
  onDeleteFolder,
  onDeleteRequest,
  onDragEnd,
  onDragStart,
  onDragOverFolder,
  onDropFolder,
  onDuplicateRequest,
  onMoveRequest,
  onUpdateFolder,
  onStartCreating,
  onStopCreating,
  onToggleFolder,
  workspaceId,
}: FolderTreeNodeProps) {
  const collapsed = collapsedFolderIds.has(folder.id);
  const siblingKey =
    folder.parentFolderId ?? `collection:${folder.collectionId}`;
  const siblings = foldersByParent.get(siblingKey) ?? [];
  const siblingIndex = siblings.findIndex(({ id }) => id === folder.id);
  return (
    <div>
      <div
        className={`tree-row nested-folder tree-parent ${
          dropTarget === `folder:${folder.id}` ? "drop-target" : ""
        }`}
        draggable={canEdit}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          if (
            !onDragOverFolder(
              `folder:${folder.id}`,
              folder.collectionId,
              folder.id,
            )
          ) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
        }}
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", `folder:${folder.id}`);
          onDragStart({ kind: "folder", item: folder });
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDropFolder(folder.collectionId, folder.id);
        }}
      >
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
        {canEdit ? (
          <TreeActionMenu label={`${folder.name} Optionen`}>
            <button
              aria-label={`${folder.name} nach oben`}
              disabled={siblingIndex <= 0}
              onClick={() =>
                onUpdateFolder(folder, { targetPosition: siblingIndex - 1 })
              }
              role="menuitem"
              type="button"
            >
              <ArrowUp aria-hidden="true" size={14} />
              Nach oben
            </button>
            <button
              aria-label={`${folder.name} nach unten`}
              disabled={siblingIndex < 0 || siblingIndex === siblings.length - 1}
              onClick={() =>
                onUpdateFolder(folder, { targetPosition: siblingIndex + 1 })
              }
              role="menuitem"
              type="button"
            >
              <ArrowDown aria-hidden="true" size={14} />
              Nach unten
            </button>
            <button
              aria-label={`${folder.name} umbenennen`}
              onClick={() => {
                const name = window.prompt("Neuer Ordnername", folder.name);
                if (name?.trim() && name.trim() !== folder.name) {
                  onUpdateFolder(folder, { name: name.trim() });
                }
              }}
              role="menuitem"
              type="button"
            >
              <Pencil aria-hidden="true" size={14} />
              Umbenennen
            </button>
            <button
              aria-label={`Request in ${folder.name} erstellen`}
              onClick={() =>
                onStartCreating({
                  collectionId: folder.collectionId,
                  parentFolderId: folder.id,
                  kind: "request",
                })
              }
              role="menuitem"
              type="button"
            >
              <FilePlus2 aria-hidden="true" size={14} />
              Request erstellen
            </button>
            <button
              aria-label={`Unterordner in ${folder.name} erstellen`}
              onClick={() =>
                onStartCreating({
                  collectionId: folder.collectionId,
                  parentFolderId: folder.id,
                  kind: "folder",
                })
              }
              role="menuitem"
              type="button"
            >
              <FolderPlus aria-hidden="true" size={14} />
              Unterordner erstellen
            </button>
            <button
              aria-label={`${folder.name} löschen`}
              className="danger"
              onClick={() => onDeleteFolder(folder)}
              role="menuitem"
              type="button"
            >
              <Delete20Regular aria-hidden="true" />
              Löschen
            </button>
          </TreeActionMenu>
        ) : null}
      </div>
      <div className="tree-children" hidden={collapsed}>
        {creatingChild?.parentFolderId === folder.id &&
        creatingChild.kind === "folder" ? (
          <FolderCreateForm
            collectionId={folder.collectionId}
            onClose={onStopCreating}
            parentFolderId={folder.id}
            workspaceId={workspaceId}
          />
        ) : null}
        {creatingChild?.parentFolderId === folder.id &&
        creatingChild.kind === "request" ? (
          <RequestCreateForm
            collectionId={folder.collectionId}
            folderId={folder.id}
            onClose={onStopCreating}
            onCreated={onSelectRequest}
            workspaceId={workspaceId}
          />
        ) : null}
        {(foldersByParent.get(folder.id) ?? []).map((child) => (
          <FolderTreeNode
            activeRequestId={activeRequestId}
            canEdit={canEdit}
            collapsedFolderIds={collapsedFolderIds}
            creatingChild={creatingChild}
            draggedNavigationItem={draggedNavigationItem}
            dirtyRequestIds={dirtyRequestIds}
            dropTarget={dropTarget}
            folder={child}
            foldersByParent={foldersByParent}
            key={child.id}
            onSelectRequest={onSelectRequest}
            onDeleteFolder={onDeleteFolder}
            onDeleteRequest={onDeleteRequest}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onDragOverFolder={onDragOverFolder}
            onDropFolder={onDropFolder}
            onDuplicateRequest={onDuplicateRequest}
            onMoveRequest={onMoveRequest}
            onUpdateFolder={onUpdateFolder}
            onStartCreating={onStartCreating}
            onStopCreating={onStopCreating}
            onToggleFolder={onToggleFolder}
            requestsByFolder={requestsByFolder}
            workspaceId={workspaceId}
          />
        ))}
        {(requestsByFolder.get(folder.id) ?? []).map((request) => (
          <RequestTreeRow
            active={activeRequestId === request.id}
            canEdit={canEdit}
            dirty={dirtyRequestIds.has(request.id)}
            key={request.id}
            onDelete={() => onDeleteRequest(request)}
            onDragEnd={onDragEnd}
            onDragStart={() =>
              onDragStart({ kind: "request", item: request })
            }
            onDuplicate={() => onDuplicateRequest(request)}
            onMove={() => onMoveRequest(request)}
            onClick={() => onSelectRequest(request.id)}
            request={request}
          />
        ))}
      </div>
    </div>
  );
}

interface RequestTreeRowProps {
  active: boolean;
  canEdit: boolean;
  dirty: boolean;
  onDelete: () => void;
  onDragEnd: () => void;
  onDragStart: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onClick: () => void;
  request: RequestSummary;
}

function RequestTreeRow({
  active,
  canEdit,
  dirty,
  onDelete,
  onDragEnd,
  onDragStart,
  onDuplicate,
  onMove,
  onClick,
  request,
}: RequestTreeRowProps) {
  return (
    <div
      className={`tree-row request-row ${active ? "active" : ""}`}
      draggable={canEdit && !dirty}
      onDragEnd={onDragEnd}
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `request:${request.id}`);
        onDragStart();
      }}
    >
      <button
        aria-label={`${request.method} ${request.name}`}
        className="tree-request-select"
        onClick={onClick}
        type="button"
      >
        <span className={`method method-${request.method.toLowerCase()}`}>
          {request.method}
        </span>
        <span>{request.name}</span>
      </button>
      {canEdit ? (
        <TreeActionMenu label={`${request.name} Optionen`}>
          <button onClick={onClick} role="menuitem" type="button">
            Öffnen
          </button>
          <button
            disabled={!request.collectionId}
            onClick={onDuplicate}
            role="menuitem"
            type="button"
          >
            <Copy20Regular aria-hidden="true" />
            Duplizieren
          </button>
          <button
            disabled={!request.collectionId || dirty}
            onClick={onMove}
            role="menuitem"
            title={dirty ? "Speichere den Request vor dem Verschieben" : undefined}
            type="button"
          >
            <FolderInput aria-hidden="true" size={14} />
            Verschieben
          </button>
          <button
            className="danger"
            onClick={onDelete}
            role="menuitem"
            type="button"
          >
            <Delete20Regular aria-hidden="true" />
            Löschen
          </button>
        </TreeActionMenu>
      ) : null}
    </div>
  );
}

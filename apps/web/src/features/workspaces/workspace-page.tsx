import {
  type FolderSummary,
  type RequestSummary,
} from "@api-client/contracts";
import {
  ChevronDown,
  Clock3,
  FilePlus2,
  FolderClosed,
  FolderPlus,
  Plus,
  Save,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { RequestEditor } from "../requests/request-editor";
import { InvitationDialog } from "../invitations/invitation-dialog";
import { TeamMembersDialog } from "../teams/team-members-dialog";
import { EnvironmentControls } from "../environments/environment-controls";
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
  const [editorDirty, setEditorDirty] = useState(false);
  const [selectedEnvironmentId, setSelectedEnvironmentId] =
    useState<string>();
  const [inviting, setInviting] = useState(false);
  const [managingTeam, setManagingTeam] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [creatingChild, setCreatingChild] = useState<{
    collectionId: string;
    kind: "folder" | "request";
  }>();

  useEffect(() => {
    setActiveRequestId(undefined);
    setEditorDirty(false);
    setSelectedEnvironmentId(undefined);
  }, [activeWorkspace?.id]);

  function selectRequest(requestId: string) {
    if (
      editorDirty &&
      !window.confirm(
        "Du hast ungespeicherte Änderungen. Möchtest du sie verwerfen?",
      )
    ) {
      return;
    }
    setEditorDirty(false);
    setActiveRequestId(requestId);
  }

  useEffect(() => {
    if (!activeRequestId && tree.data?.requests[0]) {
      setActiveRequestId(tree.data.requests[0].id);
    }
  }, [activeRequestId, tree.data]);

  const activeRequest = tree.data?.requests.find(
    ({ id }) => id === activeRequestId,
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
          <span>
            <span className="eyebrow">Workspace</span>
            <span className="sr-only">Workspace auswählen</span>
          </span>
          <select
            value={activeWorkspace.id}
            onChange={(event) => {
              if (
                editorDirty &&
                !window.confirm(
                  "Du hast ungespeicherte Änderungen. Möchtest du sie verwerfen?",
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
                  <ChevronDown aria-hidden="true" size={15} />
                  <FolderClosed aria-hidden="true" size={16} />
                  <span>{collection.name}</span>
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
                <div className="tree-children">
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

        <button className="history-link" type="button">
          <Clock3 aria-hidden="true" size={16} />
          Verlauf
        </button>
      </aside>

      <section className="request-workbench">
        {activeRequest ? (
          <>
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
                    form="request-form"
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
                  form="request-form"
                  name="intent"
                  type="submit"
                  value="execute"
                >
                  <Send aria-hidden="true" size={16} />
                  Senden
                </button>
              </div>
            </div>
            <RequestEditor
              key={activeRequest.id}
              requestId={activeRequest.id}
              workspaceId={activeWorkspace.id}
              onDirtyChange={setEditorDirty}
              readOnly={!canEdit}
              variables={
                environments.data?.find(
                  ({ id }) => id === selectedEnvironmentId,
                )?.variables ?? []
              }
            />
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

import type {
  CollectionSummary,
  FolderSummary,
  WorkspaceTree,
} from "@api-client/contracts";

import { fetchRequest } from "../requests/request-api";
import { createCollection, createFolder, createRequest } from "./workspace-api";

type TreeItems = Pick<WorkspaceTree, "folders" | "requests">;

async function duplicateFolderContents(
  workspaceId: string,
  sourceCollectionId: string,
  targetCollectionId: string,
  sourceParentFolderId: string | null,
  targetParentFolderId: string | null,
  tree: TreeItems,
  accessToken: string,
): Promise<void> {
  const childFolders = tree.folders.filter(
    (folder) =>
      folder.collectionId === sourceCollectionId &&
      folder.parentFolderId === sourceParentFolderId,
  );
  for (const child of childFolders) {
    const newChild = await createFolder(
      workspaceId,
      {
        collectionId: targetCollectionId,
        parentFolderId: targetParentFolderId,
        name: child.name,
      },
      accessToken,
    );
    await duplicateFolderContents(
      workspaceId,
      sourceCollectionId,
      targetCollectionId,
      child.id,
      newChild.id,
      tree,
      accessToken,
    );
  }

  const childRequests = tree.requests.filter(
    (request) =>
      request.collectionId === sourceCollectionId &&
      request.folderId === sourceParentFolderId,
  );
  for (const request of childRequests) {
    const full = await fetchRequest(request.id, accessToken);
    await createRequest(
      workspaceId,
      {
        collectionId: targetCollectionId,
        folderId: targetParentFolderId,
        name: full.name,
        method: full.method,
        url: full.url,
        queryParams: full.queryParams,
        headers: full.headers,
        body: full.body,
        assertions: full.assertions,
      },
      accessToken,
    );
  }
}

export async function duplicateCollection(
  workspaceId: string,
  collection: CollectionSummary,
  tree: TreeItems,
  accessToken: string,
): Promise<CollectionSummary> {
  const newCollection = await createCollection(
    workspaceId,
    { name: `${collection.name} Kopie` },
    accessToken,
  );
  await duplicateFolderContents(
    workspaceId,
    collection.id,
    newCollection.id,
    null,
    null,
    tree,
    accessToken,
  );
  return newCollection;
}

export async function duplicateFolder(
  workspaceId: string,
  folder: FolderSummary,
  tree: TreeItems,
  accessToken: string,
): Promise<FolderSummary> {
  const newFolder = await createFolder(
    workspaceId,
    {
      collectionId: folder.collectionId,
      parentFolderId: folder.parentFolderId,
      name: `${folder.name} Kopie`,
    },
    accessToken,
  );
  await duplicateFolderContents(
    workspaceId,
    folder.collectionId,
    folder.collectionId,
    folder.id,
    newFolder.id,
    tree,
    accessToken,
  );
  return newFolder;
}

import {
  ChevronDown,
  ChevronRight,
  Clock3,
  FolderClosed,
  MoreHorizontal,
  Plus,
  Save,
  Send,
} from "lucide-react";
import { useState } from "react";

import { RequestEditor } from "../requests/request-editor";

const requests = [
  { method: "GET", name: "List customers" },
  { method: "POST", name: "Create customer" },
  { method: "GET", name: "Get customer" },
];

export function WorkspacePage() {
  const [activeRequest, setActiveRequest] = useState("List customers");

  return (
    <div className="workspace-layout">
      <aside className="sidebar" aria-label="Workspace-Navigation">
        <div className="workspace-select">
          <div>
            <span className="eyebrow">Workspace</span>
            <strong>Commerce API</strong>
          </div>
          <ChevronDown aria-hidden="true" size={16} />
        </div>

        <div className="sidebar-heading">
          <span>Collections</span>
          <button className="icon-button compact" type="button" aria-label="Collection erstellen">
            <Plus aria-hidden="true" size={16} />
          </button>
        </div>

        <nav className="collection-tree">
          <button className="tree-row tree-parent" type="button">
            <ChevronDown aria-hidden="true" size={15} />
            <FolderClosed aria-hidden="true" size={16} />
            <span>Customers</span>
            <MoreHorizontal aria-hidden="true" className="tree-action" size={15} />
          </button>
          <div className="tree-children">
            {requests.map((request) => (
              <button
                className={`tree-row request-row ${
                  activeRequest === request.name ? "active" : ""
                }`}
                key={request.name}
                onClick={() => setActiveRequest(request.name)}
                type="button"
              >
                <span className={`method method-${request.method.toLowerCase()}`}>
                  {request.method}
                </span>
                <span>{request.name}</span>
              </button>
            ))}
          </div>
          <button className="tree-row tree-parent muted" type="button">
            <ChevronRight aria-hidden="true" size={15} />
            <FolderClosed aria-hidden="true" size={16} />
            <span>Orders</span>
          </button>
        </nav>

        <button className="history-link" type="button">
          <Clock3 aria-hidden="true" size={16} />
          Verlauf
        </button>
      </aside>

      <section className="request-workbench">
        <div className="request-toolbar">
          <div>
            <span className="breadcrumb">Customers /</span>
            <h1>{activeRequest}</h1>
          </div>
          <div className="toolbar-actions">
            <span className="save-state">Alle Änderungen gespeichert</span>
            <button className="button secondary" type="button">
              <Save aria-hidden="true" size={16} />
              Speichern
            </button>
            <button className="button primary" form="request-form" type="submit">
              <Send aria-hidden="true" size={16} />
              Senden
            </button>
          </div>
        </div>
        <RequestEditor requestName={activeRequest} />
      </section>
    </div>
  );
}


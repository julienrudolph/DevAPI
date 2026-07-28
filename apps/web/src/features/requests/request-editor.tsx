import { zodResolver } from "@hookform/resolvers/zod";
import {
  type RequestDraft,
  requestDraftSchema,
} from "@api-client/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";

interface RequestEditorProps {
  requestName: string;
}

const defaultRequest: RequestDraft = {
  name: "List customers",
  method: "GET",
  url: "{{baseUrl}}/customers",
  queryParams: [],
  headers: [
    {
      id: "2aca27a0-6ad3-43ed-877d-c8bb236c1b89",
      key: "Accept",
      value: "application/json",
      enabled: true,
    },
  ],
  body: { type: "none" },
};

export function RequestEditor({ requestName }: RequestEditorProps) {
  const [activeTab, setActiveTab] = useState("params");
  const [responseVisible, setResponseVisible] = useState(false);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<RequestDraft>({
    resolver: zodResolver(requestDraftSchema),
    defaultValues: { ...defaultRequest, name: requestName },
  });

  function submitRequest() {
    setResponseVisible(true);
  }

  return (
    <form
      className="editor"
      id="request-form"
      onSubmit={handleSubmit(submitRequest)}
    >
      <div className="url-bar">
        <select aria-label="HTTP-Methode" {...register("method")}>
          <option>GET</option>
          <option>POST</option>
          <option>PUT</option>
          <option>PATCH</option>
          <option>DELETE</option>
        </select>
        <input
          aria-label="Request-URL"
          autoComplete="off"
          spellCheck={false}
          {...register("url")}
        />
      </div>
      {errors.url ? <p className="field-error">{errors.url.message}</p> : null}

      <div className="tabs" role="tablist" aria-label="Request-Konfiguration">
        {([
          ["params", "Parameter"],
          ["headers", "Header"],
          ["body", "Body"],
          ["auth", "Authentifizierung"],
        ] as const).map(([id, label]) => (
          <button
            aria-selected={activeTab === id}
            className={activeTab === id ? "active" : ""}
            key={id}
            onClick={() => setActiveTab(id)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="editor-panel">
        {activeTab === "params" ? (
          <KeyValueTable emptyLabel="Query-Parameter hinzufügen" />
        ) : null}
        {activeTab === "headers" ? (
          <KeyValueTable
            emptyLabel="Header hinzufügen"
            initialKey="Accept"
            initialValue="application/json"
          />
        ) : null}
        {activeTab === "body" ? (
          <div className="empty-panel">
            Für GET-Requests ist standardmäßig kein Body gesetzt.
          </div>
        ) : null}
        {activeTab === "auth" ? (
          <div className="empty-panel">
            Keine Authentifizierung ausgewählt.
          </div>
        ) : null}
      </div>

      <section className="response-panel" aria-live="polite">
        <div className="response-heading">
          <h2>Response</h2>
          {responseVisible ? (
            <div className="response-meta">
              <span className="status-ok">200 OK</span>
              <span>184 ms</span>
              <span>1,2 KB</span>
            </div>
          ) : null}
        </div>
        {responseVisible ? (
          <pre>
            {JSON.stringify(
              {
                data: [
                  { id: "cus_01", name: "Ada Lovelace" },
                  { id: "cus_02", name: "Grace Hopper" },
                ],
              },
              null,
              2,
            )}
          </pre>
        ) : (
          <div className="response-empty">
            Sende den Request, um die Response hier zu sehen.
          </div>
        )}
      </section>
    </form>
  );
}

interface KeyValueTableProps {
  emptyLabel: string;
  initialKey?: string;
  initialValue?: string;
}

function KeyValueTable({
  emptyLabel,
  initialKey = "",
  initialValue = "",
}: KeyValueTableProps) {
  return (
    <div className="key-value-table">
      <div className="table-head">
        <span />
        <span>Schlüssel</span>
        <span>Wert</span>
      </div>
      <div className="table-row">
        <input defaultChecked type="checkbox" aria-label="Eintrag aktivieren" />
        <input aria-label="Schlüssel" defaultValue={initialKey} placeholder="key" />
        <input
          aria-label="Wert"
          defaultValue={initialValue}
          placeholder="value"
        />
      </div>
      <button className="add-row" type="button">
        + {emptyLabel}
      </button>
    </div>
  );
}

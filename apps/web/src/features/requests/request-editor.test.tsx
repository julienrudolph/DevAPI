import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  countMatches,
  describeHttpStatus,
  isHtmlResponse,
  RequestEditor,
} from "./request-editor";
import { RequestConflictError } from "./request-api";
import {
  useExecuteRequest,
  useRequest,
  useUpdateRequest,
} from "./request-queries";
import { useEnvironments } from "../environments/environment-queries";

vi.mock("./request-queries", () => ({
  useRequest: vi.fn(),
  useUpdateRequest: vi.fn(),
  useExecuteRequest: vi.fn(),
}));
vi.mock("../environments/environment-queries", () => ({
  useEnvironments: vi.fn(),
}));
vi.mock("../../components/editors/monaco-editor", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Body-Inhalt"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  ),
}));

const request = {
  id: "fa7596b3-0041-4fe8-9ddf-956e7a107014",
  workspaceId: "85e52968-22cc-483d-b6a6-bdc169e46ede",
  collectionId: "95da6097-0742-4164-9c9a-75dc64d2cd8f",
  folderId: null,
  name: "List customers",
  method: "GET" as const,
  url: "https://api.example.com/customers",
  queryParams: [],
  headers: [],
  body: { type: "none" as const },
  assertions: [],
  version: 2,
  createdBy: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
  updatedBy: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T13:00:00.000Z",
};

const mutateAsync = vi.fn();
const executeAsync = vi.fn();

beforeEach(() => {
  mutateAsync.mockReset();
  executeAsync.mockReset();
  vi.mocked(useRequest).mockReturnValue({
    data: request,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useRequest>);
  vi.mocked(useUpdateRequest).mockReturnValue({
    mutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateRequest>);
  vi.mocked(useExecuteRequest).mockReturnValue({
    mutateAsync: executeAsync,
    isPending: false,
    isError: false,
    data: undefined,
  } as unknown as ReturnType<typeof useExecuteRequest>);
  vi.mocked(useEnvironments).mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useEnvironments>);
});
afterEach(cleanup);

describe("RequestEditor", () => {
  it("counts case-insensitive response search matches", () => {
    expect(countMatches("Alpha alpha ALPHA", "alpha")).toBe(3);
    expect(countMatches("Alpha", " ")).toBe(0);
  });

  it("recognizes HTML responses and explains common HTTP errors", () => {
    expect(
      isHtmlResponse(
        { "content-type": "text/html; charset=utf-8" },
        "<h1>Nicht gefunden</h1>",
      ),
    ).toBe(true);
    expect(isHtmlResponse({}, "<!doctype html><html></html>")).toBe(true);
    expect(describeHttpStatus(404)).toContain("Pfad und Basis-URL");
    expect(describeHttpStatus(502)).toContain("Gateway");
  });

  it("loads the persisted request and marks local edits as dirty", async () => {
    const user = userEvent.setup();
    render(
      <RequestEditor
        requestId={request.id}
        workspaceId={request.workspaceId}
      />,
    );

    const url = screen.getByLabelText("Request-URL");
    expect(url).toHaveValue(request.url);
    await user.clear(url);
    await user.type(url, "https://api.example.com/accounts");
    expect(screen.getByText("Ungespeicherte Änderungen")).toBeInTheDocument();
  });

  it("saves with the loaded version", async () => {
    mutateAsync.mockResolvedValue({ ...request, version: 3 });
    render(
      <RequestEditor
        requestId={request.id}
        workspaceId={request.workspaceId}
      />,
    );

    screen
      .getByLabelText("Request-URL")
      .closest("form")
      ?.dispatchEvent(new SubmitEvent("submit", { bubbles: true }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ expectedVersion: 2 }),
      ),
    );
  });

  it("keeps the local draft when the server reports a conflict", async () => {
    const user = userEvent.setup();
    mutateAsync.mockRejectedValue(
      new RequestConflictError({
        code: "REQUEST_VERSION_CONFLICT",
        message: "Der Request wurde zwischenzeitlich geändert.",
        expectedVersion: 2,
        currentVersion: 3,
        current: {
          ...request,
          url: "https://team.example.com/customers",
          version: 3,
        },
        updatedBy: {
          id: request.updatedBy,
          displayName: "Teammitglied",
        },
        updatedAt: request.updatedAt,
      }),
    );
    render(
      <RequestEditor
        requestId={request.id}
        workspaceId={request.workspaceId}
      />,
    );
    const url = screen.getByLabelText("Request-URL");
    await user.clear(url);
    await user.type(url, "https://local.example.com/customers");
    url
      .closest("form")
      ?.dispatchEvent(new SubmitEvent("submit", { bubbles: true }));

    expect(
      await screen.findByText("Request wurde zwischenzeitlich geändert"),
    ).toBeInTheDocument();
    expect(url).toHaveValue("https://local.example.com/customers");
    expect(
      screen.getByText("https://team.example.com/customers"),
    ).toBeInTheDocument();
  });

  it("renders the real proxy response", () => {
    vi.mocked(useExecuteRequest).mockReturnValue({
      mutateAsync: executeAsync,
      isPending: false,
      isError: false,
      data: {
        status: 201,
        statusText: "Created",
        headers: { "content-type": "application/json" },
        body: '{"id":"cus_123"}',
        durationMs: 37,
      },
    } as unknown as ReturnType<typeof useExecuteRequest>);

    render(
      <RequestEditor
        requestId={request.id}
        workspaceId={request.workspaceId}
      />,
    );

    expect(screen.getByText("201 Created")).toBeInTheDocument();
    expect(screen.getByText("37 ms")).toBeInTheDocument();
    expect(screen.getByText(/cus_123/)).toBeInTheDocument();
  });

  it("shows HTML error responses safely with an HTTP explanation", () => {
    vi.mocked(useExecuteRequest).mockReturnValue({
      mutateAsync: executeAsync,
      isPending: false,
      isError: false,
      data: {
        status: 404,
        statusText: "Not Found",
        headers: { "content-type": "text/html; charset=utf-8" },
        body: "<!doctype html><html><body>Route fehlt</body></html>",
        durationMs: 21,
      },
    } as unknown as ReturnType<typeof useExecuteRequest>);

    render(
      <RequestEditor
        requestId={request.id}
        workspaceId={request.workspaceId}
      />,
    );

    expect(
      screen.getByText("HTTP 404: Die Ziel-API meldet einen Fehler"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Pfad und Basis-URL/)).toBeInTheDocument();
    expect(screen.getByText(/HTML-Quelltext/)).toBeInTheDocument();
    expect(screen.getByText(/Route fehlt/)).toBeInTheDocument();
  });

  it("adds query parameters to the persisted draft", async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({ ...request, version: 3 });
    render(
      <RequestEditor
        requestId={request.id}
        workspaceId={request.workspaceId}
      />,
    );

    await user.click(screen.getByText("Query-Parameter hinzufügen"));
    await user.type(screen.getByLabelText("Schlüssel"), "limit");
    await user.type(screen.getByLabelText("Wert"), "20");
    screen
      .getByLabelText("Request-URL")
      .closest("form")
      ?.dispatchEvent(new SubmitEvent("submit", { bubbles: true }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          queryParams: [
            expect.objectContaining({ key: "limit", value: "20" }),
          ],
        }),
      ),
    );
  });

  it("offers standard header names while typing", async () => {
    const user = userEvent.setup();
    render(
      <RequestEditor
        requestId={request.id}
        workspaceId={request.workspaceId}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Header" }));
    await user.click(screen.getByText("Header hinzufügen"));

    const keyInput = screen.getByLabelText("Schlüssel");
    expect(keyInput).toHaveAttribute(
      "list",
      "request-header-name-suggestions",
    );
    expect(
      document.querySelector(
        '#request-header-name-suggestions option[value="Content-Type"]',
      ),
    ).toBeInTheDocument();

    await user.type(keyInput, "cont");
    expect(keyInput).toHaveValue("cont");
  });

  it("blocks malformed JSON before it reaches persistence", async () => {
    const user = userEvent.setup();
    render(
      <RequestEditor
        requestId={request.id}
        workspaceId={request.workspaceId}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Body" }));
    await user.selectOptions(screen.getByLabelText("Body-Typ"), "json");
    const body = await screen.findByLabelText("Body-Inhalt");
    fireEvent.change(body, { target: { value: '{"name":' } });
    body
      .closest("form")
      ?.dispatchEvent(new SubmitEvent("submit", { bubbles: true }));

    expect(
      await screen.findByText("Der JSON-Body ist ungültig."),
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("keeps bearer credentials local and uses them only for execution", async () => {
    const user = userEvent.setup();
    executeAsync.mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "",
      durationMs: 10,
    });
    render(
      <RequestEditor
        requestId={request.id}
        workspaceId={request.workspaceId}
      />,
    );

    await user.click(
      screen.getByRole("tab", { name: "Authentifizierung" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Authentifizierung"),
      "bearer",
    );
    await user.type(screen.getByLabelText("Bearer Token"), "local-secret");

    const form = screen.getByLabelText("Request-URL").closest("form")!;
    const executeButton = document.createElement("button");
    executeButton.type = "submit";
    executeButton.value = "execute";
    form.append(executeButton);
    await user.click(executeButton);

    await waitFor(() =>
      expect(executeAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: { type: "bearer", token: "local-secret" },
        }),
      ),
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("imports a cURL command into the local draft", async () => {
    const user = userEvent.setup();
    render(
      <RequestEditor
        requestId={request.id}
        workspaceId={request.workspaceId}
      />,
    );

    await user.click(screen.getByRole("button", { name: "cURL importieren" }));
    fireEvent.change(screen.getByLabelText("cURL-Kommando"), {
      target: {
        value:
          "curl -X PATCH 'https://api.example.com/customers/42' -H 'Content-Type: application/json' --data-raw '{\"name\":\"Ada\"}'",
      },
    });
    await user.click(
      screen.getByRole("button", { name: "Als Entwurf übernehmen" }),
    );

    expect(screen.getByLabelText("Request-URL")).toHaveValue(
      "https://api.example.com/customers/42",
    );
    expect(screen.getByLabelText("HTTP-Methode")).toHaveValue("PATCH");
    expect(
      screen.getByText("cURL wurde als Entwurf übernommen"),
    ).toBeInTheDocument();
  });

  it("lets a desktop user force local execution via the toggle", async () => {
    const user = userEvent.setup();
    executeAsync.mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "",
      durationMs: 10,
    });
    window.devapiDesktop = {
      executeLocalRequest: vi.fn(),
      platform: "win32",
    } as unknown as Window["devapiDesktop"];
    try {
      render(
        <RequestEditor
          requestId={request.id}
          workspaceId={request.workspaceId}
        />,
      );

      await user.selectOptions(
        screen.getByLabelText("Ausführungsweg"),
        "Lokal ausführen",
      );

      const form = screen.getByLabelText("Request-URL").closest("form")!;
      const executeButton = document.createElement("button");
      executeButton.type = "submit";
      executeButton.value = "execute";
      form.append(executeButton);
      await user.click(executeButton);

      await waitFor(() =>
        expect(executeAsync).toHaveBeenCalledWith(
          expect.objectContaining({ executionModeOverride: "local" }),
        ),
      );
    } finally {
      delete window.devapiDesktop;
    }
  });
});

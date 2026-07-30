import { describe, expect, it } from "vitest";

import {
  findUnresolvedVariables,
  listVariableReferences,
  resolveVariables,
  UnresolvedVariableError,
} from "./resolve-variables";

const environmentId = "a768f717-d11f-4ce0-a72b-8e1d439222b0";

describe("resolveVariables", () => {
  it("uses personal values as an override without changing shared data", () => {
    expect(
      resolveVariables("{{baseUrl}}/{{token}}", [
        {
          id: "e5c539a4-3fa9-4bc4-b6dc-acba97f1c9a3",
          environmentId,
          key: "baseUrl",
          value: "https://api.example.com",
          scope: "shared",
          version: 1,
        },
        {
          id: "b1eab850-761b-4530-9c4c-ee22c42d39bb",
          environmentId,
          key: "token",
          value: "shared-placeholder",
          scope: "shared",
          version: 1,
        },
        {
          id: "8f48a4d0-05e0-4cd2-bdbc-35c0a19a8bd8",
          environmentId,
          key: "token",
          value: "personal-secret",
          scope: "personal",
          version: 1,
        },
      ]),
    ).toBe("https://api.example.com/personal-secret");
  });

  it("fails before execution when variables are missing", () => {
    expect(() => resolveVariables("{{missing}}", [])).toThrow(
      UnresolvedVariableError,
    );
  });

  it("lists references once and identifies missing values", () => {
    expect(
      listVariableReferences("{{baseUrl}}/{{resource}}?again={{resource}}"),
    ).toEqual(["baseUrl", "resource"]);
    expect(
      findUnresolvedVariables(["{{baseUrl}}/{{missing}}"], [
        {
          id: "e5c539a4-3fa9-4bc4-b6dc-acba97f1c9a3",
          environmentId,
          key: "baseUrl",
          value: "https://api.example.com",
          scope: "shared",
          version: 1,
        },
      ]),
    ).toEqual(["missing"]);
  });
});

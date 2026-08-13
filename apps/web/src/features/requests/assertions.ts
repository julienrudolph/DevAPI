import type { Assertion } from "@api-client/contracts";

import {
  resolveJsonPath,
  stringifyExtractedValue,
  tryParseJson,
} from "../environments/json-path";

export interface AssertionResult {
  assertion: Assertion;
  passed: boolean;
  message: string;
}

export function evaluateAssertions(
  assertions: Assertion[],
  response: { status: number; body: string },
): AssertionResult[] {
  const parsedBody = tryParseJson(response.body);
  return assertions.map((assertion) =>
    evaluateAssertion(assertion, response.status, parsedBody),
  );
}

function evaluateAssertion(
  assertion: Assertion,
  status: number,
  parsedBody: unknown,
): AssertionResult {
  if (assertion.type === "status") {
    const passed =
      assertion.operator === "equals"
        ? status === assertion.expected
        : status !== assertion.expected;
    return {
      assertion,
      passed,
      message: passed
        ? `Status ist ${status}`
        : `Status ist ${status}, erwartet ${assertion.operator === "equals" ? "" : "nicht "}${assertion.expected}`,
    };
  }

  if (parsedBody === undefined) {
    return {
      assertion,
      passed: false,
      message: "Die Response ist kein gültiges JSON.",
    };
  }

  const resolution = resolveJsonPath(parsedBody, assertion.path);
  const actual = resolution.found
    ? stringifyExtractedValue(resolution.value)
    : undefined;

  switch (assertion.operator) {
    case "exists":
      return {
        assertion,
        passed: resolution.found,
        message: resolution.found
          ? `${assertion.path} existiert`
          : `${assertion.path} wurde nicht gefunden`,
      };
    case "notExists":
      return {
        assertion,
        passed: !resolution.found,
        message: !resolution.found
          ? `${assertion.path} existiert nicht`
          : `${assertion.path} wurde gefunden`,
      };
    case "equals": {
      const passed = resolution.found && actual === assertion.expected;
      return {
        assertion,
        passed,
        message: passed
          ? `${assertion.path} ist ${assertion.expected}`
          : `${assertion.path} ist ${actual ?? "nicht vorhanden"}, erwartet ${assertion.expected}`,
      };
    }
    case "notEquals": {
      const passed = resolution.found && actual !== assertion.expected;
      return {
        assertion,
        passed,
        message: passed
          ? `${assertion.path} ist nicht ${assertion.expected}`
          : `${assertion.path} ist ${assertion.expected}`,
      };
    }
    case "contains": {
      const passed =
        resolution.found &&
        actual !== undefined &&
        assertion.expected !== undefined &&
        actual.includes(assertion.expected);
      return {
        assertion,
        passed,
        message: passed
          ? `${assertion.path} enthält "${assertion.expected}"`
          : `${assertion.path} enthält "${assertion.expected}" nicht`,
      };
    }
    default:
      throw new Error("Unreachable assertion operator");
  }
}

import type { Assertion } from "@api-client/contracts";

import i18n from "../../lib/i18n";
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

function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, { ns: "requests", ...options });
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
        ? t("assertionMessages.statusPass", { status })
        : t(
            assertion.operator === "equals"
              ? "assertionMessages.statusFailEquals"
              : "assertionMessages.statusFailNotEquals",
            { status, expected: assertion.expected },
          ),
    };
  }

  if (parsedBody === undefined) {
    return {
      assertion,
      passed: false,
      message: t("assertionMessages.invalidJson"),
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
          ? t("assertionMessages.existsPass", { path: assertion.path })
          : t("assertionMessages.existsFail", { path: assertion.path }),
      };
    case "notExists":
      return {
        assertion,
        passed: !resolution.found,
        message: !resolution.found
          ? t("assertionMessages.notExistsPass", { path: assertion.path })
          : t("assertionMessages.notExistsFail", { path: assertion.path }),
      };
    case "equals": {
      const passed = resolution.found && actual === assertion.expected;
      return {
        assertion,
        passed,
        message: passed
          ? t("assertionMessages.equalsPass", {
              path: assertion.path,
              expected: assertion.expected,
            })
          : t("assertionMessages.equalsFail", {
              path: assertion.path,
              actual: actual ?? t("assertionMessages.noValue"),
              expected: assertion.expected,
            }),
      };
    }
    case "notEquals": {
      const passed = resolution.found && actual !== assertion.expected;
      return {
        assertion,
        passed,
        message: passed
          ? t("assertionMessages.notEqualsPass", {
              path: assertion.path,
              expected: assertion.expected,
            })
          : t("assertionMessages.notEqualsFail", {
              path: assertion.path,
              expected: assertion.expected,
            }),
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
          ? t("assertionMessages.containsPass", {
              path: assertion.path,
              expected: assertion.expected,
            })
          : t("assertionMessages.containsFail", {
              path: assertion.path,
              expected: assertion.expected,
            }),
      };
    }
    default:
      throw new Error("Unreachable assertion operator");
  }
}

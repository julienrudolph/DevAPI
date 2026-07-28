import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RequestEditor } from "./request-editor";

describe("RequestEditor", () => {
  it("shows a response after submitting a valid request", async () => {
    const user = userEvent.setup();
    render(<RequestEditor requestName="List customers" />);

    expect(
      screen.getByText("Sende den Request, um die Response hier zu sehen."),
    ).toBeInTheDocument();

    const form = screen.getByLabelText("Request-URL").closest("form");
    form?.dispatchEvent(new SubmitEvent("submit", { bubbles: true }));

    expect(await screen.findByText("200 OK")).toBeInTheDocument();
  });
});


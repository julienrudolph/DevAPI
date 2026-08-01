import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { Dialog, DialogFooter } from "./dialog";

describe("Dialog", () => {
  it("moves focus into the modal surface and closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <>
        <button type="button">Auslöser</button>
        <Dialog onClose={onClose} titleId="test-dialog-title">
          <h2 id="test-dialog-title">Testdialog</h2>
          <DialogFooter>
            <Button>Abbrechen</Button>
            <Button variant="primary">Speichern</Button>
          </DialogFooter>
        </Dialog>
      </>,
    );

    expect(screen.getByRole("dialog")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});

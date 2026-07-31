import { zodResolver } from "@hookform/resolvers/zod";
import {
  createWorkspaceSchema,
  type CreateWorkspace,
  type WorkspaceSummary,
} from "@api-client/contracts";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import { useCreateWorkspace } from "./workspace-queries";

export function WorkspaceCreateForm({ teamId }: { teamId?: string }) {
  const navigate = useNavigate();
  const mutation = useCreateWorkspace();
  const { formState, handleSubmit, register } = useForm<CreateWorkspace>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: teamId
      ? { teamId, workspaceName: "" }
      : { teamName: "", workspaceName: "" },
  });

  async function submit(input: CreateWorkspace) {
    const workspace: WorkspaceSummary = await mutation.mutateAsync(input);
    navigate(`/workspaces/${workspace.id}`);
  }

  return (
    <form className="creation-form" onSubmit={handleSubmit(submit)}>
      {teamId ? (
        <input type="hidden" {...register("teamId")} />
      ) : (
        <>
          <label htmlFor="team-name">Teamname</label>
          <input id="team-name" {...register("teamName")} />
          {"teamName" in formState.errors && formState.errors.teamName ? (
            <p className="field-error">
              {formState.errors.teamName.message}
            </p>
          ) : null}
        </>
      )}
      <label htmlFor="workspace-name">Workspace-Name</label>
      <input id="workspace-name" {...register("workspaceName")} />
      {formState.errors.workspaceName ? (
        <p className="field-error">{formState.errors.workspaceName.message}</p>
      ) : null}
      <button
        className="button primary"
        disabled={mutation.isPending}
        type="submit"
      >
        Workspace erstellen
      </button>
      {mutation.isError ? (
        <p className="field-error">Workspace konnte nicht erstellt werden.</p>
      ) : null}
    </form>
  );
}

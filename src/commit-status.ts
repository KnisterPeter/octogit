import { URL } from "url";
import { Branch, Commit, Octogit } from "./index";

export function status(
  octogit: Octogit,
  context: string,
  target: Commit | Branch
) {
  let ref: string;
  ref = target.sha;

  return {
    async get(): Promise<{
      context: string;
      state?: string;
      description?: string | undefined;
      targetUrl?: URL | undefined;
    }> {
      const { data } = await octogit.octokit.repos.listCommitStatusesForRef({
        ...octogit.ownerAndRepo,
        ref,
      });

      const status = data.find((status) => status.context === context);
      if (!status) {
        return {
          context,
        };
      }

      return {
        context,
        state: status.state,
        description: status.description,
        targetUrl: status.target_url ? new URL(status.target_url) : undefined,
      };
    },
    async error({
      description,
      targetUrl,
    }: {
      description?: string;
      targetUrl?: URL;
    }) {
      return createStatus(octogit, ref, {
        status: "error",
        context,
        description,
        targetUrl,
      });
    },
    async failure({
      description,
      targetUrl,
    }: {
      description?: string;
      targetUrl?: URL;
    }) {
      return createStatus(octogit, ref, {
        status: "failure",
        context,
        description,
        targetUrl,
      });
    },
    async pending({
      description,
      targetUrl,
    }: {
      description?: string;
      targetUrl?: URL;
    }) {
      return createStatus(octogit, ref, {
        status: "pending",
        context,
        description,
        targetUrl,
      });
    },
    async success({
      description,
      targetUrl,
    }: {
      description?: string;
      targetUrl?: URL;
    }) {
      return createStatus(octogit, ref, {
        status: "success",
        context,
        description,
        targetUrl,
      });
    },
  };
}

async function createStatus(
  octogit: Octogit,
  sha: string,
  status: {
    status: "error" | "failure" | "pending" | "success";
    context?: string;
    description?: string;
    targetUrl?: URL;
  }
): Promise<void> {
  const { status: state, context, description, targetUrl } = status;

  await octogit.octokit.repos.createCommitStatus({
    ...octogit.ownerAndRepo,
    sha,
    state,
    context,
    description,
    target_url: targetUrl?.toString(),
  });
}

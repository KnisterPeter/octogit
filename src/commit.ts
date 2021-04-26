import { URL } from "url";
import { Octogit } from "./index";

export class Commit {
  public get sha(): string {
    return this.data.sha;
  }

  public get message(): string {
    return this.data.message;
  }

  /**
   * @internal
   */
  private octogit: Octogit;

  /**
   * @internal
   */
  private data: {
    sha: string;
    message: string;
    author?: string;
    committer?: string;
  };

  /**
   * @internal
   */
  constructor(
    octogit: Octogit,
    data: {
      sha: string;
      message: string;
      author?: string;
      committer?: string;
    }
  ) {
    this.octogit = octogit;
    this.data = data;
  }

  public status(context: string) {
    const outer = this;

    return {
      async get(): Promise<{
        context: string;
        state?: string;
        description?: string | undefined;
        targetUrl?: URL | undefined;
      }> {
        const {
          data,
        } = await outer.octogit.octokit.repos.listCommitStatusesForRef({
          ...outer.octogit.ownerAndRepo,
          ref: outer.sha,
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
        return outer.#status({
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
        return outer.#status({
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
        return outer.#status({
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
        return outer.#status({
          status: "success",
          context,
          description,
          targetUrl,
        });
      },
    };
  }

  #status = async (status: {
    status: "error" | "failure" | "pending" | "success";
    context?: string;
    description?: string;
    targetUrl?: URL;
  }) => {
    const { status: state, context, description, targetUrl } = status;

    await this.octogit.octokit.repos.createCommitStatus({
      ...this.octogit.ownerAndRepo,
      sha: this.sha,
      state,
      context,
      description,
      target_url: targetUrl?.toString(),
    });
  };
}

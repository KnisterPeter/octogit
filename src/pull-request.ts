import { Octogit } from "./index";

export class PullRequest {
  /**
   * @internal
   */
  constructor(private octogit: Octogit, public number: number) {}

  public async isMerged(): Promise<boolean> {
    try {
      await this.octogit.octokit.pulls.checkIfMerged({
        ...this.octogit.ownerAndRepo,
        pull_number: this.number,
      });
      return true;
    } catch {
      return false;
    }
  }

  public get merge() {
    const outer = this;

    return {
      async merge() {
        return outer.#merge("merge");
      },
      async squash() {
        return outer.#merge("squash");
      },
      async rebase() {
        return outer.#merge("rebase");
      },
    };
  }

  #merge = async (method: "merge" | "squash" | "rebase"): Promise<void> => {
    const { data } = await this.octogit.octokit.pulls.merge({
      ...this.octogit.ownerAndRepo,
      pull_number: this.number,
      merge_method: method,
    });

    if (!data.merged) {
      throw new Error(`Failed to merge: ${data.message}`);
    }
  };

  public async update({
    title,
    body,
  }: {
    title?: string;
    body?: string;
  }): Promise<void> {
    await this.octogit.octokit.pulls.update({
      ...this.octogit.ownerAndRepo,
      pull_number: this.number,
      title,
      body,
    });
  }

  public async close(): Promise<void> {
    await this.octogit.octokit.pulls.update({
      ...this.octogit.ownerAndRepo,
      pull_number: this.number,
      state: "closed",
    });
  }
}

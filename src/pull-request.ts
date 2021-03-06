import { Octokit } from "@octokit/rest";
import { changedFiles, file } from "./files";
import { Branch, Commit, Octogit } from "./index";
import { create as createTimelineEvent } from "./timeline-event";

type Awaited<T> = T extends Promise<infer U> ? U : never;

export type TimelineItems = Awaited<
  ReturnType<Octokit["issues"]["listEventsForTimeline"]>
>["data"];

/**
 * @internal
 */
export interface PullRequestData {
  number: number;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

export class PullRequest {
  /**
   * @internal
   */
  static create(octogit: Octogit, data: PullRequestData): PullRequest {
    const pr = new PullRequest(octogit, data.number);
    pr.setFromData(data);
    return pr;
  }

  /**
   * @internal
   */
  static async load(octogit: Octogit, number: number): Promise<PullRequest> {
    const pr = new PullRequest(octogit, number);
    await pr.refresh();
    return pr;
  }

  #data?: PullRequestData;

  public get head(): Branch {
    if (!this.#data) {
      throw new Error("Refresh required");
    }
    const { ref, sha } = this.#data.head;
    return Branch.create(this.octogit, ref, sha);
  }

  public get base(): Branch {
    if (!this.#data) {
      throw new Error("Refresh required");
    }
    const { ref, sha } = this.#data.base;
    return Branch.create(this.octogit, ref, sha);
  }

  /**
   * @internal
   */
  private octogit: Octogit;

  /**
   * @internal
   */
  private constructor(octogit: Octogit, public number: number) {
    this.octogit = octogit;
  }

  /**
   * @internal
   */
  private setFromData(data: PullRequestData): void {
    this.#data = data;
  }

  public async refresh(): Promise<void> {
    const { data } = await this.octogit.octokit.pulls.get({
      ...this.octogit.ownerAndRepo,
      pull_number: this.number,
    });

    this.#data = data;
  }

  public async getCommits(): Promise<Commit[]> {
    const { data } = await this.octogit.octokit.pulls.listCommits({
      ...this.octogit.ownerAndRepo,
      pull_number: this.number,
    });

    return data.map(
      (commit) =>
        new Commit(this.octogit, {
          author: commit.author?.login,
          committer: commit.committer?.login,
          message: commit.commit.message,
          sha: commit.sha,
        })
    );
  }

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
    base,
    maintainerCanModify,
    state,
  }: {
    title?: string;
    body?: string;
    base?: Branch;
    maintainerCanModify?: boolean;
    state?: "open" | "closed";
  }): Promise<void> {
    const { data } = await this.octogit.octokit.pulls.update({
      ...this.octogit.ownerAndRepo,
      pull_number: this.number,
      title,
      body,
      base: base?.remoteName,
      maintainer_can_modify: maintainerCanModify,
      state,
    });

    this.setFromData(data);
  }

  public async labels() {
    return this.octogit.octokit.paginate(
      this.octogit.octokit.issues.listLabelsOnIssue,
      {
        ...this.octogit.ownerAndRepo,
        issue_number: this.number,
        per_page: 100,
      }
    );
  }

  public label(name: string) {
    const outer = this;
    return {
      async add() {
        const { data: labels } = await outer.octogit.octokit.issues.addLabels({
          ...outer.octogit.ownerAndRepo,
          issue_number: outer.number,
          labels: [name],
        });
        return labels;
      },
      async remove() {
        const { data: labels } = await outer.octogit.octokit.issues.removeLabel(
          {
            ...outer.octogit.ownerAndRepo,
            issue_number: outer.number,
            name,
          }
        );
        return labels;
      },
    };
  }

  public async files(): Promise<string[]> {
    return changedFiles(this.octogit, this.base, this.head);
  }

  public async file(path: string): Promise<string> {
    return file(this.octogit, this.head, path);
  }

  public async getTimelineEvents() {
    const items = await this.octogit.octokit.paginate(
      this.octogit.octokit.issues.listEventsForTimeline,
      {
        ...this.octogit.ownerAndRepo,
        issue_number: this.number,
        per_page: 100,
      }
    );

    return items.map((item) => createTimelineEvent(this.octogit, item));
  }

  public async close(): Promise<void> {
    await this.update({
      state: "closed",
    });
  }
}

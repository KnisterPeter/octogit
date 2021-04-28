import { Octogit, PullRequest } from "./index";

export class Branch {
  /**
   * @internal
   */
  public static create(octogit: Octogit, name: string, sha?: string): Branch {
    const branch = new Branch(octogit, name);
    if (sha) {
      branch.setFromData(sha);
    }
    return branch;
  }

  /**
   * @internal
   */
  public static async fetch(octogit: Octogit, name: string): Promise<Branch> {
    const branch = new Branch(octogit, name);
    return branch;
  }

  /**
   * @internal
   */
  private get nameWithTestId(): string {
    if (this.name === this.octogit.defaultBranch) {
      return this.name;
    }

    if (this.octogit.options.testId) {
      return `${this.octogit.options.testId}-${this.name}`;
    }

    return this.name;
  }

  public name: string;

  #sha?: string;

  public get sha(): string {
    if (!this.#sha) {
      throw new Error("Refresh required");
    }
    return this.#sha;
  }

  /**
   * @internal
   */
  private octogit: Octogit;

  /**
   * @internal
   */
  private constructor(octogit: Octogit, name: string) {
    this.octogit = octogit;
    if (
      octogit.options.testId &&
      name.startsWith(octogit.options.testId + "-")
    ) {
      this.name = name.substr(octogit.options.testId.length + 1);
    } else {
      this.name = name;
    }
  }

  /**
   * @internal
   */
  private setFromData(sha: string): void {
    this.#sha = sha;
  }

  public async refresh(): Promise<void> {
    const summary = await this.octogit.git.branch();
    const name = `remotes/origin/${this.nameWithTestId}`;
    if (name in summary.branches) {
      this.#sha = summary.branches[name]?.commit;
    } else {
      this.#sha = undefined;
    }
  }

  public async exists(): Promise<boolean> {
    await this.refresh();
    return this.#sha !== undefined;
  }

  public async crate(): Promise<void> {
    await this.octogit.git.checkout(["-b", this.name]);
    await this.octogit.git.push([
      "--set-upstream",
      "origin",
      `${this.name}:${this.nameWithTestId}`,
    ]);
  }

  public async delete(): Promise<void> {
    if (this.octogit.defaultBranch) {
      await this.octogit.git.checkout(this.octogit.defaultBranch);
    }

    await this.octogit.git.deleteLocalBranch(this.name, true);
    await this.octogit.git.push(["--delete", "origin", this.nameWithTestId]);
  }

  public async addAndCommit(message: string): Promise<void> {
    await this.octogit.git.add(".");
    await this.octogit.git.commit(message);
  }

  public async push(): Promise<void> {
    await this.octogit.git.push(["origin", `HEAD:${this.nameWithTestId}`]);
  }

  public async cratePullRequest({
    base,
    title,
    body,
  }: {
    base: Branch;
    title: string;
    body?: string;
  }): Promise<PullRequest> {
    const { data } = await this.octogit.octokit.pulls.create({
      ...this.octogit.ownerAndRepo,
      base: base.nameWithTestId,
      head: this.nameWithTestId,
      title,
      body,
    });

    return PullRequest.create(this.octogit, data);
  }
}

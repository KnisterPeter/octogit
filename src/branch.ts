import { status as commitStatus } from "./commit-status";
import { changedFiles, file } from "./files";
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

  public get remoteName(): string {
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
    const git = await this.octogit.git;
    const summary = await git.branch();
    const name = `remotes/origin/${this.remoteName}`;
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

  public async checkout(): Promise<void> {
    const git = await this.octogit.git;
    await git.fetch();
    await git.checkout([this.name]);
    await git.pull(["--rebase"]);
  }

  public async create(): Promise<void> {
    const git = await this.octogit.git;
    await git.checkout(["-b", this.name]);
    await git.push([
      "--set-upstream",
      "origin",
      `${this.name}:${this.remoteName}`,
    ]);
  }

  public async delete(): Promise<void> {
    const git = await this.octogit.git;
    await git.checkout(this.octogit.defaultBranch);
    await git.deleteLocalBranch(this.name, true);
    await git.push(["--delete", "origin", this.remoteName]);
  }

  public async addAndCommit(message: string): Promise<void> {
    const git = await this.octogit.git;
    await git.add(".");
    await git.commit(message);
  }

  public async push(): Promise<void> {
    const git = await this.octogit.git;
    await git.push(["origin", `HEAD:${this.remoteName}`]);
  }

  public async createPullRequest({
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
      base: base.remoteName,
      head: this.remoteName,
      title,
      body,
    });

    return PullRequest.create(this.octogit, data);
  }

  public status(context: string) {
    return commitStatus(this.octogit, context, this);
  }

  public async files(other: Branch) {
    return changedFiles(this.octogit, other, this);
  }

  public async file(path: string) {
    return file(this.octogit, this, path);
  }
}

import { Octogit, PullRequest } from "./index";

export class Branch {
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

  /**
   * @internal
   */
  constructor(private octogit: Octogit, public name: string) {}

  public async exists(): Promise<boolean> {
    const summary = await this.octogit.git.branch();

    return summary.all.includes(`remotes/origin/${this.nameWithTestId}`);
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

    return new PullRequest(this.octogit, data.number);
  }
}

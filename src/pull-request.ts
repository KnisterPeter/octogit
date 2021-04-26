import { Octogit } from "./index";

export class PullRequest {
  /**
   * @internal
   */
  constructor(private octogit: Octogit, public number: number) {}

  public async close(): Promise<void> {
    await this.octogit.octokit.pulls.update({
      ...this.octogit.ownerAndRepo,
      pull_number: this.number,
      state: "closed",
    });
  }
}

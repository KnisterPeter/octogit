import { status as commitStatus } from "./commit-status";
import { Octogit } from "./index";

export class Commit {
  public get sha(): string {
    return this.data.sha;
  }

  public get message(): string {
    return this.data.message;
  }

  public get author(): string | undefined {
    return this.data.author;
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
    return commitStatus(this.octogit, context, this);
  }
}

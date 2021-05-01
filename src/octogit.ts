import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";
import { promises as fsp } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import Git, { SimpleGit } from "simple-git";
import { URL } from "url";
import { Branch, PullRequest } from "./index";

export interface OctogitOptions {
  /**
   * Github token which is authorized to do all required operations.
   */
  token: string;
  /**
   * The github url to talk to (default to https://api.github.com)
   */
  baseUrl?: string;
  /**
   * Repository owner
   */
  owner: string;
  /**
   * Repository name
   */
  repo: string;
  /**
   * A testing helper
   * @internal
   */
  testId?: string;
}

export class Octogit {
  static async create(options: OctogitOptions): Promise<Octogit> {
    const baseDir = await fsp.mkdtemp(join(tmpdir(), "octogit"));
    const octogit = new Octogit(baseDir, options);

    const {
      data: { default_branch, clone_url },
    } = await octogit.octokit.repos.get({
      ...octogit.ownerAndRepo,
    });
    const url = new URL(clone_url);
    url.username = "x-access-token";
    url.password = octogit.options.token;
    octogit.#cloneUrl = url;
    octogit.defaultBranch = default_branch;

    return octogit;
  }

  #cloneUrl: URL;

  /**
   * @internal
   */
  public defaultBranch: string;

  #git?: SimpleGit;

  public get git(): Promise<SimpleGit> {
    return this.clone();
  }

  #octokit?: Octokit;

  public get octokit(): Octokit {
    if (this.#octokit) {
      return this.#octokit;
    }

    const PluggedOctokit = Octokit.plugin(throttling);

    this.#octokit = new PluggedOctokit({
      auth: this.options.token,
      baseUrl: this.options.baseUrl ?? undefined,
      throttle: {
        onRateLimit: (
          retryAfter: number,
          options: {
            method: string;
            url: string;
            request: { retryCount: number };
          }
        ) => {
          this.octokit.log.warn(
            `Request quota exhausted for request ${options.method} ${options.url}`
          );

          if (options.request.retryCount === 0) {
            this.octokit.log.info(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
          return false;
        },
        onAbuseLimit: (
          _: number,
          options: {
            method: string;
            url: string;
          }
        ) => {
          this.octokit.log.warn(
            `Abuse detected for request ${options.method} ${options.url}`
          );
        },
      },
      previews: ["mockingbird"],
    });
    return this.#octokit;
  }

  public get ownerAndRepo(): { owner: string; repo: string } {
    return {
      owner: this.options.owner,
      repo: this.options.repo,
    };
  }

  /**
   * @internal
   */
  public options: OctogitOptions;

  /**
   * @internal
   */
  private constructor(public directory: string, options: OctogitOptions) {
    this.options = options;
    this.defaultBranch = "";
    this.#cloneUrl = new URL("proto:");
  }

  /**
   * @internal
   */
  private async clone(): Promise<SimpleGit> {
    if (this.#git) {
      return this.#git;
    }

    this.#git = Git({
      baseDir: this.directory,
      maxConcurrentProcesses: 1,
    });

    await this.#git.clone(this.#cloneUrl.toString(), ".", {
      "--filter": "blob:none",
    });

    return this.#git;
  }

  public getBranch(name: string): Branch {
    return Branch.create(this, name);
  }

  public async getPullRequest(number: number): Promise<PullRequest> {
    return PullRequest.load(this, number);
  }

  public async dispose(): Promise<void> {
    await fsp.rm(this.directory, { force: true, recursive: true });
  }
}

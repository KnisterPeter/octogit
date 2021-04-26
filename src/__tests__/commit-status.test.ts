import dotenv from "dotenv";
import { promises as fsp } from "fs";
import { customAlphabet } from "nanoid";
import { join } from "path";
import { URL } from "url";
import { Branch, Octogit, PullRequest } from "../index";

// Give the test 5 minutes
jest.setTimeout(1000 * 60 * 5);

describe("with Octogit commit status", () => {
  const owner = "KnisterPeter";
  const repo = "octogit-test";
  let octogit: Octogit;
  let testId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6)();
  let branch: Branch;
  let pr: PullRequest;

  beforeAll(async () => {
    dotenv.config();

    const token = process.env["TOKEN"];
    if (!token) {
      throw new Error("Missing required env-var TOKEN");
    }

    octogit = await Octogit.create({
      token,
      owner,
      repo,
      testId,
    });

    branch = octogit.getBranch("branch");
    await branch.crate();
    await fsp.writeFile(join(octogit.directory, "test.txt"), "content");
    await branch.addAndCommit("some changes");
    await branch.push();

    pr = await branch.cratePullRequest({
      base: octogit.getBranch("main"),
      title: `${testId} title`,
    });
  });

  afterAll(async () => {
    await pr.close();
    await branch.delete();
    await octogit.dispose();
  });

  describe.each([testId])("[%s] it should be possible to", () => {
    it("add a commit status", async () => {
      const [commit] = await pr.getCommits();
      if (!commit) {
        throw new Error(`Unable to list commits for pr ${pr.number}`);
      }

      const data = {
        description: "description",
        targetUrl: new URL("http://localhost"),
      };

      await commit.status(`ctx/error`).error(data);
      await commit.status(`ctx/failure`).failure(data);
      await commit.status(`ctx/pending`).pending(data);
      await commit.status(`ctx/success`).success(data);

      const {
        data: status,
      } = await octogit.octokit.repos.listCommitStatusesForRef({
        ...octogit.ownerAndRepo,
        ref: commit.sha,
      });

      expect(status).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            context: "ctx/error",
            state: "error",
            description: "description",
            target_url: "http://localhost/",
          }),
          expect.objectContaining({
            context: "ctx/failure",
            state: "failure",
            description: "description",
            target_url: "http://localhost/",
          }),
          expect.objectContaining({
            context: "ctx/pending",
            state: "pending",
            description: "description",
            target_url: "http://localhost/",
          }),
          expect.objectContaining({
            context: "ctx/success",
            state: "success",
            description: "description",
            target_url: "http://localhost/",
          }),
        ])
      );
    });

    it("return a commit status", async () => {
      const [commit] = await pr.getCommits();
      if (!commit) {
        throw new Error(`Unable to list commits for pr ${pr.number}`);
      }

      const status = await commit.status(`ctx/error`).get();

      expect(status).toEqual(
        expect.objectContaining({
          context: "ctx/error",
          state: "error",
          description: "description",
          targetUrl: new URL("http://localhost/"),
        })
      );
    });
  });
});

import { config as dotenv } from "dotenv";
import { promises as fsp } from "fs";
import { customAlphabet } from "nanoid";
import { join } from "path";
import { Branch, Octogit } from "../index";

// Give the test 5 minutes
jest.setTimeout(1000 * 60 * 5);

describe("with Octogit Branch", () => {
  const owner = "KnisterPeter";
  const repo = "octogit-test";
  let octogit: Octogit;
  let testId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6)();

  beforeAll(async () => {
    dotenv();

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
  });

  afterAll(async () => {
    await octogit.dispose();
  });

  describe(`[${testId}] it should be possible to`, () => {
    let branch: Branch;

    it("create a branch", async () => {
      branch = octogit.getBranch("branch");
      await branch.create();

      const summary = await octogit.git.branch();
      expect(summary.all).toEqual(expect.arrayContaining([branch.name]));
    });

    it("check existence of a branch", async () => {
      expect(
        await octogit.getBranch("non-existent-branch").exists()
      ).toBeFalsy();
      expect(await branch.exists()).toBeTruthy();
    });

    it("add and commit changes", async () => {
      await fsp.writeFile(join(octogit.directory, "file.txt"), "content");
      await branch.addAndCommit("add a new file");
      await branch.push();

      const { data } = await octogit.octokit.repos.getContent({
        owner,
        repo,
        ref: `${testId}-${branch.name}`,
        path: "file.txt",
      });

      expect(data).toHaveProperty("content");
      if (!("content" in data)) {
        throw new Error("invalid state");
      }

      const content = Buffer.from(data["content"], "base64").toString("utf-8");
      expect(content).toBe("content");
    });

    it("create a pull request", async () => {
      const pr = await branch.createPullRequest({
        base: octogit.getBranch("main"),
        title: `${testId} title`,
        body: "body",
      });

      const maxWait = Date.now() + 1000 * 60;
      while (true) {
        try {
          await octogit.git.fetch(
            "origin",
            `pull/${pr.number}/head:${testId}-${branch.name}`
          );
          break;
        } catch {
          if (Date.now() > maxWait) {
            throw new Error(`Timeout waiting for ${pr.number}`);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000 * 10));
        }
      }
      const summary = await octogit.git.branchLocal();
      expect(summary.all).toEqual(
        expect.arrayContaining([`${testId}-${branch.name}`])
      );

      await pr.close();
    });

    it("delete a branch", async () => {
      await branch.delete();

      expect((await octogit.git.branch()).all).toEqual(
        expect.not.arrayContaining([branch.name])
      );
    });
  });
});

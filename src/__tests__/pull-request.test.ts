import dotenv from "dotenv";
import { promises as fsp } from "fs";
import { customAlphabet } from "nanoid";
import { join } from "path";
import { Branch, Octogit, PullRequest } from "../index";

// Give the test 5 minutes
jest.setTimeout(1000 * 60 * 5);

describe("with Octogit PullRequest", () => {
  const owner = "KnisterPeter";
  const repo = "octogit-test";
  let octogit: Octogit;
  let testId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6)();
  let branch: Branch;

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
    await fsp.writeFile(join(octogit.directory, "file.txt"), "content");
    await branch.addAndCommit("some changes");
    await branch.push();
  });

  afterAll(async () => {
    await branch.delete();
    await octogit.dispose();
  });

  describe.each([testId])("[%s] it should be possible to", () => {
    let pr: PullRequest;

    it("create a pull request", async () => {
      pr = await branch.cratePullRequest({
        base: octogit.getBranch("main"),
        title: `${testId} title`,
      });

      const { data } = await octogit.octokit.pulls.get({
        ...octogit.ownerAndRepo,
        pull_number: pr.number,
      });

      expect(data.state).toBe("open");
    });

    it("check the pull request merge status", async () => {
      const isMerged = await pr.isMerged();

      expect(isMerged).toBeFalsy();
    });

    it.each(["merge", "squash", "rebase"])(
      "merge (%s) a pull request",
      async (method) => {
        const anotherBranch = octogit.getBranch(`another-branch-${method}`);
        await anotherBranch.crate();
        await fsp.writeFile(
          join(octogit.directory, `file-${method}.txt`),
          "content"
        );
        await anotherBranch.addAndCommit(`some other changes (${method})`);
        await anotherBranch.push();

        const anotherPr = await anotherBranch.cratePullRequest({
          base: branch,
          title: `${testId} another title (${method})`,
        });

        switch (method) {
          case "merge":
            await anotherPr.merge.merge();
            break;
          case "squash":
            await anotherPr.merge.squash();
            break;
          case "rebase":
            await anotherPr.merge.rebase();
            break;
        }

        const isMerged = await anotherPr.isMerged();

        expect(isMerged).toBeTruthy();
      }
    );

    it("update a pull request", async () => {
      await pr.update({
        title: `${testId} updated title`,
        body: "updated body",
      });

      const { data } = await octogit.octokit.pulls.get({
        ...octogit.ownerAndRepo,
        pull_number: pr.number,
      });

      expect(data.title).toBe(`${testId} updated title`);
      expect(data.body).toBe("updated body");
    });

    it("load an existing pull request", async () => {
      const loaded = await octogit.getPullRequest(pr.number);

      expect(loaded.base).toEqual(
        expect.objectContaining(octogit.getBranch("main"))
      );
      expect(loaded.head).toEqual(expect.objectContaining(branch));
    });

    it("close a pull request", async () => {
      await pr.close();

      const { data } = await octogit.octokit.pulls.get({
        ...octogit.ownerAndRepo,
        pull_number: pr.number,
      });

      expect(data.state).toBe("closed");
    });
  });
});

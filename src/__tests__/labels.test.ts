import { config as dotenv } from "dotenv";
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

    branch = octogit.getBranch("branch");
    await branch.create();
    await fsp.writeFile(join(octogit.directory, "file.txt"), "content");
    await branch.addAndCommit("some changes");
    await branch.push();
  });

  afterAll(async () => {
    await branch.delete();
    await octogit.dispose();
  });

  describe(`[${testId}] it should be possible to`, () => {
    let pr: PullRequest;

    beforeAll(async () => {
      pr = await branch.createPullRequest({
        base: octogit.getBranch("main"),
        title: `${testId} title`,
      });
    });

    afterAll(async () => {
      await pr.close();
    });

    it("add a label", async () => {
      const added = await pr.label("issue").add();

      expect(added).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "issue" })])
      );
    });

    it("list current labels", async () => {
      const labels = await pr.labels();
      expect(labels).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "issue",
          }),
        ])
      );
    });

    it("remove a label", async () => {
      const removed = await pr.label("issue").remove();

      expect(removed).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "issue" })])
      );
    });
  });
});
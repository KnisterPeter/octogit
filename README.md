# octogit

A wrapper library to interact with github projects.

It uses [octokit](https://github.com/octokit) and [git](https://git-scm.com/)
under the hood.

## Why?

octokit is a very nice, up to date and generated wrapper for the
[GitHub API](https://docs.github.com/en/rest) but there are a few things
missing.

- There are no rebases for pull requests
- Large parts of the GitHub API feels (are?) eventual consistent while git is not

To mitigate these, we do use git in combination with the Github APIs to
work around. That means we try to use as much as possible with low-level
git APIs (through the awesome [simple-git](https://github.com/steveukx/git-js)
library) and only handle higher or easier integration with the GitHub APIs.

## Usage

```ts
import { Octogit } from "octogit";
import { promises as fsp } from "fs";
import { join } from "path";

const octogit = await Octogit.create({
  token: "e.g. github personal access token",
  owner: "octocat",
  repo: "hello-world",
});

const branch = octogit.getBranch("some-branch");
await branch.crate();
await fsp.writeFile(join(octogit.directory, 'some-file.txt'), 'some content'));
await branch.addAndCommit("Commit message...");
await branch.push();

const pr = await branch.createPullRequest({
  base: octogit.getBranch("main"),
  title: `Pull Request Title...`,
});

await pr.merge.merge();
```

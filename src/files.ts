import { Branch, Commit, Octogit } from "./index";

export async function changedFiles(
  octogit: Octogit,
  from: Branch,
  to: Branch
): Promise<string[]> {
  const git = await octogit.git;
  await git.fetch();

  const log = await git.raw(
    "log",
    `origin/${from.remoteName}..origin/${to.remoteName}`,
    { "--format": "", "--name-only": null }
  );

  return log.trim().split("\n");
}

export async function file(
  octogit: Octogit,
  ref: Branch | Commit,
  path: string
): Promise<string> {
  const git = await octogit.git;
  await git.fetch();

  if (ref instanceof Branch) {
    return await git.show(`origin/${ref.remoteName}:${path}`);
  }

  return await git.show(`${ref.sha}:${path}`);
}

import { Commit, Octogit, PullRequest } from "./index";
import { PullRequestData, TimelineItems } from "./pull-request";

export interface CommittedTimelineEvent {
  event: "committed";
  commit: Commit;
}

export interface RenamedTimelineEvent {
  event: "renamed";
  from: string;
  to: string;
}

export interface LabeledTimelineEvent {
  event: "labeled";
  label: string;
}

export interface UnlabeledTimelineEvent {
  event: "unlabeled";
  label: string;
}

export interface CrossReferencedTimelineEvent {
  event: "cross-referenced";
  issue: PullRequest;
}

export type TimelineEvent =
  | CommittedTimelineEvent
  | RenamedTimelineEvent
  | LabeledTimelineEvent
  | UnlabeledTimelineEvent
  | CrossReferencedTimelineEvent;

export function create(
  octogit: Octogit,
  item: TimelineItems[number]
): TimelineEvent {
  switch (item.event) {
    case "committed": {
      const commitItem = item as typeof item & {
        author?: { name: string };
        committer?: { name: string };
      };

      return {
        event: "committed",
        commit: new Commit(octogit, {
          sha: commitItem.sha,
          message: commitItem.message,
          author: commitItem.author?.name,
          committer: commitItem.committer?.name,
        }),
      };
    }
    case "renamed": {
      const renamedItem = item as typeof item & {
        rename: { from: string; to: string };
      };

      return {
        event: "renamed",
        from: renamedItem.rename.from,
        to: renamedItem.rename.to,
      };
    }
    case "labeled": {
      const labeledItem = item as typeof item & { label: { name: string } };

      return {
        event: "labeled",
        label: labeledItem.label.name,
      };
    }
    case "unlabeled": {
      const unlabeledItem = item as typeof item & { label: { name: string } };

      return {
        event: "unlabeled",
        label: unlabeledItem.label.name,
      };
    }
    case "cross-referenced": {
      const crossReferencedItem = item as typeof item & {
        source: { type: "issue"; issue: PullRequestData };
      };

      if (crossReferencedItem.source.type !== "issue") {
        throw new Error(
          `Unknown cross-reference ${crossReferencedItem.source.type}`
        );
      }

      return {
        event: "cross-referenced",
        issue: PullRequest.create(octogit, crossReferencedItem.source.issue),
      };
    }
    default:
      throw new Error(`Unknown event ${item.event}`);
  }
}

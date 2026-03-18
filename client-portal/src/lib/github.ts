/**
 * GitHub API helper — server-side only.
 *
 * Token and repo are loaded from Supabase Vault at runtime:
 *   github_token              — personal access token or fine-grained PAT
 *   github_client_portal_repo — e.g. "dondada876/asi360-client-portal"
 *
 * Trail: portal request → VTiger case → GitHub issue → code fix
 */

import { loadSecrets } from "@/lib/vault"

export interface GitHubIssue {
  number: number
  html_url: string
  title: string
  state: string
}

export interface CreateIssueParams {
  title: string
  body: string
  labels?: string[]
}

/**
 * Create a GitHub issue in the configured repo.
 * Returns the issue number and URL so they can be stored on the portal request.
 */
export async function createGitHubIssue(
  params: CreateIssueParams
): Promise<GitHubIssue> {
  const secrets = await loadSecrets([
    "github_token",
    "github_client_portal_repo",
  ])

  const token = secrets["github_token"]
  const repo = secrets["github_client_portal_repo"] // e.g. "dondada876/asi360-client-portal"

  if (!token || !repo) {
    throw new Error(
      "GitHub credentials not configured in vault — add github_token and github_client_portal_repo"
    )
  }

  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: params.title,
      body: params.body,
      labels: params.labels || [],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GitHub API ${response.status}: ${errorText}`)
  }

  const issue = (await response.json()) as GitHubIssue
  return issue
}

/**
 * Build a formatted issue body from a portal request.
 * Keeps the trail readable for developers.
 */
export function buildIssueBody(params: {
  requestId: string
  requestType: string
  projectName: string
  projectId: number
  description: string
  urgency: string
  vtigerCaseNo?: string | null
  extraFields?: Record<string, string | null | undefined>
}): string {
  const { requestId, requestType, projectName, projectId, description, urgency, vtigerCaseNo, extraFields } = params

  const lines: string[] = [
    `## Portal Request`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| **Project** | ${projectName} (ID: ${projectId}) |`,
    `| **Request Type** | ${requestType.replace(/_/g, " ")} |`,
    `| **Urgency** | ${urgency} |`,
    `| **Portal Request ID** | \`${requestId}\` |`,
  ]

  if (vtigerCaseNo) {
    lines.push(`| **VTiger Case** | ${vtigerCaseNo} |`)
  }

  if (extraFields) {
    for (const [key, val] of Object.entries(extraFields)) {
      if (val) lines.push(`| **${key}** | ${val} |`)
    }
  }

  lines.push(
    ``,
    `## Client Description`,
    ``,
    description,
    ``,
    `---`,
    `*Auto-created from the ASI360 Client Portal. ` +
      `This issue was opened because a client reported a ${urgency}-urgency ${requestType.replace(/_/g, " ")} ` +
      `that may indicate a bug or system failure requiring a code or configuration fix.*`
  )

  return lines.join("\n")
}

#!/usr/bin/env python3
"""
Site Factory Engine 2.0 — CLI Orchestrator

Chains all 4 stages: CATALOG → MATCH → PROCESS → DEPLOY

Usage:
    # Individual stages
    python engine.py scan   --template electrician-company [--site sandbox] [--page home]
    python engine.py match  --template electrician-company --brief briefs/client.yaml
    python engine.py process --job 1
    python engine.py deploy  --job 1 [--dry-run]

    # Full pipeline
    python engine.py full --template electrician-company --brief briefs/client.yaml [--dry-run]

    # Status
    python engine.py status --job 1
    python engine.py list
"""

from __future__ import annotations

import argparse
import json
import sys
import time

from config import DEFAULT_SITE, WP_SITES


def cmd_scan(args):
    from scanner import scan_template
    scan_template(args.site, args.template, args.page)


def cmd_match(args):
    from matcher import match_brief
    job = match_brief(args.template, args.brief, args.site)
    if job:
        print(f"✅ Next step: python engine.py process --job {job['id']}")


def cmd_process(args):
    from processor import process_job
    staging = process_job(args.job)
    if staging:
        print(f"✅ Next step: python engine.py deploy --job {args.job}")


def cmd_deploy(args):
    from deployer import deploy_job
    deploy_job(args.job, args.site, args.dry_run)


def cmd_full(args):
    """Run all 4 stages in sequence."""
    start = time.time()

    print(f"\n{'='*60}")
    print(f"🏭 SITE FACTORY — FULL PIPELINE")
    print(f"   Template: {args.template}")
    print(f"   Brief: {args.brief}")
    print(f"   Site: {args.site}")
    print(f"   Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"{'='*60}\n")

    # Stage 1: Scan
    print("━" * 40)
    print("STAGE 1/4: CATALOG")
    print("━" * 40)
    from scanner import scan_template
    scan_template(args.site, args.template)

    # Stage 2: Match
    print("━" * 40)
    print("STAGE 2/4: MATCH")
    print("━" * 40)
    from matcher import match_brief
    job = match_brief(args.template, args.brief, args.site)
    if not job:
        print("❌ Matching failed — aborting")
        return
    job_id = job["id"]

    # Stage 3: Process
    print("━" * 40)
    print("STAGE 3/4: PROCESS")
    print("━" * 40)
    from processor import process_job
    staging = process_job(job_id)
    if not staging:
        print("❌ Processing failed — aborting")
        return

    # Stage 4: Deploy
    print("━" * 40)
    print("STAGE 4/4: DEPLOY")
    print("━" * 40)
    from deployer import deploy_job
    deploy_job(job_id, args.site, args.dry_run)

    elapsed = time.time() - start
    print(f"\n🏁 PIPELINE COMPLETE in {elapsed:.1f}s ({elapsed/60:.1f} minutes)")
    print(f"   Job: #{job_id}")


def cmd_status(args):
    """Show job status."""
    from models import get_job
    job = get_job(args.job)
    if not job:
        print(f"❌ Job #{args.job} not found")
        return

    print(f"\n📋 Job #{job['id']}: {job['job_name']}")
    print(f"   Template: {job['template_slug']}")
    print(f"   Site: {job['site_url']}")
    print(f"   Status: {job['status']}")
    print(f"   Created: {job['created_at']}")
    print(f"   Updated: {job['updated_at']}")

    results = job.get("results", {})
    if results:
        print(f"\n   Results:")
        for k, v in results.items():
            if k != "validation":
                print(f"     {k}: {v}")

        validation = results.get("validation", {})
        if validation:
            print(f"\n   Validation:")
            for page, checks in validation.items():
                passed = checks.get("passed", False)
                print(f"     /{page}/: {'✅ PASS' if passed else '❌ FAIL'}")


def cmd_list(args):
    """List all jobs."""
    from models import list_jobs
    jobs = list_jobs()
    if not jobs:
        print("No jobs found")
        return

    print(f"\n{'ID':<5} {'Status':<12} {'Template':<25} {'Name'}")
    print("-" * 70)
    for job in jobs:
        print(f"{job['id']:<5} {job['status']:<12} {job['template_slug']:<25} {job['job_name']}")
    print()


# ---------------------------------------------------------------------------
# CLI setup
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Site Factory Engine 2.0 — WordPress site production pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python engine.py scan --template electrician-company
  python engine.py match --template electrician-company --brief briefs/test.yaml
  python engine.py process --job 1
  python engine.py deploy --job 1 --dry-run
  python engine.py full --template electrician-company --brief briefs/test.yaml
  python engine.py status --job 1
  python engine.py list
        """,
    )

    subs = parser.add_subparsers(dest="command", required=True)

    # scan
    p_scan = subs.add_parser("scan", help="Stage 1: Catalog template assets")
    p_scan.add_argument("--template", required=True)
    p_scan.add_argument("--site", default=DEFAULT_SITE, choices=list(WP_SITES.keys()))
    p_scan.add_argument("--page", default=None)
    p_scan.set_defaults(func=cmd_scan)

    # match
    p_match = subs.add_parser("match", help="Stage 2: Match client brief to template")
    p_match.add_argument("--template", required=True)
    p_match.add_argument("--brief", required=True)
    p_match.add_argument("--site", default=DEFAULT_SITE, choices=list(WP_SITES.keys()))
    p_match.set_defaults(func=cmd_match)

    # process
    p_proc = subs.add_parser("process", help="Stage 3: Crop/resize images")
    p_proc.add_argument("--job", type=int, required=True)
    p_proc.set_defaults(func=cmd_process)

    # deploy
    p_dep = subs.add_parser("deploy", help="Stage 4: Upload + activate")
    p_dep.add_argument("--job", type=int, required=True)
    p_dep.add_argument("--site", default=DEFAULT_SITE, choices=list(WP_SITES.keys()))
    p_dep.add_argument("--dry-run", action="store_true")
    p_dep.set_defaults(func=cmd_deploy)

    # full
    p_full = subs.add_parser("full", help="Run all 4 stages")
    p_full.add_argument("--template", required=True)
    p_full.add_argument("--brief", required=True)
    p_full.add_argument("--site", default=DEFAULT_SITE, choices=list(WP_SITES.keys()))
    p_full.add_argument("--dry-run", action="store_true")
    p_full.set_defaults(func=cmd_full)

    # status
    p_stat = subs.add_parser("status", help="Show job status")
    p_stat.add_argument("--job", type=int, required=True)
    p_stat.set_defaults(func=cmd_status)

    # list
    p_list = subs.add_parser("list", help="List all jobs")
    p_list.set_defaults(func=cmd_list)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

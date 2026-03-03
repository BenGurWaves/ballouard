"""GitHub + Cloudflare Pages deployment — creates repos and deploys built sites."""

from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path

import httpx
import structlog

from config.settings import settings

log = structlog.get_logger()

GITHUB_API = "https://api.github.com"
CLOUDFLARE_API = "https://api.cloudflare.com/client/v4"


# ══════════════════════════════════════════════════════════
# GitHub
# ══════════════════════════════════════════════════════════

async def create_github_repo(repo_name: str, description: str = "") -> dict:
    """
    Create a GitHub repo under the configured org (or user account).
    Returns {"repo_url": ..., "clone_url": ..., "full_name": ...}
    """
    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    payload = {
        "name": repo_name,
        "description": description,
        "private": False,
        "auto_init": False,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        if settings.github_org:
            url = f"{GITHUB_API}/orgs/{settings.github_org}/repos"
        else:
            url = f"{GITHUB_API}/user/repos"

        resp = await client.post(url, json=payload, headers=headers)

        if resp.status_code == 422:
            # Repo already exists — fetch it
            owner = settings.github_org or (await _get_github_user(client, headers))
            resp = await client.get(
                f"{GITHUB_API}/repos/{owner}/{repo_name}", headers=headers
            )

        resp.raise_for_status()
        data = resp.json()

    log.info("deployment.github_repo_created", repo=data["full_name"])
    return {
        "repo_url": data["html_url"],
        "clone_url": data["clone_url"],
        "full_name": data["full_name"],
    }


async def push_files_to_github(
    repo_full_name: str,
    site_dir: Path,
    commit_message: str = "Initial site deployment",
) -> str:
    """
    Push all files from a directory to a GitHub repo using the Contents API.
    Returns the commit URL.
    """
    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        for file_path in site_dir.rglob("*"):
            if file_path.is_dir():
                continue

            relative = file_path.relative_to(site_dir)
            content = file_path.read_bytes()
            encoded = base64.b64encode(content).decode("utf-8")

            url = f"{GITHUB_API}/repos/{repo_full_name}/contents/{relative}"

            # Check if file already exists (need its SHA to update)
            sha = None
            existing = await client.get(url, headers=headers)
            if existing.status_code == 200:
                sha = existing.json().get("sha")

            payload = {
                "message": commit_message,
                "content": encoded,
            }
            if sha:
                payload["sha"] = sha

            resp = await client.put(url, json=payload, headers=headers)
            if resp.status_code not in (200, 201):
                log.error(
                    "deployment.github_push_failed",
                    file=str(relative),
                    status=resp.status_code,
                    body=resp.text[:200],
                )

    log.info("deployment.github_pushed", repo=repo_full_name, files=len(list(site_dir.rglob("*"))))
    return f"https://github.com/{repo_full_name}"


async def _get_github_user(client: httpx.AsyncClient, headers: dict) -> str:
    """Get authenticated GitHub username."""
    resp = await client.get(f"{GITHUB_API}/user", headers=headers)
    resp.raise_for_status()
    return resp.json()["login"]


# ══════════════════════════════════════════════════════════
# Cloudflare Pages
# ══════════════════════════════════════════════════════════

async def create_cloudflare_pages_project(project_name: str) -> dict:
    """
    Create a Cloudflare Pages project (Direct Upload mode, no git connection).
    Returns {"project_name": ..., "url": ...}
    """
    headers = {
        "Authorization": f"Bearer {settings.cloudflare_api_token}",
        "Content-Type": "application/json",
    }
    account_id = settings.cloudflare_account_id

    payload = {
        "name": project_name,
        "production_branch": "main",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{CLOUDFLARE_API}/accounts/{account_id}/pages/projects",
            json=payload,
            headers=headers,
        )

        if resp.status_code == 409:
            # Project already exists — fetch it
            resp = await client.get(
                f"{CLOUDFLARE_API}/accounts/{account_id}/pages/projects/{project_name}",
                headers=headers,
            )

        resp.raise_for_status()

    url = f"https://{project_name}.pages.dev"
    log.info("deployment.cf_project_created", name=project_name, url=url)
    return {"project_name": project_name, "url": url}


async def deploy_to_cloudflare_pages(
    project_name: str,
    site_dir: Path,
) -> dict:
    """
    Deploy files to Cloudflare Pages using Direct Upload.

    Uses the v2 direct upload API:
      POST /accounts/{id}/pages/projects/{name}/deployments
      Content-Type: multipart/form-data
        - "manifest" part: JSON mapping of file paths to content hashes
        - one file part per asset

    Returns {"url": ..., "deployment_id": ...}
    """
    headers = {
        "Authorization": f"Bearer {settings.cloudflare_api_token}",
    }
    account_id = settings.cloudflare_account_id

    # Ensure the project exists
    await create_cloudflare_pages_project(project_name)

    # Build manifest and file list
    manifest = {}
    files_to_upload = []

    for file_path in site_dir.rglob("*"):
        if file_path.is_dir():
            continue
        relative = str(file_path.relative_to(site_dir))
        cf_path = f"/{relative}" if not relative.startswith("/") else relative
        content = file_path.read_bytes()
        content_hash = hashlib.sha256(content).hexdigest()

        manifest[cf_path] = content_hash
        files_to_upload.append((cf_path, content))

    async with httpx.AsyncClient(timeout=120) as client:
        form_files = [("manifest", (None, json.dumps(manifest), "application/json"))]
        for cf_path, content in files_to_upload:
            filename = cf_path.lstrip("/")
            form_files.append(("file", (filename, content, "application/octet-stream")))

        resp = await client.post(
            f"{CLOUDFLARE_API}/accounts/{account_id}/pages/projects/{project_name}/deployments",
            headers=headers,
            files=form_files,
        )
        resp.raise_for_status()
        data = resp.json()

    result = data.get("result", data)
    deployment_url = result.get("url", f"https://{project_name}.pages.dev")
    deployment_id = result.get("id", "")

    log.info(
        "deployment.cf_deployed",
        project=project_name,
        url=deployment_url,
        deployment_id=deployment_id,
    )
    return {"url": deployment_url, "deployment_id": deployment_id}

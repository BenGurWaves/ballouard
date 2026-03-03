# Auto-Ship Command

Create a new branch, commit changes, and push directly to the remote repository.

## Behavior

1. Create a new branch for the changes (use a descriptive name based on the work done).
2. Stage and commit all logical changes with clear, descriptive commit messages.
3. Push the branch to origin.
4. Use the GitHub CLI (`gh pr create`) to automatically create a Pull Request with a summary of the changes.
5. After creating the PR, run `gh pr merge --auto --merge` to enable auto-merging once checks pass.

## Steps

- Run `git checkout -b <branch-name>` to create a new branch.
- Run `git add -A` and `git commit -m "<descriptive message>"` for each logical set of changes.
- Run `git push -u origin <branch-name>` to push the branch.
- Run `gh pr create --fill` to create the PR automatically.
- Run `gh pr merge --auto --merge` to enable auto-merge.

## Notes

- If the push fails due to network errors, retry up to 4 times with exponential backoff.
- Always ensure the branch name is descriptive of the changes being shipped.
- Do not push directly to `main` — always use a feature branch and PR workflow.

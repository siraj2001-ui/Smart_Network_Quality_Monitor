# Git Workflow

Simple and safe for a 6-person team over 3 days.

## Rules

1. `main` always runs. Nobody commits directly to `main`.
2. Each person works on their own branch and merges through a Pull Request (PR).
3. Another teammate reviews every PR before merging (Siraj does final merges).
4. Run `python -m pytest` and start the app before opening a PR.
5. Pull the latest `main` before you start working each day.

## Branch names

| Person | Branch |
|---|---|
| Mohammed | `feature/data-loader` |
| Aya | `feature/quality-rules` |
| Aseel | `feature/wireframe` |
| Ayat | `feature/dashboard-ui` |
| Batoul | `feature/api` |
| Siraj | `feature/structure-docs` |

## Daily commands

```bash
git checkout main
git pull origin main
git checkout feature/<your-branch>
git merge main                    # bring in teammates' work

# ... work ...

git add <files>
git commit -m "Short, clear message"
git push origin feature/<your-branch>
```

Then open a Pull Request on GitHub into `main`.

## First-time setup (Siraj)

```bash
git init
git add .
git commit -m "Initial project structure"
git branch -M main
git remote add origin <repo-url>
git push -u origin main
```

Then invite the team as collaborators and have everyone `git clone` it.

## Commit messages

Short and in the present tense, for example:
`Add duplicate removal`, `Fix severity filter`, `Update README`.

## Merge conflicts

1. Do not panic and do not delete other people's code.
2. Run `git merge main` on your branch and open the conflicted files.
3. Keep both sides' intent; ask the other author if unsure.
4. Re-run the tests, commit, push.

Tell the team early in the group chat if a conflict touches a shared file.

## Suggested 3-day plan

| Day | Goal |
|---|---|
| 1 | Agree on `CONTRACT.md`, set up repo, each person builds their module and wireframe |
| 2 | Connect backend -> API -> dashboard, first integration merge |
| 3 | Fix bugs, finish tests and docs, rehearse the demo (everyone explains their part) |

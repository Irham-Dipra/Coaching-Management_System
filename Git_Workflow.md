# Git Feature Branch Workflow Guide

Using a "Feature Branch" workflow ensures that your `master` branch is always clean and stable. This is critical when you have automatic deployments set up (like Vercel or Render).

Follow these exact steps every time you want to build a new feature or try an experiment:

## Step 1: Create a Feature Branch
Always start from your clean, up-to-date `master` branch. Run this command to create and switch to a new branch (name it whatever your feature is):
```bash
git checkout master
git pull origin master
git checkout -b feature/your-feature-name
```
*(You are now safe to write code without breaking the live app!)*

## Step 2: Implement and Test
Write your code! Test it on your `localhost`. If it totally breaks or you decide to scrap it, you can simply run:
```bash
git checkout master
git branch -D feature/your-feature-name
```
And poof, the broken code is gone!

## Step 3: Commit Your Work
When you are happy with the feature and want to prepare it for deployment:
```bash
git add .
git commit -m "Brief description of the feature"
```

## Step 4: Merge and Deploy (The Cleanup)
To push this feature live, you need to merge it back into `master` and push it to GitHub:
```bash
# 1. Switch back to your stable master branch
git checkout master

# 2. Merge your new feature into master
git merge feature/your-feature-name

# 3. Push master to GitHub (This triggers Vercel/Render!)
git push origin master
```

## Step 5: Delete the Feature Branch
Once it's merged, you don't need the feature branch anymore. Delete it to keep your workspace clean!
```bash
git branch -d feature/your-feature-name
```

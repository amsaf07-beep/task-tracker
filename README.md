# My Task Tracker

A personal, responsive task-tracking web application that can be hosted directly on **GitHub Pages**.

## Features

- Daily, weekly, monthly and annual calendar views
- Click a date to see its task list
- Add, edit, delete and complete tasks
- Daily task completion percentage
- Weekly completion based on the percentage of eligible days where **all tasks were completed**
- Green `✓` for a fully completed day
- Red/orange `✗` for incomplete days
- Completion heatmap across month and year
- Current and best completion streak
- Last-14-days analytics
- Task categories and priorities
- Optional recurring task creation for 31 consecutive days
- JSON export/import for backup and migration
- Responsive layout for desktop and mobile
- No backend and no build step

## Important data note

This version stores data in the browser using `localStorage`.

That means:

- Data persists across page refreshes in the same browser.
- Data is not automatically synchronized between devices.
- Clearing browser/site data can remove your tasks.
- Use **Export data** regularly for backups.

For multi-device/cloud synchronization, replace localStorage with a backend such as Supabase/Firebase.

## Run locally

Because this is a static application, you can simply open `index.html` in a modern browser.

For a local HTTP server, for example:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Publish on GitHub Pages

1. Create a new GitHub repository, e.g. `task-tracker`.
2. Upload:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. Push the files to the `main` branch.
4. In GitHub, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select `main` and `/ (root)`.
7. Save.
8. GitHub will publish the site at your repository's Pages URL.

No npm install, Node.js runtime, database, or server is required.

## Completion logic

### Daily completion

```text
completed tasks / total tasks × 100
```

### Weekly completion

```text
fully completed eligible days / eligible days × 100
```

A day with no tasks is excluded from the weekly denominator.

### Calendar colours

- Dark green = 100%
- Light green = 75–99%
- Yellow = 50–74%
- Orange = 25–49%
- Red = below 25%
- Grey = no tasks

The fully completed day receives a green `✓`. Any day that has tasks but is not fully complete receives a `✗`.

## Suggested next upgrade

For a production version, add:

- User login
- Cloud synchronization
- Recurring task rules
- Notifications/reminders
- Drag-and-drop scheduling
- Monthly/annual charts
- Supabase/PostgreSQL persistence

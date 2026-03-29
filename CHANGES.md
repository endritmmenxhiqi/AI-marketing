Changes made by assistant on 2026-03-29

- backend/.env: Created (local MongoDB -> later updated to Atlas placeholder)
- Installed backend dependencies (`npm install` in `backend`)
- Started backend dev server (nodemon) and verified connection to MongoDB (local or Atlas when creds provided)
- frontend/src/components/PrivateRoute.jsx: Made role-aware, preserves attempted location when redirecting to login
- frontend/src/pages/LoginPage.jsx: Redirect to `/admin` when user.role === 'admin', otherwise `/dashboard`
- frontend/src/pages/RegisterPage.jsx: Same role-based redirect as LoginPage
- frontend/src/App.jsx: Added `/admin` route protected with `roles={["admin"]}`
- frontend/src/pages/AdminPage.jsx: New simple admin dashboard page
- .gitignore: Added `backend/.env` and `frontend/.env` to prevent committing secrets

Notes:
- The Atlas connection string in `backend/.env` contains a placeholder `<db_password>`; replace it with the actual password if you want to use Atlas.
- I did not push anything to GitHub.

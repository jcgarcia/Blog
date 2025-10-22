# Bedtime Blog

A full-stack blog platform featuring user authentication, post creation, categories, media support, and a modern responsive UI.  
This project uses a React frontend, a Node.js/Express backend, and a cloud-hosted **PostgreSQL** database (with CA certificate support for secure connections).  
**Package manager:** [pnpm](https://pnpm.io/)  
**Frontend build tool:** [Vite](https://vitejs.dev/)  
**Backend:** Express, Passport.js (Google OAuth), Multer, JWT

---

## Project Structure

```
blog/
├── api/            # Backend (Node.js/Express)
│   ├── controllers/
│   ├── routes/
│   ├── db.js
│   ├── index.js
│   └── package.json
├── client/         # Frontend (React)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── media/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── package.json    # Root scripts (monorepo)
├── pnpm-workspace.yaml
└── README.md
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [pnpm](https://pnpm.io/) (install with `npm i -g pnpm`)
- Cloud PostgreSQL database (credentials and CA certificate required)
- Google OAuth credentials (for social login)
- CA certificate file for secure DB connection (see deployment notes)

---

## Installation

1. **Clone the public repository:**
   ```sh
   git clone https://github.com/jcgarcia/bedtimeblog.git
   cd bedtimeblog
   ```

2. **Install dependencies for all workspaces:**
   ```sh
   pnpm install
   ```

---

## Configuration

### 1. Backend (`api/`)

- Copy or create a `.env` file in `api/` with your environment variables:

  ```
  DB_HOST=<your-db-host>
  DB_USER=<your-db-user>
  DB_PASSWORD=<your-db-password>
  DB_NAME=blog
  DB_CA_CERT_PATH=<path-to-ca-cert>
  JWT_SECRET=<your-jwt-secret>
  GOOGLE_CLIENT_ID=<your-google-client-id>
  GOOGLE_CLIENT_SECRET=<your-google-client-secret>
  ```

- Place your CA certificate file in a secure location and reference it in your `.env`.
- Update `api/db.js` and `api/index.js` if you need to adjust connection details.

### 2. Frontend (`client/`)

---

## Running the Project

From the root directory, run:

- The backend API (with hot reload via nodemon)
- The frontend React app (via Vite)

**Production URLs:**

- Frontend: [https://bedtime.ingasti.com/](https://bedtime.ingasti.com/)
- Backend: [https://bapi.ingasti.com/](https://bapi.ingasti.com/)
- Database name: `blog`

**Local development:**

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:8800](http://localhost:8800)

---

## Building for Production

1. **Build the frontend:**

   cd client
   pnpm build

2. **Deploy the backend (`api/`) and serve the frontend build as needed.**

---

## Static Pages & Editor Automation

- **Terms of Service** and **Privacy Policy** pages are managed via the admin/editor panel.
- Content is automatically converted between plain text and Lexical JSON for correct formatting on public pages and seamless editing.
- The backend ensures public pages are always published and formatted, and the frontend renders headings, lists, and paragraphs from both Lexical JSON and plain text.

---

- All environment variables and CA certificates must be set on your production server.

---

## Features

- User registration & login (including Google OAuth)
- Create, edit, and delete blog posts
- Categories and tags
- Responsive design
- Video and image support
- Admin login route

---

## Troubleshooting

- **Ports in use:** Make sure ports 5173 (frontend) and 8800 (backend) are available.
- **Database errors:** Check your `.env` and cloud DB access.
- **OAuth issues:** Verify Google credentials and callback URLs.

---

## License

MIT

---

## Credits

- React, Vite, Express, Passport.js, Multer, PostgreSQL, FontAwesome, and more.

---

## Docker Image Versioning (CI/CD Note)

> **Note:**
>
> Docker images built in CI/CD are tagged with a unique version for each build, not just `latest`. Common strategies include:
>
> - Jenkins build number: `backend:${BUILD_NUMBER}`
> - Git commit SHA: `backend:${GIT_COMMIT}`
> - Branch name + build number: `backend:${BRANCH_NAME}-${BUILD_NUMBER}`
> - Combination for traceability: `backend:${BRANCH_NAME}-${BUILD_NUMBER}-${GIT_COMMIT}`
>
> This ensures every image is uniquely identifiable and traceable to a specific build or commit. See the Jenkinsfile for implementation details.

---

## Bedtime Blog - Social Features Implementation

## Current Features

- Blog restored to last functional state (pre-social features)
- Likes feature implemented (backend and frontend)
  - Backend: Migration, API route, controller for post likes
  - Frontend: Like/unlike button, like count display in single post view
- All changes are incremental, documented, and reversible
- Backup of all key files is available in `activity/backup`
- Sprint log updated for every step (`code/sprint-2025-08-29.md`)

## Next Steps

- Validate likes feature end-to-end
- Begin work on sharing and comments features
- Continue updating documentation and sprint log

## Recovery/Backup

- To revert to pre-social features state, restore files from `activity/backup`

---

## Social Media Authentication Configuration

How to configure social login for your Bedtime Blog:

### Google OAuth

- Go to the [Google Cloud Console](https://console.cloud.google.com/).
- Create or select a project, then navigate to **APIs & Services > Credentials**.
- Click **Create Credentials > OAuth client ID**.
- Set the application type to **Web application**.
- Add the following redirect URI:
  - `https://bedtime.ingasti.com/auth/google/callback`
- Copy your **Client ID** and **Client Secret** and enter them in the operations panel.
- For more details, see the [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2).

### Facebook OAuth

- Go to the [Facebook for Developers](https://developers.facebook.com/) portal.
- Create a new app and configure **Facebook Login**.
- Add the following redirect URI:
  - `https://bedtime.ingasti.com/auth/facebook/callback`
- Copy your **App ID** and **App Secret** and enter them in the operations panel.
- For more details, see the [Facebook Login documentation](https://developers.facebook.com/docs/facebook-login/).

---# Force Jenkins Build - Wed Oct 22 11:05:01 AM BST 2025
# CoreDB Reset - Wed Oct 22 06:01:34 PM BST 2025

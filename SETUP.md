# TestMind AI - Complete Setup Guide

## Project Overview

TestMind AI is a production-ready application for:
- Creating test cases from user stories/descriptions using AI (Gemini)
- Uploading and analyzing screen recordings
- Tracking bugs and issues
- GitHub integration for pushing issues
- Real-time collaboration

## Tech Stack

**Frontend:**
- React 19 + TypeScript
- Vite (build tool)
- Tailwind CSS
- Lucide icons

**Backend:**
- Node.js + Express
- TypeScript
- PostgreSQL database
- Google Generative AI (Gemini)
- GitHub OAuth & API

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- GitHub account (for OAuth)
- Google Gemini API key

## Setup Instructions

### 1. Database Setup

Create a PostgreSQL database:

```bash
createdb testmind_ai
```

Or use your preferred PostgreSQL client to create a database named `testmind_ai`.

### 2. Backend Setup

```bash
cd server
npm install
```

Create `.env` file in `server/` directory:

```
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=testmind_ai

# JWT
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:5000/api/auth/github/callback

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# File Upload
MAX_FILE_SIZE=500000000
UPLOAD_DIR=./uploads

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### 3. GitHub OAuth Setup

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name:** TestMind AI
   - **Homepage URL:** http://localhost:5173
   - **Authorization callback URL:** http://localhost:5000/api/auth/github/callback
4. Copy `Client ID` and generate `Client Secret`
5. Add to `.env` file

### 4. Google Gemini API Setup

1. Go to https://ai.google.dev/
2. Create an API key
3. Add to `.env` file: `GEMINI_API_KEY=your_key`

### 5. Frontend Setup

```bash
npm install
```

Create `.env.local` file in root directory:

```
VITE_API_URL=http://localhost:5000/api
VITE_GITHUB_CLIENT_ID=your_github_client_id
```

### 6. Running the Application

**Option A: Run separately (in two terminals)**

Terminal 1 - Backend:
```bash
cd server
npm run dev
```

Terminal 2 - Frontend:
```bash
npm run dev
```

**Option B: Run together (if concurrently installed)**
```bash
npm run dev:full
```

The app will be available at: http://localhost:5173

### 7. Database Auto-Initialization

On first backend startup, the database schema will be automatically created with all necessary tables:
- users
- projects
- test_cases
- bug_reports
- video_recordings
- timeline_events
- github_repositories

## API Endpoints

### Authentication
- `GET /api/auth/github/callback` - GitHub OAuth callback
- `GET /api/auth/me` - Get current user

### Projects
- `POST /api/projects` - Create project
- `GET /api/projects` - Get all projects
- `GET /api/projects/:projectId` - Get project
- `PUT /api/projects/:projectId` - Update project
- `DELETE /api/projects/:projectId` - Delete project

### Test Cases
- `POST /api/test-cases/generate` - Generate test cases using AI
- `GET /api/test-cases/:projectId` - Get test cases
- `PUT /api/test-cases/:testCaseId/status` - Update test case status

### Bugs
- `GET /api/bugs/:projectId` - Get bug reports
- `POST /api/bugs` - Create bug report
- `PUT /api/bugs/:bugId/status` - Update bug status

### Integrations
- `POST /api/integrations/:projectId/upload-video` - Upload video
- `GET /api/integrations/github/repos` - Get GitHub repos
- `POST /api/integrations/github/push-bug` - Push bug to GitHub

## Features

### 1. AI Test Case Generation
- Enter app description or user story
- Select test perspectives (UI/UX, Functional, Edge Cases, etc.)
- AI automatically generates comprehensive test cases
- Test cases saved to database

### 2. Video Upload & Analysis
- Upload screen recordings (MP4, WEBM, OGG)
- Videos stored on server
- Timeline analysis available

### 3. Bug Tracking
- Create bug reports
- Link bugs to test cases
- Track severity and priority
- Push bugs directly to GitHub as issues

### 4. GitHub Integration
- OAuth login with GitHub
- Push bugs as GitHub issues
- Automatic issue creation with formatted details

### 5. Test Management
- Execute tests and record results
- Mark tests as passed/failed
- Add actual results and comments
- Automatic bug creation on test failure

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5000 (backend)
lsof -ti:5000 | xargs kill -9

# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9
```

### Database Connection Issues
1. Verify PostgreSQL is running
2. Check `.env` credentials
3. Ensure database exists: `createdb testmind_ai`

### GitHub OAuth Issues
1. Verify callback URL matches exactly
2. Check Client ID and Secret are correct
3. Ensure frontend VITE_GITHUB_CLIENT_ID matches

### API Not Connecting
1. Verify backend is running on port 5000
2. Check VITE_API_URL in frontend `.env.local`
3. CORS should be enabled for localhost

## Production Deployment

### Building for Production

Frontend:
```bash
npm run build
npm run deploy  # Deploy to GitHub Pages
```

Backend:
```bash
cd server
npm run build
npm start
```

### Environment Variables for Production
- Use environment-specific `.env` files
- Use secure secret management (AWS Secrets Manager, etc.)
- Update GitHub OAuth callback URL
- Use production database URL
- Use HTTPS for all URLs

## Contributing

Development workflow:
1. Create feature branch
2. Make changes
3. Test locally
4. Push to GitHub
5. Create pull request

## License

MIT

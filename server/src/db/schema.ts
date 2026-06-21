import pool from './connection.js';

export async function initializeDatabase() {
  try {
    console.log('Initializing database schema...');

    await pool.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        name VARCHAR(255),
        github_id INTEGER UNIQUE,
        github_username VARCHAR(255),
        github_access_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Projects table
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        app_description TEXT,
        platform_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Test Cases table
      CREATE TABLE IF NOT EXISTS test_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        preconditions TEXT,
        steps JSONB,
        expected_result TEXT,
        actual_result TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        severity VARCHAR(50),
        priority VARCHAR(50),
        test_type VARCHAR(100),
        platform VARCHAR(100),
        module VARCHAR(100),
        tags JSONB DEFAULT '[]',
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Bug Reports table
      CREATE TABLE IF NOT EXISTS bug_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        test_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        steps JSONB,
        expected_result TEXT,
        actual_result TEXT,
        severity VARCHAR(50),
        priority VARCHAR(50),
        status VARCHAR(50) DEFAULT 'open',
        github_issue_url TEXT,
        rca_text TEXT,
        suggested_fix TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Video Recordings table
      CREATE TABLE IF NOT EXISTS video_recordings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size BIGINT,
        duration FLOAT,
        mime_type VARCHAR(50),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Timeline Events table
      CREATE TABLE IF NOT EXISTS timeline_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id UUID REFERENCES video_recordings(id) ON DELETE CASCADE,
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        time_in_seconds FLOAT,
        event_type VARCHAR(100),
        event_title VARCHAR(255),
        description TEXT,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- GitHub Repositories table
      CREATE TABLE IF NOT EXISTS github_repositories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        repo_id INTEGER,
        repo_name VARCHAR(255),
        repo_full_name VARCHAR(255),
        repo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_test_cases_project_id ON test_cases(project_id);
      CREATE INDEX IF NOT EXISTS idx_bug_reports_project_id ON bug_reports(project_id);
      CREATE INDEX IF NOT EXISTS idx_video_recordings_project_id ON video_recordings(project_id);
      CREATE INDEX IF NOT EXISTS idx_github_repositories_project_id ON github_repositories(project_id);
    `);

    console.log('✓ Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

export default initializeDatabase;

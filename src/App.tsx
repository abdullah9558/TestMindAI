import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Upload, FileText, Bug, GitBranch,
  BarChart2, Cpu, CheckCircle2, Terminal, RefreshCw, Sparkles, LayoutGrid,
  Menu, ExternalLink, Award, Globe, Laptop, Smartphone,
  Gamepad2, Compass, Plus, Trash2, X, ChevronDown, Copy, Check, Settings, User
} from 'lucide-react';
import { createDevSession, getCurrentUser, getGitHubAuthUrl, updateCurrentUser } from './api/auth';
import { getBugReports } from './api/bugs';
import { createProject, getProjects } from './api/projects';
import {
  clearTestCases,
  createTestCase,
  deleteTestCase,
  generateTestCases as generateTestCasesFromApi,
  getTestCaseAutomation,
  getTestCases,
  updateTestCaseStatus,
  type TestCaseAutomation,
} from './api/testCases';
import { createGitHubRepository, disconnectGitHub, getGitHubRepos, getGitHubStatus, parseTelemetry, publishProjectToGitHub, pushBugToGitHub, uploadVideo } from './api/integrations';
import { setToken } from './api/client';

interface TestCase {
  id: string;
  title: string;
  description?: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  actualResult?: string;
  status: 'pending' | 'passed' | 'failed' | 'blocked';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority: 'P3' | 'P2' | 'P1' | 'P0';
  testType: string;
  platform: string;
  module: string;
  tags: string[];
}

interface BugReport {
  id: string;
  title: string;
  description: string;
  steps: string[];
  expectedResult: string;
  actualResult: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority: 'P3' | 'P2' | 'P1' | 'P0';
  timestamp: string;
  module: string;
  githubIssueUrl?: string;
  rcaText?: string;
  suggestedFix?: string;
}

interface TimelineEvent {
  id: string;
  time: string;
  event: string;
  type: string;
  desc: string;
  status: 'info' | 'warning' | 'critical';
}

interface Project {
  id: string;
  name: string;
  description?: string;
  app_description?: string;
  platform_type?: string;
}

interface UserProfile {
  id: string; email: string; name: string; github_username?: string;
  job_title: string; organization: string; timezone: string; plan_name: string;
  default_platform: string; default_test_count: string; default_perspectives: string[];
}

type TestCaseRow = Partial<TestCase> & {
  expected_result?: string;
  actual_result?: string;
  test_type?: string;
};

type BugReportRow = Partial<BugReport> & {
  expected_result?: string;
  actual_result?: string;
  created_at?: string;
  github_issue_url?: string;
  rca_text?: string;
  suggested_fix?: string;
};

const PRISMA_SCHEMA_RAW = `// TESTMIND AI - DATABASE SCHEMA (PostgreSQL)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id             String         @id @default(uuid())
  email          String         @unique
  name           String?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  organizations  Organization[] @relation("OrgMembers")
  projects       Project[]
}

model Project {
  id             String         @id @default(uuid())
  name           String
  platformType   PlatformType
  createdAt      DateTime       @default(now())
  testCases      TestCase[]
  bugReports     BugReport[]
  githubRepo     GitHubRepository?
}

enum PlatformType {
  WEB_APP
  WEBSITE
  MOBILE_IOS
  MOBILE_ANDROID
  GAME_UNITY
  GAME_UNREAL
  DESKTOP_WINDOWS
}

model TestCase {
  id             String         @id @default(uuid())
  title          String
  preconditions  String
  steps          String[]
  expectedResult String
  severity       SeverityLevel
  priority       PriorityLevel
  projectId      String
  project        Project        @relation(fields: [projectId], references: [id])
}

enum SeverityLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum PriorityLevel {
  P3
  P2
  P1
  P0
}

model BugReport {
  id             String         @id @default(uuid())
  title          String
  description    String
  steps          String[]
  expectedResult String
  actualResult   String
  severity       SeverityLevel
  priority       PriorityLevel
  projectId      String
  project        Project        @relation(fields: [projectId], references: [id])
}

model GitHubRepository {
  id          String   @id @default(uuid())
  repoId      Int      @unique
  fullName    String
  htmlUrl     String
  projectId   String   @unique
  project     Project  @relation(fields: [projectId], references: [id])
}`;

const DOCKER_FILE_RAW = `# TestMind AI - Production Orchestration Dockerfile
FROM node:18-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]`;

const GH_ACTION_RAW = `# GitHub Actions - Enterprise CI/CD Deployment Pipeline
name: TestMind AI Production Deployment

on:
  push:
    branches: [ "main", "release/*" ]
  pull_request:
    branches: [ "main" ]

jobs:
  audit-and-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 18
    - name: Install dependencies
      run: npm ci
    - name: Run ESLint
      run: npm run lint
    - name: Build Codebase Verify
      run: npm run build
      env:
        DATABASE_URL: \${{ secrets.DATABASE_URL }}
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: \${{ secrets.CLERK_KEY }}`;

// Retained as copy-ready integration templates for upcoming export actions.
void PRISMA_SCHEMA_RAW;
void DOCKER_FILE_RAW;
void GH_ACTION_RAW;

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [value];
    } catch {
      return [value];
    }
  }
  return [];
};

const mapTestCase = (row: TestCaseRow): TestCase => ({
  id: row.id || crypto.randomUUID(),
  title: row.title || 'Untitled test case',
  description: row.description || '',
  preconditions: row.preconditions || 'No preconditions recorded.',
  steps: toArray(row.steps),
  expectedResult: row.expectedResult || row.expected_result || '',
  actualResult: row.actualResult || row.actual_result || undefined,
  status: row.status || 'pending',
  severity: row.severity || 'MEDIUM',
  priority: row.priority || 'P2',
  testType: row.testType || row.test_type || 'Functional',
  platform: row.platform || 'Web Application',
  module: row.module || 'General',
  tags: toArray(row.tags),
});

const mapBugReport = (row: BugReportRow): BugReport => ({
  id: row.id || crypto.randomUUID(),
  title: row.title || 'Untitled bug',
  description: row.description || '',
  steps: toArray(row.steps),
  expectedResult: row.expectedResult || row.expected_result || '',
  actualResult: row.actualResult || row.actual_result || '',
  severity: row.severity || 'MEDIUM',
  priority: row.priority || 'P2',
  timestamp: row.timestamp || row.created_at || 'Database record',
  module: row.module || 'General',
  githubIssueUrl: row.githubIssueUrl || row.github_issue_url || undefined,
  rcaText: row.rcaText || row.rca_text || undefined,
  suggestedFix: row.suggestedFix || row.suggested_fix || undefined,
});

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'testcases' | 'bugs' | 'integrations' | 'analytics' | 'profile'>('dashboard');

  // Core Data States
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [testCases, setTestCaseData] = useState<TestCase[]>([]);
  const [bugs, setBugReports] = useState<BugReport[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [logInputText, setLogInputText] = useState('');
  const [uploadedVideoFile, setUploadedVideoFile] = useState<File | null>(null);
  const [uploadedVideoId, setUploadedVideoId] = useState('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState('');
  const [videoUploadMessage, setVideoUploadMessage] = useState('Drag & drop or choose a video file to analyze.');
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);

  // AI Pipeline Custom Input Parameters
  const [customAppDesc, setCustomAppDesc] = useState('');
  const [selectedPerspectives, setSelectedPerspectives] = useState<string[]>(['UI/UX Checklists', 'Functional Flows', 'Edge Cases']);
  const [selectedPlatform, setSelectedPlatform] = useState('Web');
  const [selectedTestCount, setSelectedTestCount] = useState<'5' | '10' | '20' | '30' | 'Custom' | 'Auto'>('10');
  const [customTestCount, setCustomTestCount] = useState('12');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState({ name: '', jobTitle: '', organization: '', timezone: 'UTC', defaultPlatform: 'Web', defaultTestCount: '10', defaultPerspectives: ['UI/UX Checklists', 'Functional Flows', 'Edge Cases'] as string[] });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generationLog, setGenerationLog] = useState<string[]>([]);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [showAddTestCaseForm, setShowAddTestCaseForm] = useState(false);
  const [expandedTestCaseId, setExpandedTestCaseId] = useState<string | null>(null);
  const [automationByTestCase, setAutomationByTestCase] = useState<Record<string, TestCaseAutomation>>({});
  const [automationLoadingId, setAutomationLoadingId] = useState<string | null>(null);
  const [automationTab, setAutomationTab] = useState<'playwright' | 'cypress' | 'selenium'>('playwright');
  const [copiedScript, setCopiedScript] = useState('');
  const [manualTestCase, setManualTestCase] = useState({
    title: '',
    preconditions: '',
    steps: '',
    expectedResult: '',
    severity: 'MEDIUM' as TestCase['severity'],
    priority: 'P2' as TestCase['priority'],
    testType: 'Manual',
    platform: 'Web Application',
    module: 'General',
    tags: '',
  });

  // Simulation Interactive Elements
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [activeLogMsg, setActiveLogMsg] = useState('');
  const [parsedLogStatus, setParsedLogStatus] = useState<'idle' | 'parsing' | 'success' | 'failed'>('idle');

  // RCA Slide-Over and Github OAuth Setup Simulation
  const [rcaTargetBug, setRcaTargetBug] = useState<BugReport | null>(null);
  const [oauthStep, setOauthStep] = useState<'disconnected' | 'authenticating' | 'connected'>('disconnected');
  const [githubUser, setGithubUser] = useState<{name: string; login: string; avatarUrl?: string; repos: string[]} | null>(null);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [isPushingCode, setIsPushingCode] = useState(false);
  const [gitTerminalLogs, setGitTerminalLogs] = useState<string[]>([]);
  const [pushedSuccess, setPushedSuccess] = useState(false);
  const [pullRequestUrl, setPullRequestUrl] = useState('');

  // Search/Filters
  const [testFilterPlatform, setTestFilterPlatform] = useState('All');
  const [testFilterSeverity, setTestFilterSeverity] = useState('All');

  const getRequestedTestCount = () => {
    if (selectedTestCount === 'Auto') return 'Auto';
    if (selectedTestCount === 'Custom') {
      const customCount = Number(customTestCount);
      return Number.isFinite(customCount) && customCount > 0 ? customCount : 10;
    }
    return Number(selectedTestCount);
  };

  const loadProjectData = async (projectId: string) => {
    const [testCaseRows, bugRows] = await Promise.all([
      getTestCases(projectId),
      getBugReports(projectId),
    ]);

    setTestCaseData(testCaseRows.map(mapTestCase));
    setBugReports(bugRows.map(mapBugReport));
  };

  useEffect(() => {
    let cancelled = false;

    async function initAuthAndWorkspace() {
      try {
        setIsAppLoading(true);
        setDataError('');

        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');

        if (urlToken) {
          setToken(urlToken);
          params.delete('token');
          params.delete('userId');
          params.delete('email');
          const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
          window.history.replaceState({}, '', newUrl);
        }

        const existingToken = localStorage.getItem('token');
        if (existingToken) {
          try {
            const status = await getGitHubStatus();
            if (status.connected && status.user) {
              const repos = await getGitHubRepos();
              if (!cancelled) {
              setGithubUser({
                name: status.user.name,
                login: status.user.login,
                avatarUrl: status.user.avatarUrl,
                repos: repos.map((repo) => repo.full_name || repo.name || ''),
              });
              setOauthStep('connected');
              }
            }
          } catch (error) {
            // If GitHub-specific auth is not available, keep the app running in dev mode.
            console.warn('GitHub auth auto-connect failed:', error);
          }
        }

        if (!localStorage.getItem('token')) {
          await createDevSession();
        }

        const profile = await getCurrentUser() as UserProfile;
        if (!cancelled) {
          setUserProfile(profile);
          const form = {
            name: profile.name || '', jobTitle: profile.job_title || 'QA Professional', organization: profile.organization || '', timezone: profile.timezone || 'UTC',
            defaultPlatform: profile.default_platform || 'Web', defaultTestCount: profile.default_test_count || '10',
            defaultPerspectives: (Array.isArray(profile.default_perspectives) ? profile.default_perspectives : ['UI/UX Checklists', 'Functional Flows', 'Edge Cases']).map(value => ({ 'UI/UX': 'UI/UX Checklists', 'Functional': 'Functional Flows', 'Edge Case': 'Edge Cases' }[value] || value)),
          };
          setProfileForm(form);
          setSelectedPlatform(form.defaultPlatform);
          setSelectedPerspectives(form.defaultPerspectives);
          if (['5', '10', '20', '30', 'Custom', 'Auto'].includes(form.defaultTestCount)) setSelectedTestCount(form.defaultTestCount as typeof selectedTestCount);
        }

        let projects = await getProjects();
        if (projects.length === 0) {
          const created = await createProject({
            name: 'TestMind AI Workspace',
            description: 'Local dynamic workspace backed by PostgreSQL.',
            appDescription: '',
            platformType: 'WEB_APP',
          });
          projects = [created];
        }

        if (cancelled) return;

        const project = projects[0];
        setActiveProject(project);
        const legacyPlaceholder = 'Describe the product under test, then generate cases from the live backend.';
        setCustomAppDesc(project.app_description === legacyPlaceholder ? '' : project.app_description || '');
        await loadProjectData(project.id);
      } catch (error) {
        if (!cancelled) {
          setDataError(error instanceof Error ? error.message : 'Failed to load dynamic project data.');
        }
      } finally {
        if (!cancelled) {
          setIsAppLoading(false);
        }
      }
    }

    initAuthAndWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (uploadedVideoUrl) {
        URL.revokeObjectURL(uploadedVideoUrl);
      }
    };
  }, [uploadedVideoUrl]);

  const handleVideoUpload = async (file: File) => {
    const acceptedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    if (!acceptedTypes.includes(file.type)) {
      setVideoUploadMessage('Unsupported file type. Please upload MP4, WEBM, or OGG video files.');
      return;
    }
    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl);
    }
    setUploadedVideoFile(file);
    setUploadedVideoUrl(URL.createObjectURL(file));
    setVideoUploadMessage(`Loaded video: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    setVideoProgress(0);
    setVideoDuration(0);
    setVideoCurrentTime(0);
    setIsPlayingVideo(false);

    if (!activeProject) {
      setVideoUploadMessage('Video loaded locally. Wait for the backend project, then upload again.');
      return;
    }

    try {
      setIsProcessingUpload(true);
      setGenerationLog(['Uploading recording to backend storage...']);

      const videoRecord = await uploadVideo(activeProject.id, file);
      setUploadedVideoId(videoRecord.id);
      setGenerationLog(prev => [...prev, 'Recording uploaded. Configure the options and click Generate Test Cases.']);
      setVideoUploadMessage(`${file.name} is ready. Test cases have not been generated yet.`);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to upload the video.');
      setVideoUploadMessage('Video loaded locally, but backend upload failed.');
    } finally {
      setIsProcessingUpload(false);
    }
  };

  const handleDescriptionPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData('text/plain');
    if (!pastedText) return;
    event.preventDefault();
    const start = event.currentTarget.selectionStart;
    const end = event.currentTarget.selectionEnd;
    setCustomAppDesc(previous => `${previous.slice(0, start)}${pastedText}${previous.slice(end)}`);
    setActiveLogMsg(`Pasted ${pastedText.length.toLocaleString()} characters.`);
    setTimeout(() => setActiveLogMsg(''), 2500);
  };

  const handleGenerateFromRecording = async () => {
    if (!activeProject || !uploadedVideoId || !uploadedVideoFile) {
      setDataError('Upload a recording before generating test cases.');
      return;
    }
    try {
      setAiGenerating(true); setDataError('');
      setGenerationLog(['Analyzing the uploaded recording with the selected settings...', 'Generating scenario coverage from the video...', ...(customAppDesc.length > 10000 ? ['Large specification detected. Coverage batches may take several minutes; keep this page open.'] : [])]);
      await generateTestCasesFromApi({ projectId: activeProject.id, appDescription: customAppDesc || `Uploaded QA recording: ${uploadedVideoFile.name}`, perspectives: selectedPerspectives, platform: selectedPlatform, testCount: getRequestedTestCount(), videoId: uploadedVideoId });
      setGenerationLog(previous => [...previous, 'Saved generated test cases to PostgreSQL.']);
      await loadProjectData(activeProject.id);
      setVideoUploadMessage(`Generated test cases from ${uploadedVideoFile.name}.`);
      setActiveTab('testcases');
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to generate test cases from the recording.');
    } finally { setAiGenerating(false); }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true); setDataError('');
      const saved = await updateCurrentUser(profileForm) as UserProfile;
      setUserProfile(saved);
      setSelectedPlatform(saved.default_platform);
      setSelectedPerspectives(saved.default_perspectives);
      if (['5', '10', '20', '30', 'Custom', 'Auto'].includes(saved.default_test_count)) setSelectedTestCount(saved.default_test_count as typeof selectedTestCount);
      setActiveLogMsg('Profile and test defaults saved.'); setTimeout(() => setActiveLogMsg(''), 3000);
    } catch (error) { setDataError(error instanceof Error ? error.message : 'Failed to save profile.'); }
    finally { setIsSavingProfile(false); }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingUpload(true);
  };

  const handleDragLeave = () => {
    setIsDraggingUpload(false);
  };

  const handleVideoDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingUpload(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleVideoUpload(file);
    }
  };

  const handleUploadZoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleVideoPlayPause = () => {
    if (uploadedVideoUrl && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlayingVideo(true);
      } else {
        videoRef.current.pause();
        setIsPlayingVideo(false);
      }
      return;
    }
    setVideoUploadMessage('Upload a recording before starting playback.');
  };

  const handleVideoLoadedMetadata = () => {
    if (!videoRef.current) return;
    const duration = Number.isFinite(videoRef.current.duration) ? videoRef.current.duration : 0;
    const currentTime = videoRef.current.currentTime || 0;
    setVideoDuration(duration);
    setVideoCurrentTime(currentTime);
    setVideoProgress(duration ? (currentTime / duration) * 100 : 0);
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const duration = Number.isFinite(videoRef.current.duration) ? videoRef.current.duration : videoDuration;
    const currentTime = videoRef.current.currentTime;
    setVideoCurrentTime(currentTime);
    setVideoDuration(duration || 0);
    setVideoProgress(duration ? (currentTime / duration) * 100 : 0);
  };

  const handleVideoSeek = (newValue: number) => {
    if (!videoRef.current || !videoDuration) return;
    videoRef.current.currentTime = (newValue / 100) * videoDuration;
    setVideoProgress(newValue);
  };

  const navigateToTab = (tab: 'dashboard' | 'upload' | 'testcases' | 'bugs' | 'integrations' | 'analytics' | 'profile') => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleTriggerAITestGeneration = async () => {
    if (!activeProject) {
      setDataError('No project selected. Please create or select a project first.');
      return;
    }
    if (!customAppDesc.trim()) {
      setDataError('Please enter an app description before triggering AI generation.');
      return;
    }
    setAiGenerating(true);
    setGenerationLog(customAppDesc.length > 10000 ? ['Large specification detected. Processing every section in coverage batches; this may take several minutes.'] : []);
    
    const logs = [
      "Initializing AI Flow Analyzer Agent...",
      "Analyzing user flows & state transitions based on product specs...",
      "Activating AI Visual Auditor Agent for responsive & alignment rules...",
      "Requesting backend AI generation service...",
      "Compiling full-perspective test suite...",
      "Saving generated test cases into PostgreSQL..."
    ];

    try {
      for (const logText of logs.slice(0, -1)) {
        setGenerationLog(prev => [...prev, logText]);
        await new Promise(resolve => setTimeout(resolve, 450));
      }

      await generateTestCasesFromApi({
        projectId: activeProject.id,
        appDescription: customAppDesc,
        perspectives: selectedPerspectives,
        platform: selectedPlatform,
        testCount: getRequestedTestCount(),
      });

      setGenerationLog(prev => [...prev, logs[logs.length - 1]]);
      await loadProjectData(activeProject.id);
      setActiveTab('testcases');
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to generate test cases.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleParseLogs = async () => {
    if (!logInputText.trim()) return;
    setParsedLogStatus('parsing');
    setDataError('');

    try {
      const analysis = await parseTelemetry({
        telemetry: logInputText,
        timestamp: formatTime(videoCurrentTime),
      });

      const newEvent: TimelineEvent = {
        id: `LOG-EVT-${Date.now()}`,
        time: formatTime(videoCurrentTime),
        event: analysis.event,
        type: analysis.type,
        desc: analysis.description,
        status: analysis.status,
      };

      setTimelineEvents(prev => [...prev, newEvent]);
      setParsedLogStatus('success');
      setLogInputText('');
      setActiveLogMsg('Gemini analyzed the telemetry and added it to the recording timeline.');
      setTimeout(() => setActiveLogMsg(''), 4000);
    } catch (error) {
      setParsedLogStatus('failed');
      setDataError(error instanceof Error ? error.message : 'Gemini telemetry analysis failed.');
    }
  };

  const handleAddManualTestCase = async () => {
    if (!activeProject || !manualTestCase.title.trim()) return;

    try {
      await createTestCase({
        projectId: activeProject.id,
        title: manualTestCase.title.trim(),
        preconditions: manualTestCase.preconditions.trim(),
        steps: manualTestCase.steps
          .split('\n')
          .map(step => step.trim())
          .filter(Boolean),
        expectedResult: manualTestCase.expectedResult.trim(),
        severity: manualTestCase.severity,
        priority: manualTestCase.priority,
        testType: manualTestCase.testType.trim() || 'Manual',
        platform: manualTestCase.platform.trim() || 'Web Application',
        module: manualTestCase.module.trim() || 'General',
        tags: manualTestCase.tags
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean),
      });

      await loadProjectData(activeProject.id);
      setShowAddTestCaseForm(false);
      setManualTestCase({
        title: '',
        preconditions: '',
        steps: '',
        expectedResult: '',
        severity: 'MEDIUM',
        priority: 'P2',
        testType: 'Manual',
        platform: 'Web Application',
        module: 'General',
        tags: '',
      });
      setActiveLogMsg('Manual test case saved.');
      setTimeout(() => setActiveLogMsg(''), 3000);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to add test case.');
    }
  };

  const handleDeleteTestCase = async (testCaseId: string) => {
    if (!activeProject) return;

    try {
      await deleteTestCase(testCaseId);
      await loadProjectData(activeProject.id);
      setActiveLogMsg('Test case deleted.');
      setTimeout(() => setActiveLogMsg(''), 3000);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to delete test case.');
    }
  };

  const handleClearTestCases = async () => {
    if (!activeProject || testCases.length === 0) return;
    if (!window.confirm('Clear all test cases for this project?')) return;

    try {
      await clearTestCases(activeProject.id);
      await loadProjectData(activeProject.id);
      setActiveLogMsg('All test cases cleared.');
      setTimeout(() => setActiveLogMsg(''), 3000);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to clear test cases.');
    }
  };

  const startOAuthGithub = async () => {
    try {
      setOauthStep('authenticating');
      window.location.href = await getGitHubAuthUrl();
    } catch (error) {
      setOauthStep('disconnected');
      setDataError(error instanceof Error ? error.message : 'GitHub OAuth is not configured.');
    }
  };

  const handleCreateRepository = async () => {
    if (!activeProject || !newRepoName.trim()) return;
    try {
      setIsCreatingRepo(true);
      setDataError('');
      const repo = await createGitHubRepository({ projectId: activeProject.id, name: newRepoName.trim(), private: newRepoPrivate });
      setGithubUser(prev => prev ? { ...prev, repos: Array.from(new Set([...prev.repos, repo.full_name])) } : prev);
      setSelectedRepo(repo.full_name);
      setNewRepoName('');
      setActiveLogMsg(`Created ${repo.full_name} on GitHub.`);
      setTimeout(() => setActiveLogMsg(''), 3500);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to create GitHub repository.');
    } finally {
      setIsCreatingRepo(false);
    }
  };

  const handleToggleTestCase = async (testCaseId: string) => {
    if (expandedTestCaseId === testCaseId) {
      setExpandedTestCaseId(null);
      return;
    }
    setExpandedTestCaseId(testCaseId);
    setAutomationTab('playwright');
    if (automationByTestCase[testCaseId]) return;
    try {
      setAutomationLoadingId(testCaseId);
      const automation = await getTestCaseAutomation(testCaseId);
      setAutomationByTestCase(previous => ({ ...previous, [testCaseId]: automation }));
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to load automation scripts.');
    } finally {
      setAutomationLoadingId(null);
    }
  };

  const handleTestCaseStatus = async (testCaseId: string, status: TestCase['status']) => {
    try {
      await updateTestCaseStatus(testCaseId, { status });
      setTestCaseData(previous => previous.map(test => test.id === testCaseId ? { ...test, status } : test));
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to update test status.');
    }
  };

  const handleCopyScript = async (testCaseId: string, label: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      const copyKey = `${testCaseId}-${label}`;
      setCopiedScript(copyKey);
      setTimeout(() => setCopiedScript(''), 2000);
    } catch {
      setDataError('Could not copy the script. Select the code and copy it manually.');
    }
  };

  const handleCreateAndPushRepo = async () => {
    if (!selectedRepo || !activeProject) return;
    setIsPushingCode(true);
    setGitTerminalLogs([]);
    setPushedSuccess(false);
    setPullRequestUrl('');
    try {
      const result = await publishProjectToGitHub({ projectId: activeProject.id, repositoryFullName: selectedRepo });
      setGitTerminalLogs(result.logs.map(log => `[github] ${log}`));
      setPullRequestUrl(result.pullRequestUrl);
      setPushedSuccess(true);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to publish to GitHub.');
      setGitTerminalLogs(['[github] Publish failed. See the error message above.']);
    } finally {
      setIsPushingCode(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    if (!window.confirm('Disconnect GitHub from TestMind AI?')) return;
    try {
      await disconnectGitHub();
      setGithubUser(null); setSelectedRepo(''); setOauthStep('disconnected'); setGitTerminalLogs([]); setPushedSuccess(false);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to disconnect GitHub.');
    }
  };

  const handleCreateGitHubIssue = async (bugId: string) => {
    if (!selectedRepo) { setDataError('Select a GitHub repository in Integrations first.'); return; }
    try {
      const result = await pushBugToGitHub({ bugId, repoName: selectedRepo });
      setBugReports(prev => prev.map(bug => bug.id === bugId ? { ...bug, githubIssueUrl: result.issueUrl } : bug));
      window.open(result.issueUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Failed to create GitHub issue.');
    }
  };

  const filteredTestCases = useMemo(() => {
    return testCases.filter(tc => {
      const matchPlatform = testFilterPlatform === 'All' || tc.platform.toLowerCase().includes(testFilterPlatform.toLowerCase());
      const matchSeverity = testFilterSeverity === 'All' || tc.severity === testFilterSeverity;
      return matchPlatform && matchSeverity;
    });
  }, [testCases, testFilterPlatform, testFilterSeverity]);

  const bugPlatformMetrics = useMemo(() => {
    const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-sky-500', 'bg-rose-500'];
    const counts = bugs.reduce<Record<string, number>>((acc, bug) => {
      const platform = testCases.find(testCase => testCase.module === bug.module)?.platform || activeProject?.platform_type || 'Unassigned';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {});

    const total = Math.max(bugs.length, 1);
    return Object.entries(counts).map(([platform, count], index) => ({
      platform,
      count,
      pct: Math.round((count / total) * 100),
      color: colors[index % colors.length],
    }));
  }, [activeProject?.platform_type, bugs, testCases]);

  const severityMetrics = useMemo(() => {
    const severities: TestCase['severity'][] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    return severities.map(severity => {
      const matching = testCases.filter(testCase => testCase.severity === severity);
      const passed = matching.filter(testCase => testCase.status === 'passed').length;
      return {
        agent: `${severity} Coverage`,
        time: `${passed}/${matching.length} passed`,
        pct: matching.length ? Math.round((passed / matching.length) * 100) : 0,
      };
    });
  }, [testCases]);

  const tokenEstimate = useMemo(() => {
    const descriptionTokens = Math.ceil(customAppDesc.length / 4);
    const testCaseTokens = testCases.reduce((total, testCase) => total + Math.ceil(JSON.stringify(testCase).length / 4), 0);
    return descriptionTokens + testCaseTokens;
  }, [customAppDesc, testCases]);

  return (
    <div className="h-screen bg-slate-950 text-slate-100 font-sans flex overflow-hidden">
      <a href="#main-content" className="fixed left-4 top-3 z-50 -translate-y-20 focus:translate-y-0 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold shadow-lg">
        Skip to main content
      </a>
      {/* SIDEBAR NAVIGATION */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/75 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 h-screen w-72 shrink-0 overflow-hidden bg-slate-900 border-r border-slate-800 flex flex-col justify-between transform transition-transform duration-300 md:sticky md:top-0 md:translate-x-0 md:w-64 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div>
          {/* Logo Brand Panel */}
          <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
            <div className="brand-logo-shell">
              <img src="/TestMindAI/testmind-logo-v4.png" alt="TestMind AI" className="brand-logo" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wide text-white">TestMind AI</h1>
              <span className="text-xs text-indigo-400 font-semibold">QA workspace</span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="p-4 space-y-1.5">
            <button 
              onClick={() => navigateToTab('dashboard')} 
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'dashboard' ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <LayoutGrid className="w-4.5 h-4.5" />
              <span>Dashboard</span>
            </button>

            <button 
              onClick={() => navigateToTab('upload')} 
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'upload' ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Upload className="w-4.5 h-4.5" />
              <span>Analyze recording</span>
            </button>

            <button 
              onClick={() => navigateToTab('testcases')} 
              className={`w-full flex items-center space-x-3 justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'testcases' ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-4.5 h-4.5" />
                <span>Test Library</span>
              </div>
              <span className="bg-slate-800 text-slate-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                {testCases.length}
              </span>
            </button>

            <button 
              onClick={() => navigateToTab('bugs')} 
              className={`w-full flex items-center space-x-3 justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'bugs' ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <div className="flex items-center space-x-3">
                <Bug className="w-4.5 h-4.5" />
              <span>Bug reports</span>
              </div>
              <span className="bg-rose-900/40 text-rose-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                {bugs.length}
              </span>
            </button>

            <button 
              onClick={() => navigateToTab('integrations')} 
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'integrations' ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <GitBranch className="w-4.5 h-4.5" />
              <span>Integrations</span>
            </button>

            <button 
              onClick={() => navigateToTab('analytics')} 
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'analytics' ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <BarChart2 className="w-4.5 h-4.5" />
              <span>Analytics</span>
            </button>
          </nav>
        </div>

        {/* User Workspace Info Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <button
            onClick={() => navigateToTab('profile')}
            className={`w-full flex items-center gap-2 mb-2 px-1.5 py-1.5 rounded-lg text-left hover:bg-slate-800 transition ${activeTab === 'profile' ? 'bg-slate-800 ring-1 ring-slate-700' : ''}`}
            aria-label="Open profile and settings"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-[10px] uppercase shrink-0">{userProfile?.name?.split(/\s+/).map(part => part[0]).join('').slice(0, 2) || 'U'}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-300">{userProfile?.name || 'Loading profile...'}</p>
              <p className="text-[10px] text-slate-500">{userProfile?.job_title || 'QA Professional'} · {userProfile?.plan_name || 'Workspace'}</p>
            </div>
            <Settings className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          </button>
          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
              <span>Estimated workspace tokens</span>
              <span>{Math.min(100, Math.round((tokenEstimate / 20000) * 100))}%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full" style={{ width: `${Math.min(100, Math.round((tokenEstimate / 20000) * 100))}%` }} />
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN SCREEN PANEL AREA */}
      <main id="main-content" className="h-screen flex-1 flex flex-col min-w-0 bg-slate-950 overflow-y-auto" tabIndex={-1}>
        
        {/* TOP COMPONENT HEADER BAR */}
        <header className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 py-4 shrink-0 flex items-center justify-between z-10 sticky top-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-slate-300 transition"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs bg-indigo-500/15 text-indigo-400 font-semibold px-2.5 py-1 rounded-full border border-indigo-500/20">
              Active Project: {activeProject?.name || 'Loading workspace...'}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={async () => {
                if (!activeProject) return;
                await loadProjectData(activeProject.id);
                setActiveLogMsg('Workspace refreshed from PostgreSQL.');
                setTimeout(() => setActiveLogMsg(''), 3000);
              }}
              className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 px-3 py-1.5 rounded border border-slate-700 transition"
              title="Refresh database state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <div className="h-6 w-px bg-slate-800" />
            <span className="text-xs font-semibold text-emerald-400 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block mr-1" />
              AI services online
            </span>
          </div>
        </header>

        {/* Toast Toast Alert Notification System */}
        {activeLogMsg && (
          <div className="mx-8 mt-4 p-3 bg-indigo-950/80 border border-indigo-800 text-indigo-300 rounded-lg flex items-center space-x-2 text-sm animate-bounce shadow-xl">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{activeLogMsg}</span>
          </div>
        )}

        {(isAppLoading || dataError) && (
          <div className={`mx-8 mt-4 p-3 border rounded-lg text-sm ${dataError ? 'bg-rose-950/70 border-rose-800 text-rose-200' : 'bg-slate-900 border-slate-800 text-slate-300'}`}>
            {dataError || 'Loading dynamic workspace from the backend...'}
          </div>
        )}

        {/* MAIN BODY CONTENTS SWITCHER */}
<div className="p-4 md:p-8 flex-1">
          
          {/* ==================== 1. DASHBOARD VIEW ==================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* Top HERO Callout AI Generative Test Section */}
              <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-800/40 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
                <div className="absolute right-0 top-0 opacity-10 transform translate-x-10 -translate-y-10 pointer-events-none">
                  <Cpu className="w-96 h-96 text-white" />
                </div>
                
                <div className="max-w-3xl relative z-10">
                  <div className="flex items-center space-x-2 bg-indigo-500/25 text-indigo-300 px-3 py-1 rounded-full text-xs font-semibold w-max mb-4 border border-indigo-500/30">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-300 animate-spin" />
                    <span>Dynamic Gemini Generative Test Plan Engine</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Automate Test Plans & Edge Cases from Spec</h2>
                  <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                    Our multi-agent system processes manual platform descriptions and recording inputs to write production-grade test cases, user journeys, WCAG audits, and security boundaries. Try it below:
                  </p>

                  <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Configure target system description</label>
                      <textarea 
                        value={customAppDesc}
                        onChange={(e) => setCustomAppDesc(e.target.value)}
                        onPaste={handleDescriptionPaste}
                        placeholder="Describe the product under test, then generate cases from the live backend."
                        className="w-full min-h-40 resize-y bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-100 placeholder-slate-600"
                        rows={7}
                      />
                      <div className="mt-1 flex flex-wrap justify-between gap-2 text-[10px] text-slate-500"><span>Large user stories and specifications are supported.</span><span className={customAppDesc.length > 18000 ? 'text-indigo-500 font-semibold' : ''}>{customAppDesc.length.toLocaleString()} characters{customAppDesc.length > 18000 ? ' · Gemini will handle this large input' : ''}</span></div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform</label>
                        <div className="flex flex-wrap gap-2">
                          {['Web', 'Desktop', 'Mobile', 'Mac', 'Tablet'].map(platform => (
                            <button
                              key={platform}
                              type="button"
                              onClick={() => setSelectedPlatform(platform)}
                              className={`text-xs px-3 py-1.5 rounded-full border transition font-medium ${selectedPlatform === platform ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'}`}
                            >
                              {platform}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Test case volume</label>
                        <div className="flex flex-wrap gap-2">
                          {['5', '10', '20', '30', 'Auto', 'Custom'].map(option => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setSelectedTestCount(option as typeof selectedTestCount)}
                              className={`text-xs px-3 py-1.5 rounded-full border transition font-medium ${selectedTestCount === option ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'}`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                        {selectedTestCount === 'Custom' && (
                          <input
                            type="number"
                            min={1}
                            value={customTestCount}
                            onChange={(e) => setCustomTestCount(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-100"
                            placeholder="Enter a custom count"
                          />
                        )}
                        {selectedTestCount === 'Auto' && (
                          <p className="text-[11px] text-slate-400">Auto will generate as many test cases as possible, no strict upper limit.</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 items-center justify-between pt-2">
                      <div className="flex flex-wrap gap-2">
                        {['UI/UX Checklists', 'Functional Flows', 'Edge Cases', 'Accessibility Audit'].map((persp) => {
                          const isActive = selectedPerspectives.includes(persp);
                          return (
                            <button
                              key={persp}
                              type="button"
                              onClick={() => {
                                setSelectedPerspectives(prev => 
                                  isActive ? prev.filter(x => x !== persp) : [...prev, persp]
                                );
                              }}
                              className={`text-xs px-3 py-1.5 rounded-full border transition font-medium ${isActive ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'}`}
                            >
                              {persp}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={handleTriggerAITestGeneration}
                        disabled={aiGenerating}
                        className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition shadow-lg shadow-indigo-600/20"
                      >
                        {aiGenerating ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>AI Generating Tests...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Trigger AI Agents Suite</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {aiGenerating && (
                    <div className="mt-4 p-3 bg-slate-950/90 border border-slate-800 rounded-lg space-y-2">
                      <p className="text-xs text-indigo-400 font-bold flex items-center space-x-1.5 animate-pulse">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Execution log output:</span>
                      </p>
                      <div className="space-y-1 font-mono text-[11px] text-slate-400 max-h-32 overflow-y-auto">
                        {generationLog.map((log, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <span className="text-indigo-500 font-bold">&gt;</span>
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* STATS COUNT GRID */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-md flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Execution Coverage</span>
                    <h3 className="text-3xl font-bold text-white mt-1">{testCases.length ? Math.round((testCases.filter(test => test.status !== 'pending').length / testCases.length) * 100) : 0}%</h3>
                    <span className="text-emerald-400 text-xs font-semibold flex items-center mt-1">{testCases.filter(test => test.status !== 'pending').length} of {testCases.length} executed</span>
                  </div>
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-md flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Total Test Cases</span>
                    <h3 className="text-3xl font-bold text-white mt-1">{testCases.length}</h3>
                    <span className="text-slate-400 text-xs mt-1 block">
                      {testCases.filter(t => t.status === 'passed').length} Passed, {testCases.filter(t => t.status === 'failed').length} Failed
                    </span>
                  </div>
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-md flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Active Bugs Tracked</span>
                    <h3 className="text-3xl font-bold text-rose-500 mt-1">{bugs.length}</h3>
                    <span className="text-rose-400 text-xs font-semibold flex items-center mt-1">
                      {bugs.filter(b => b.severity === 'CRITICAL').length} Critical, {bugs.filter(b => b.severity === 'HIGH').length} High
                    </span>
                  </div>
                  <div className="p-3 bg-rose-500/10 text-rose-400 rounded-lg">
                    <Bug className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-md flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Pass Rate</span>
                    <h3 className="text-3xl font-bold text-white mt-1">{testCases.filter(test => ['passed','failed'].includes(test.status)).length ? Math.round((testCases.filter(test => test.status === 'passed').length / testCases.filter(test => ['passed','failed'].includes(test.status)).length) * 100) : 0}%</h3>
                    <span className="text-slate-400 text-xs mt-1 block">Based on completed test runs</span>
                  </div>
                  <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg">
                    <Award className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* PLATFORM SCOPE MATRIX SECTION */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">Cross-Platform Verification Capabilities</h3>
                <p className="text-slate-400 text-sm mb-6">
                  TestMind AI validates video, OCR, and log streams universally. Configure test cases specifically for these platforms:
                </p>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { title: "Video Games", sub: "Unity, Unreal, Mobile, WebGL", icon: Gamepad2, color: "text-purple-400", bg: "bg-purple-500/10" },
                    { title: "Websites", sub: "E-Commerce, Dashboards, Static", icon: Globe, color: "text-blue-400", bg: "bg-blue-500/10" },
                    { title: "SaaS Apps", sub: "CRM, Admin Panels, Portals", icon: Laptop, color: "text-cyan-400", bg: "bg-cyan-500/10" },
                    { title: "Mobile Apps", sub: "Flutter, React Native, iOS, Android", icon: Smartphone, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                    { title: "Desktop Apps", sub: "Windows, macOS, Electron", icon: Compass, color: "text-pink-400", bg: "bg-pink-500/10" }
                  ].map((plat, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex flex-col items-center text-center space-y-3">
                      <div className={`p-3 rounded-full ${plat.bg} ${plat.color}`}>
                        <plat.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">{plat.title}</h4>
                        <p className="text-slate-400 text-[11px] mt-1">{plat.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* INTEGRATIONS AND EXPORT DIRECTIVES SUMMARY */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Visual Bug Overview List */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-white flex items-center space-x-2">
                      <Bug className="w-4.5 h-4.5 text-rose-500" />
                      <span>Critical Failures Identified</span>
                    </h4>
                    <button onClick={() => setActiveTab('bugs')} className="text-xs text-indigo-400 hover:underline">
                      View Board
                    </button>
                  </div>
                  <div className="space-y-3">
                    {bugs.slice(0, 2).map((b) => (
                      <div key={b.id} className="bg-slate-950 border border-slate-800/85 p-3.5 rounded-lg flex items-start space-x-3">
                        <span className="bg-rose-950/40 text-rose-400 px-2.5 py-1 rounded text-xs font-bold font-mono">
                          {b.severity}
                        </span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-sm text-slate-200">{b.title}</h5>
                          <p className="text-slate-400 text-xs mt-1">{b.module}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Integration status info */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h4 className="font-bold text-white mb-2 flex items-center space-x-2">
                    <GitBranch className="w-4.5 h-4.5 text-indigo-500" />
                    <span>Active GitHub Connection Status</span>
                  </h4>
                  <p className="text-slate-400 text-sm mb-4">
                    Instantly package code, Dockerfiles, and PR suites into dynamic GitHub repositories.
                  </p>
                  
                  {oauthStep !== 'connected' ? (
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-center">
                      <p className="text-xs text-slate-400 mb-3">No active OAuth sessions found</p>
                      <button 
                        onClick={() => setActiveTab('integrations')} 
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded font-semibold transition inline-flex items-center space-x-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open GitHub Manager</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <div className="flex justify-between items-center text-xs mb-2">
                        <span className="text-slate-400">Connected User:</span>
                        <span className="font-mono text-emerald-400">{githubUser?.name}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Integrated Repos:</span>
                        <span className="text-slate-200 font-semibold">{githubUser?.repos.length}</span>
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* ==================== 2. SCREEN RECORDING AND LOG PARSER VIEW ==================== */}
          {activeTab === 'upload' && (
            <div className="space-y-8 animate-fadeIn">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Live Simulated Recording Upload Box & Video Viewer */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">Visual Timeline Analysis</h3>
                      <p className="text-xs text-slate-400">Analyze UI recordings side-by-side with OCR events and console dumps</p>
                    </div>
                      <span className="self-start bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded font-mono font-semibold">
                      MP4 - 1080p @ 60 FPS
                    </span>
                  </div>

                  {/* Video Canvas Frame */}
                  <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden relative aspect-[4/3] sm:aspect-video flex flex-col justify-between">
                    {uploadedVideoUrl ? (
                      <video
                        ref={videoRef}
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        onTimeUpdate={handleVideoTimeUpdate}
                        onPlay={() => setIsPlayingVideo(true)}
                        onPause={() => setIsPlayingVideo(false)}
                        onEnded={() => setIsPlayingVideo(false)}
                        className="absolute inset-0 h-full w-full bg-black object-contain"
                        src={uploadedVideoUrl}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3">
                        <div className="p-4 bg-slate-900/80 rounded-full border border-slate-700">
                          <Upload className="w-8 h-8 text-indigo-400" />
                        </div>
                        <p className="text-xs text-slate-400">Upload a recording to inspect its real timeline.</p>
                      </div>
                    )}

                    {/* Recording Visual overlay */}
                    <div className="p-4 bg-gradient-to-b from-slate-950/95 to-transparent flex justify-between items-center z-10">
                      <div className="flex items-center space-x-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${isPlayingVideo ? 'bg-rose-500 animate-ping' : 'bg-slate-500'}`} />
                        <span className="text-xs text-white uppercase font-bold tracking-wider">
                          {uploadedVideoFile?.name || 'No recording loaded'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">Duration: {formatTime(videoDuration)}</span>
                    </div>

                    {/* Bottom controls panel */}
                    <div className="p-4 bg-gradient-to-t from-slate-950/95 to-transparent flex flex-col space-y-3 z-10">
                      
                      {/* Video progress track line */}
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-slate-400 font-mono">{formatTime(videoCurrentTime)}</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={0.1}
                          value={videoProgress}
                          disabled={!uploadedVideoUrl}
                          onChange={(e) => handleVideoSeek(Number(e.target.value))}
                          className="flex-1 accent-indigo-500 disabled:opacity-40"
                        />
                        <span className="text-xs text-slate-400 font-mono">{formatTime(videoDuration)}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                          <button 
                            onClick={handleVideoPlayPause}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-full transition"
                          >
                            {isPlayingVideo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white translate-x-0.5" />}
                          </button>
                          
                          <button 
                            onClick={() => {
                              if (videoRef.current) {
                                videoRef.current.currentTime = 0;
                                videoRef.current.pause();
                              }
                              setVideoProgress(0);
                              setVideoCurrentTime(0);
                              setIsPlayingVideo(false);
                            }}
                            className="text-slate-400 hover:text-white transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>

                        <span className="text-xs font-mono text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-900">
                          Timeline Segment: {formatTime(videoCurrentTime)}
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* Drag and Drop Zone Simulator */}
                  <div
                    onDrop={handleVideoDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={handleUploadZoneClick}
                    className={`bg-slate-950 border-2 border-dashed rounded-xl p-6 text-center hover:border-indigo-500 transition cursor-pointer ${isDraggingUpload ? 'border-indigo-500/70 bg-indigo-950/10' : 'border-slate-800 bg-slate-950'}`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/ogg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleVideoUpload(file);
                      }}
                    />
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-white">Upload recording for analysis</p>
                    <p className="text-xs text-slate-500 mt-1">Drag and drop MP4, WEBM or OGG files here or click to choose.</p>
                    <p className="text-xs text-slate-400 mt-3">{videoUploadMessage}</p>
                    {isProcessingUpload && (
                      <p className="text-xs text-indigo-300 mt-2 flex items-center justify-center space-x-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading video...</span>
                      </p>
                    )}
                    {uploadedVideoFile && (
                      <p className="text-xs text-slate-300 mt-2">
                        Loaded: {uploadedVideoFile.name} ({(uploadedVideoFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                    <div><h4 className="text-sm font-bold text-white">Test case settings</h4><p className="text-[11px] text-slate-500">Nothing is generated until you click Generate Test Cases.</p></div>
                    <div><textarea value={customAppDesc} onChange={event => setCustomAppDesc(event.target.value)} onPaste={handleDescriptionPaste} placeholder="Describe the product, story, or flow shown in the recording" rows={6} className="w-full min-h-36 resize-y bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600" /><div className="mt-1 flex flex-wrap justify-between gap-2 text-[10px] text-slate-500"><span>Paste a complete story or specification.</span><span className={customAppDesc.length > 18000 ? 'text-indigo-500 font-semibold' : ''}>{customAppDesc.length.toLocaleString()} characters{customAppDesc.length > 18000 ? ' · Gemini will handle this large input' : ''}</span></div></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="text-[10px] uppercase font-bold text-slate-500">Platform</label><div className="flex flex-wrap gap-1.5 mt-2">{['Web', 'Desktop', 'Mobile', 'Mac', 'Tablet'].map(platform => <button key={platform} onClick={() => setSelectedPlatform(platform)} className={`px-2.5 py-1.5 rounded text-[10px] border ${selectedPlatform === platform ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>{platform}</button>)}</div></div>
                      <div><label className="text-[10px] uppercase font-bold text-slate-500">Number of cases</label><div className="flex flex-wrap gap-1.5 mt-2">{['5', '10', '20', '30', 'Auto', 'Custom'].map(count => <button key={count} onClick={() => setSelectedTestCount(count as typeof selectedTestCount)} className={`px-2.5 py-1.5 rounded text-[10px] border ${selectedTestCount === count ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>{count}</button>)}</div>{selectedTestCount === 'Custom' && <input type="number" min={1} value={customTestCount} onChange={event => setCustomTestCount(event.target.value)} className="mt-2 w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs" />}</div>
                    </div>
                    <div><label className="text-[10px] uppercase font-bold text-slate-500">Test case types</label><div className="flex flex-wrap gap-1.5 mt-2">{['UI/UX Checklists', 'Functional Flows', 'Edge Cases', 'Accessibility Audit'].map(type => { const active = selectedPerspectives.includes(type); return <button key={type} onClick={() => setSelectedPerspectives(previous => active ? previous.filter(item => item !== type) : [...previous, type])} className={`px-2.5 py-1.5 rounded text-[10px] border ${active ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>{type}</button>; })}</div></div>
                    <button onClick={handleGenerateFromRecording} disabled={!uploadedVideoId || aiGenerating || isProcessingUpload} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2">{aiGenerating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate Test Cases</>}</button>
                  </div>
                  {uploadedVideoUrl && (
                    <div className="mt-3 space-y-3 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>{Math.floor(videoCurrentTime)}s</span>
                        <span>{videoDuration ? `${Math.floor(videoDuration)}s` : '…'}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={0.5}
                        value={videoProgress}
                        onChange={(e) => handleVideoSeek(Number(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <button
                          onClick={handleVideoPlayPause}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg transition"
                        >
                          {isPlayingVideo ? 'Pause Playback' : 'Play Playback'}
                        </button>
                        <span className="text-slate-500 truncate">{uploadedVideoFile?.name}</span>
                      </div>
                    </div>
                  )}
                  {uploadedVideoFile && (
                      <button
                        onClick={() => {
                          if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
                          setUploadedVideoFile(null);
                          setUploadedVideoId('');
                          setUploadedVideoUrl('');
                          setVideoUploadMessage('Drag & drop or choose a video file to analyze.');
                          setVideoDuration(0);
                          setVideoCurrentTime(0);
                          setVideoProgress(0);
                          setIsPlayingVideo(false);
                        }}
                        className="mt-3 text-xs text-indigo-300 hover:text-white"
                      >
                        Clear uploaded file
                      </button>
                    )}
                </div>

                {/* Gemini Engine Log & Parser Panel */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-md font-bold text-white flex items-center space-x-2">
                      <Terminal className="w-4.5 h-4.5 text-indigo-400" />
                      <span>Gemini Interactive Telemetry Parser</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Paste console stack traces, network telemetry data, or error logs below. Our parser parses raw events and maps them directly to recording milestones.
                    </p>

                    <div className="mt-4 space-y-3">
                      <textarea
                        value={logInputText}
                        onChange={(e) => setLogInputText(e.target.value)}
                        placeholder="e.g. [ERROR] Uncaught ReferenceError: payloadData is not defined at FormSubmit.js:144"
                        className="w-full h-40 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-200 placeholder-slate-700"
                      />

                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setLogInputText("[NETWORK] POST /v1/onboarding failed with status code 500 -- Server timed out processing payloadData inputs after 4500ms");
                          }}
                          className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded hover:bg-slate-700 transition"
                        >
                          Fill Sample 500 error
                        </button>
                        <button
                          onClick={() => {
                            setLogInputText("[WARN] React responsive layout collapsed -- overlap detected on selector #promo-banner matching viewport size 375px");
                          }}
                          className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded hover:bg-slate-700 transition"
                        >
                          Fill Layout warning
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleParseLogs}
                    disabled={parsedLogStatus === 'parsing' || !logInputText.trim()}
                    className="w-full mt-4 flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-xs font-semibold font-mono transition"
                  >
                    {parsedLogStatus === 'parsing' ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Gemini is analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Analyze with Gemini</span>
                      </>
                    )}
                  </button>
                </div>

              </div>

              {/* TIMELINE STREAM EVENTS GRID */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Chronological Event Timeline</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {timelineEvents.map((evt) => (
                    <div 
                      key={evt.id} 
                      className={`p-4 rounded-lg border flex flex-col justify-between ${
                        evt.status === 'critical' ? 'bg-rose-950/20 border-rose-900/50' :
                        evt.status === 'warning' ? 'bg-amber-950/20 border-amber-900/50' : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-mono text-xs font-bold text-indigo-400">{evt.time}</span>
                          <span className={`w-2 h-2 rounded-full ${
                            evt.status === 'critical' ? 'bg-rose-500' :
                            evt.status === 'warning' ? 'bg-amber-500' : 'bg-indigo-400'
                          }`} />
                        </div>
                        <p className="text-xs text-slate-400 font-semibold">{evt.event}</p>
                        <p className="text-[11px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">{evt.type}</p>
                        <p className="text-xs text-slate-200 mt-2 line-clamp-2 leading-relaxed">{evt.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ==================== 3. TEST CASES LIBRARY ==================== */}
          {activeTab === 'testcases' && (
            <div className="space-y-8 animate-fadeIn">
              
              <div>
                
                {/* Left Test Case Library Selection */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Project Test Case Library</h3>
                      <p className="text-xs text-slate-400">Total verified test cases generated organically & by AI modules</p>
                    </div>

                    {/* Filter controllers */}
                    <div className="grid grid-cols-2 gap-2 w-full md:flex md:flex-wrap md:w-auto">
                      <button
                        onClick={() => setShowAddTestCaseForm(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded font-semibold transition flex items-center space-x-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Test Case</span>
                      </button>
                      <button
                        onClick={handleClearTestCases}
                        disabled={testCases.length === 0}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs px-3 py-1.5 rounded font-semibold transition flex items-center space-x-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear TestCases</span>
                      </button>
                      <select 
                        value={testFilterPlatform} 
                        onChange={(e) => setTestFilterPlatform(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="All">All Platforms</option>
                        <option value="Web Application">Web Apps</option>
                        <option value="Mobile">Mobile Apps</option>
                        <option value="Game">Video Games</option>
                      </select>

                      <select 
                        value={testFilterSeverity} 
                        onChange={(e) => setTestFilterSeverity(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="All">All Severities</option>
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="LOW">LOW</option>
                      </select>
                    </div>
                  </div>

                  {showAddTestCaseForm && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white">Add Manual Test Case</h4>
                        <button
                          onClick={() => setShowAddTestCaseForm(false)}
                          className="text-slate-400 hover:text-white transition"
                          aria-label="Close manual test case form"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          value={manualTestCase.title}
                          onChange={(e) => setManualTestCase(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Title"
                          className="md:col-span-2 bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none"
                        />
                        <input
                          value={manualTestCase.preconditions}
                          onChange={(e) => setManualTestCase(prev => ({ ...prev, preconditions: e.target.value }))}
                          placeholder="Preconditions"
                          className="bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none"
                        />
                        <input
                          value={manualTestCase.expectedResult}
                          onChange={(e) => setManualTestCase(prev => ({ ...prev, expectedResult: e.target.value }))}
                          placeholder="Expected result"
                          className="bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none"
                        />
                        <textarea
                          value={manualTestCase.steps}
                          onChange={(e) => setManualTestCase(prev => ({ ...prev, steps: e.target.value }))}
                          placeholder="Steps, one per line"
                          rows={4}
                          className="md:col-span-2 bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none"
                        />
                        <select
                          value={manualTestCase.severity}
                          onChange={(e) => setManualTestCase(prev => ({ ...prev, severity: e.target.value as TestCase['severity'] }))}
                          className="bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none"
                        >
                          <option value="CRITICAL">CRITICAL</option>
                          <option value="HIGH">HIGH</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="LOW">LOW</option>
                        </select>
                        <select
                          value={manualTestCase.priority}
                          onChange={(e) => setManualTestCase(prev => ({ ...prev, priority: e.target.value as TestCase['priority'] }))}
                          className="bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none"
                        >
                          <option value="P0">P0</option>
                          <option value="P1">P1</option>
                          <option value="P2">P2</option>
                          <option value="P3">P3</option>
                        </select>
                        <input
                          value={manualTestCase.module}
                          onChange={(e) => setManualTestCase(prev => ({ ...prev, module: e.target.value }))}
                          placeholder="Module"
                          className="bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none"
                        />
                        <input
                          value={manualTestCase.tags}
                          onChange={(e) => setManualTestCase(prev => ({ ...prev, tags: e.target.value }))}
                          placeholder="Tags, comma-separated"
                          className="bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none"
                        />
                      </div>

                      <button
                        onClick={handleAddManualTestCase}
                        disabled={!manualTestCase.title.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs px-4 py-2 rounded font-semibold transition"
                      >
                        Save Test Case
                      </button>
                    </div>
                  )}

                  {/* Test Cards List Grid */}
                  <div className="space-y-4">
                    {filteredTestCases.map((tc) => (
                      <details
                        key={tc.id}
                        className="group rounded-xl border border-slate-800 bg-slate-950 hover:border-slate-700 open:border-indigo-500/60 transition-all"
                        onToggle={(event) => {
                          if ((event.currentTarget as HTMLDetailsElement).open) handleToggleTestCase(tc.id);
                        }}
                      >
                        <summary className="list-none cursor-pointer p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                          <div className="min-w-0">
                            <div className="flex gap-2 items-center mb-2"><span className="font-mono text-[10px] text-indigo-400">{tc.id.slice(0, 8)}</span><span className="text-[10px] uppercase text-slate-500">{tc.testType}</span></div>
                            <h4 className="font-bold text-sm text-white">{tc.title}</h4>
                            <p className="text-xs text-slate-500 mt-1">{tc.module} · {tc.platform}</p>
                          </div>
                          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto shrink-0">
                            <span className={`w-2 h-2 rounded-full ${tc.status === 'passed' ? 'bg-emerald-500' : tc.status === 'failed' ? 'bg-rose-500' : tc.status === 'blocked' ? 'bg-sky-500' : 'bg-amber-500'}`} />
                            <span className="text-xs text-slate-400 capitalize">{tc.status}</span>
                            <ChevronDown className="w-4 h-4 text-slate-500 group-open:rotate-180 transition-transform" />
                          </div>
                        </summary>
                        <div className="p-4 border-t border-slate-800">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                            <span className="px-2 py-1 rounded bg-slate-900">{tc.severity}</span><span>{tc.priority}</span><span>·</span><span>{tc.tags.join(', ') || 'No tags'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {(['pending', 'passed', 'failed', 'blocked'] as TestCase['status'][]).map(status => <button key={status} onClick={() => handleTestCaseStatus(tc.id, status)} className={`px-2.5 py-1.5 rounded text-[10px] font-semibold capitalize border ${tc.status === status ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}>{status}</button>)}
                            <button onClick={() => handleDeleteTestCase(tc.id)} className="p-1.5 ml-1 rounded text-slate-500 hover:text-rose-400" aria-label={`Delete test case ${tc.title}`} title="Delete test case"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <p className="text-xs text-slate-400"><span className="text-slate-500 font-semibold block mb-1">Description</span>{tc.description || 'No separate description was provided.'}</p>
                          <p className="text-xs text-slate-400"><span className="text-slate-500 font-semibold block mb-1">Preconditions</span>{tc.preconditions}</p>
                        </div>

                        <div className="bg-slate-900/60 p-3 rounded border border-slate-850 space-y-1 mb-4">
                          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wide block mb-1">Execution Steps:</span>
                          {tc.steps.map((step, sIdx) => (
                            <div key={sIdx} className="text-xs text-slate-300 flex items-start space-x-1.5">
                              <span className="text-indigo-500 font-mono text-[10px]">{sIdx + 1}.</span>
                              <span className="leading-relaxed">{step}</span>
                            </div>
                          ))}
                        </div>

                        <div className="bg-emerald-950/15 border border-emerald-900/30 rounded-lg p-3 mb-4"><span className="text-[10px] text-emerald-400 font-bold uppercase">Expected result</span><p className="text-xs text-slate-300 mt-1">{tc.expectedResult || 'No expected result provided.'}</p></div>

                        <div className="border-t border-slate-800 py-5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <div><h5 className="text-sm font-bold text-white">Automation script</h5><p className="text-[11px] text-slate-500">Fill in the locator keys, then copy the script.</p></div>
                            <div className="flex gap-1 bg-slate-900 p-1 rounded-lg">{(['playwright', 'cypress', 'selenium'] as const).map(tab => <button key={tab} onClick={() => setAutomationTab(tab)} className={`px-3 py-1.5 rounded text-xs font-semibold capitalize ${automationTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{tab}</button>)}</div>
                          </div>
                          {automationLoadingId === tc.id ? <div className="p-8 text-center text-xs text-slate-500">Generating automation preview…</div> : automationByTestCase[tc.id] ? (
                            <div className="space-y-3">
                              <details className="bg-slate-900 border border-slate-800 rounded-lg">
                                <summary className="cursor-pointer list-none flex justify-between items-center p-3"><span><span className="text-[10px] font-bold text-indigo-400 uppercase block">Easy locator keys</span><span className="text-[10px] text-slate-500">TARGET = element to use · EXPECTED_RESULT = proof of success</span></span><span className="text-[10px] text-slate-500">Show values</span></summary>
                                <div className="px-3 pb-3"><div className="mb-2 p-2 rounded bg-indigo-950/20 border border-indigo-900/30 text-[10px] text-slate-400"><strong className="text-indigo-300">Use a CSS selector.</strong> Recommended: <code>[data-testid="save-button"]</code>. Alternatives: <code>#save-button</code> or <code>[name="email"]</code>. Avoid changing class names and long DOM paths.</div><div className="flex justify-end mb-1"><button onClick={() => handleCopyScript(tc.id, 'locators', JSON.stringify(automationByTestCase[tc.id].locators, null, 2))} className="text-[10px] text-slate-400 hover:text-white flex gap-1 items-center">{copiedScript === `${tc.id}-locators` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copy</button></div><pre className="text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(automationByTestCase[tc.id].locators, null, 2)}</pre></div>
                              </details>
                              <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                                <div className="flex justify-between px-3 py-2 border-b border-slate-800"><span className="text-[10px] font-bold text-slate-400 uppercase">{automationTab}</span><button onClick={() => handleCopyScript(tc.id, automationTab, automationByTestCase[tc.id][automationTab])} className="text-[10px] text-slate-400 hover:text-white flex gap-1 items-center">{copiedScript === `${tc.id}-${automationTab}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copy script</button></div>
                                <pre className="p-3 text-[11px] leading-relaxed text-slate-300 overflow-auto max-h-64"><code>{automationByTestCase[tc.id][automationTab]}</code></pre>
                              </div>
                            </div>
                          ) : <p className="text-xs text-rose-400">Automation preview could not be loaded.</p>}
                        </div>

                        <div className="border-t border-slate-900 pt-3 flex flex-wrap gap-2 justify-between items-center">
                          <div className="flex items-center space-x-2 text-xs text-slate-500">
                            <span>Platform: <strong className="text-slate-300">{tc.platform}</strong></span>
                            <span>•</span>
                            <span>Module: <strong className="text-slate-300">{tc.module}</strong></span>
                          </div>

                        </div>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ==================== 4. VISUAL BUG BOARD ==================== */}
          {activeTab === 'bugs' && (
            <div className="space-y-8 animate-fadeIn">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Project Bug Backlog</h3>
                  <p className="text-xs text-slate-400">AI automatically compiles screen coordinates, OCR transitions and diagnostic files into complete logs</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                
                {/* Left Side: Dynamic Bug Tickets List */}
                <div className="xl:col-span-2 space-y-4">
                  {bugs.map((bug) => (
                    <div key={bug.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center space-x-2.5">
                          <span className="font-mono text-xs font-bold text-rose-400 bg-rose-950/40 border border-rose-900/30 px-2 py-0.5 rounded">
                            {bug.id}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">Timestamp: {bug.timestamp}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            bug.severity === 'CRITICAL' ? 'bg-rose-950/50 text-rose-400 border border-rose-900/30' : 'bg-slate-950 text-slate-400'
                          }`}>
                            {bug.severity}
                          </span>
                          <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase">
                            {bug.priority}
                          </span>
                        </div>
                      </div>

                      <h4 className="font-bold text-sm text-white mb-2">{bug.title}</h4>
                      <p className="text-xs text-slate-400 mb-4">{bug.description}</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-lg border border-slate-850 mb-4">
                        <div>
                          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block mb-1">Expected Result:</span>
                          <p className="text-xs text-slate-300">{bug.expectedResult}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block mb-1">Actual Result:</span>
                          <p className="text-xs text-slate-300">{bug.actualResult}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 items-center justify-between border-t border-slate-950 pt-3">
                        <span className="text-xs text-slate-500 font-semibold">Affected Module: <strong className="text-slate-300">{bug.module}</strong></span>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setRcaTargetBug(bug)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded font-semibold transition flex items-center space-x-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Diagnose Bug (RCA)</span>
                          </button>
                          {oauthStep === 'connected' && selectedRepo && !bug.githubIssueUrl && (
                            <button onClick={() => handleCreateGitHubIssue(bug.id)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded font-semibold transition flex items-center space-x-1">
                              <GitBranch className="w-3.5 h-3.5" /><span>Create GitHub Issue</span>
                            </button>
                          )}
                          
                          {bug.githubIssueUrl && (
                            <a
                              href={bug.githubIssueUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded font-semibold transition flex items-center space-x-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>View Issue</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right Side Slide-In Panel Simulator: Root Cause Analysis (RCA) and Fix Proposal */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h3 className="text-md font-bold text-white mb-2 flex items-center space-x-2">
                    <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
                    <span>Gemini RCA & Code Fix Generator</span>
                  </h3>

                  {rcaTargetBug ? (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="bg-slate-950 p-3 rounded border border-slate-850">
                        <span className="text-[10px] text-slate-500 font-mono uppercase">Analyzing Ticket</span>
                        <h4 className="font-semibold text-xs text-slate-200 mt-0.5">{rcaTargetBug.id}: {rcaTargetBug.title}</h4>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">Suspected Root Cause:</span>
                        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded border border-slate-800">
                          {rcaTargetBug.rcaText}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Proposed Code Patch Fix:</span>
                        <pre className="bg-slate-950 text-[10px] font-mono p-3 rounded-lg border border-slate-800 text-slate-300 overflow-x-auto">
                          {rcaTargetBug.suggestedFix}
                        </pre>
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(rcaTargetBug.suggestedFix || '');
                            setActiveLogMsg("Code patch copied to clipboard!");
                            setTimeout(() => setActiveLogMsg(""), 3000);
                          }}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded text-xs font-semibold transition"
                        >
                          Copy Patch Code
                        </button>
                        <button
                          onClick={() => setRcaTargetBug(null)}
                          className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-400 py-2 rounded text-xs font-semibold transition"
                        >
                          Dismiss Analysis
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-950 p-6 rounded-lg text-center border border-slate-800">
                      <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Select any bug ticket on the left and click "Diagnose Bug (RCA)" to synthesize deep backend stack diagnostics & auto-patch code.</p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* ==================== 5. GITHUB AND INTEGRATIONS VIEW ==================== */}
          {activeTab === 'integrations' && (
            <div className="space-y-8 animate-fadeIn">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Connection Form Section */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                      <GitBranch className="w-5 h-5 text-indigo-400" />
                      <span>GitHub OAuth Connect Suite</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Integrate with GitHub to dynamically sync test workflows, push Docker assets, or trigger enterprise action workflows directly.
                    </p>
                  </div>

                  {oauthStep === 'disconnected' && (
                    <div className="bg-slate-950 p-8 rounded-lg border border-slate-800 text-center space-y-4">
                      <GitBranch className="w-12 h-12 text-slate-600 mx-auto" />
                      <div>
                        <h4 className="font-bold text-white text-sm">Secure OAuth Session Required</h4>
                        <p className="text-xs text-slate-400 mt-1">Log in securely with your GitHub account to authorize repository creation & commit workflows</p>
                      </div>
                      <button 
                        onClick={startOAuthGithub}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-5 py-2.5 rounded-lg font-semibold transition"
                      >
                        Authorize Connection
                      </button>
                    </div>
                  )}

                  {oauthStep === 'authenticating' && (
                    <div className="bg-slate-950 p-8 rounded-lg border border-slate-800 text-center space-y-4">
                      <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
                      <p className="text-xs text-slate-400 animate-pulse">Establishing handshake parameters via secure GitHub portal...</p>
                    </div>
                  )}

                  {oauthStep === 'connected' && (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          {githubUser?.avatarUrl ? <img src={githubUser.avatarUrl} alt="GitHub avatar" className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">GH</div>}
                          <div>
                            <p className="text-xs font-semibold text-white">{githubUser?.name}</p>
                            <p className="text-[10px] text-emerald-400 font-semibold font-mono">@{githubUser?.login} · GitHub verified</p>
                          </div>
                        </div>
                        <button onClick={handleDisconnectGitHub} className="border border-slate-700 px-3 py-1.5 rounded text-[10px] text-slate-300 hover:text-white">Disconnect</button>
                      </div>

                      <div className="space-y-4 bg-slate-950 p-5 rounded-lg border border-slate-850">
                        <h4 className="font-semibold text-sm text-slate-200">Dynamic Repository Actions Setup</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-2">Select Active Repository:</label>
                            <select 
                              value={selectedRepo}
                              onChange={(e) => {
                                setSelectedRepo(e.target.value);
                                setPushedSuccess(false);
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-100 focus:outline-none"
                            >
                              <option value="">-- Choose Repository --</option>
                              {githubUser?.repos.map((r, idx) => (
                                <option key={idx} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-2">Create New Repo instead:</label>
                            <div className="flex gap-2">
                              <input value={newRepoName} onChange={event => setNewRepoName(event.target.value)} placeholder="my-test-suite" className="min-w-0 flex-1 bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-100" />
                              <button onClick={handleCreateRepository} disabled={isCreatingRepo || !newRepoName.trim()} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-3 rounded text-xs font-semibold">{isCreatingRepo ? 'Creating…' : 'Create'}</button>
                            </div>
                            <label className="mt-2 flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={newRepoPrivate} onChange={event => setNewRepoPrivate(event.target.checked)} /> Private repository</label>
                          </div>
                        </div>

                        {selectedRepo && (
                          <div className="pt-2 border-t border-slate-900">
                            <button
                              onClick={handleCreateAndPushRepo}
                              disabled={isPushingCode}
                              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs py-2.5 rounded font-semibold transition"
                            >
                              {isPushingCode ? "Publishing real files..." : `Publish Test Cases & CI to: ${selectedRepo}`}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Real GitHub API operation output */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-md font-bold text-white flex items-center space-x-2">
                      <Terminal className="w-4.5 h-4.5 text-indigo-400" />
                      <span>GitHub Publish Log</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Live terminal view tracking push processes & Action states</p>

                    <div className="mt-4 bg-slate-950 border border-slate-850 p-3 rounded-lg font-mono text-[10px] text-slate-400 space-y-1.5 h-64 overflow-y-auto">
                      {gitTerminalLogs.length === 0 ? (
                        <p className="text-slate-650 italic">No task execution logs</p>
                      ) : (
                        gitTerminalLogs.map((log, idx) => (
                          <div key={idx} className="flex items-start space-x-1.5 leading-relaxed">
                            <span className="text-indigo-400">&gt;</span>
                            <span>{log}</span>
                          </div>
                        ))
                      )}
                      {pushedSuccess && (
                        <p className="text-emerald-400 font-bold block pt-2">
                          SUCCESS: Deployment verification webhook complete!
                        </p>
                      )}
                    </div>
                  </div>

                  {pushedSuccess && (
                    <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 rounded text-xs text-emerald-400 text-center animate-fadeIn">
                      Pull request opened successfully. {pullRequestUrl && <a href={pullRequestUrl} target="_blank" rel="noreferrer" className="underline font-semibold">Open it on GitHub</a>}
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* ==================== 6. CODEBASE VIEW ==================== */}
          {activeTab === 'profile' && (
            <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
              <div><h2 className="text-xl font-bold text-white">Profile & settings</h2><p className="text-xs text-slate-400 mt-1">Manage your basic account details and default test-generation options.</p></div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-5 border-b border-slate-800 flex items-center gap-3"><div className="w-11 h-11 rounded-full bg-indigo-600 flex items-center justify-center"><User className="w-5 h-5 text-white" /></div><div><p className="text-sm font-bold text-white">{profileForm.name || 'Your profile'}</p><p className="text-xs text-slate-500">{userProfile?.email}</p></div></div>
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="text-xs text-slate-400">Full name<input value={profileForm.name} onChange={event => setProfileForm(previous => ({ ...previous, name: event.target.value }))} className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white" /></label>
                    <label className="text-xs text-slate-400">Job title<input value={profileForm.jobTitle} onChange={event => setProfileForm(previous => ({ ...previous, jobTitle: event.target.value }))} className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white" /></label>
                    <label className="text-xs text-slate-400">Organization<input value={profileForm.organization} onChange={event => setProfileForm(previous => ({ ...previous, organization: event.target.value }))} placeholder="Optional" className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white" /></label>
                    <label className="text-xs text-slate-400">Timezone<select value={profileForm.timezone} onChange={event => setProfileForm(previous => ({ ...previous, timezone: event.target.value }))} className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white"><option value="UTC">UTC</option><option value="Asia/Karachi">Pakistan (Asia/Karachi)</option><option value="Asia/Dubai">Dubai</option><option value="Europe/London">London</option><option value="America/New_York">New York</option><option value="America/Los_Angeles">Los Angeles</option></select></label>
                  </div>
                  <div className="border-t border-slate-800 pt-5 space-y-4"><div><h3 className="text-sm font-bold text-white">Generation defaults</h3><p className="text-[11px] text-slate-500">These settings preselect options on Dashboard and Analyze Recording.</p></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label className="text-xs text-slate-400">Default platform<select value={profileForm.defaultPlatform} onChange={event => setProfileForm(previous => ({ ...previous, defaultPlatform: event.target.value }))} className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white">{['Web','Desktop','Mobile','Mac','Tablet'].map(value => <option key={value}>{value}</option>)}</select></label><label className="text-xs text-slate-400">Default test count<select value={profileForm.defaultTestCount} onChange={event => setProfileForm(previous => ({ ...previous, defaultTestCount: event.target.value }))} className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white">{['5','10','20','30','Auto','Custom'].map(value => <option key={value}>{value}</option>)}</select></label></div>
                    <div><span className="text-xs text-slate-400">Default test types</span><div className="flex flex-wrap gap-2 mt-2">{['UI/UX Checklists', 'Functional Flows', 'Edge Cases', 'Accessibility Audit'].map(type => { const active = profileForm.defaultPerspectives.includes(type); return <button key={type} onClick={() => setProfileForm(previous => ({ ...previous, defaultPerspectives: active ? previous.defaultPerspectives.filter(item => item !== type) : [...previous.defaultPerspectives, type] }))} className={`px-3 py-1.5 rounded-full text-xs border ${active ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>{type}</button>; })}</div></div>
                  </div>
                  <div className="flex justify-end"><button onClick={handleSaveProfile} disabled={isSavingProfile || !profileForm.name.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold">{isSavingProfile ? 'Saving…' : 'Save settings'}</button></div>
                </div>
              </div>
            </div>
          )}
          {/* ==================== 7. ANALYTICS AND METRICS VIEW ==================== */}
          {activeTab === 'analytics' && (
            <div className="space-y-8 animate-fadeIn">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">SLA Analytics Panel</h3>
                  <p className="text-xs text-slate-400">Analyze coverage percentages, bug resolution times and SLA metrics across dynamic target nodes</p>
                </div>
              </div>

              {/* Graphic metrics cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Bug density by platform card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h4 className="font-bold text-sm text-white mb-4">Total Identified Bugs by Platform</h4>
                  
                  <div className="space-y-4">
                    {bugPlatformMetrics.length === 0 && (
                      <p className="text-xs text-slate-500">No bug records saved for this project yet.</p>
                    )}
                    {bugPlatformMetrics.map((item, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-300">{item.platform}</span>
                          <span className="text-slate-400">{item.count} Bugs ({item.pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-850">
                          <div className={`h-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bug response time metrics */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h4 className="font-bold text-sm text-white mb-4">AI Agent Identification Speed SLAs</h4>
                  
                  <div className="space-y-4">
                    {severityMetrics.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-950 rounded border border-slate-850">
                        <div>
                          <p className="text-xs font-bold text-slate-200">{item.agent} Agent</p>
                          <p className="text-[10px] text-slate-500">Confidence interval: {item.pct}%</p>
                        </div>
                        <span className="font-mono text-xs font-semibold text-indigo-400">
                          {item.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Token processing statistics */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h4 className="font-bold text-sm text-white mb-4">Total Tokens Ingestion Metric</h4>
                  
                  <div className="space-y-4">
                    <div className="bg-slate-950 p-4 rounded border border-slate-850 text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-500">Daily processed tokens count</p>
                      <h3 className="text-3xl font-extrabold text-white mt-1">{tokenEstimate.toLocaleString()}</h3>
                      <p className="text-[11px] text-emerald-400 mt-1">{testCases.length} database-backed test cases analyzed</p>
                    </div>

                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Generated test cases:</span>
                      <span className="text-white font-bold">{testCases.length}</span>
                    </div>

                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600" style={{ width: `${Math.min(testCases.length * 10, 100)}%` }} />
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}

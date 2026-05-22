import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Upload, FileText, Bug, Code, GitBranch, GitPullRequest,
  Database, BarChart2, Cpu, CheckCircle2, Terminal, RefreshCw, Sparkles, LayoutGrid,
  CheckSquare, Copy, Hammer, Menu, ExternalLink, Layers, Award, Globe, Laptop, Smartphone,
  Gamepad2, Compass
} from 'lucide-react';

interface TestCase {
  id: string;
  title: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  actualResult?: string;
  status: 'pending' | 'passed' | 'failed';
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

const INITIAL_TIMELINE_EVENTS: TimelineEvent[] = [
  { id: '1', time: '00:02', event: 'Interaction Tracker', type: 'Click Detected', desc: 'User clicked "Proceed to Account Setup"', status: 'info' },
  { id: '2', time: '00:08', event: 'OCR Engine', type: 'Screen Transition', desc: 'Identified screen title change to "Profile Creation Form"', status: 'info' },
  { id: '3', time: '00:14', event: 'Visual Agent', type: 'UI Overlap Warning', desc: 'Detected elements overlapping on element CSS selector: #promo-banner and #input-payment', status: 'warning' },
  { id: '4', time: '00:22', event: 'Network Tracer', type: 'Slow response API', desc: 'POST /v1/onboarding took 4200ms (threshold is 1000ms)', status: 'warning' },
  { id: '5', time: '00:28', event: 'Crash Sensor', type: 'Uncaught Error Crash', desc: 'ReferenceError: payloadData is not defined. React fiber collapsed.', status: 'critical' }
];

const INITIAL_TEST_CASES: TestCase[] = [
  {
    id: 'TC-101',
    title: 'Verify Account Setup Navigation and Redirection',
    preconditions: 'User is authenticated and on the Landing onboarding view.',
    steps: [
      'Click the "Proceed to Account Setup" visual link.',
      'Wait for transition to complete.',
      'Observe active header labels and breadcrumbs.'
    ],
    expectedResult: 'Screen title successfully changes to "Profile Creation Form" within 800ms with zero layout shifts.',
    status: 'passed',
    severity: 'MEDIUM',
    priority: 'P2',
    testType: 'Functional / Flow Verification',
    platform: 'Web Application',
    module: 'Onboarding & Checkout Flow',
    tags: ['Onboarding', 'Navigation', 'Redirection']
  },
  {
    id: 'TC-102',
    title: 'Ensure Ad-Banner Layout Responsiveness on Mobile Aspect Ratio',
    preconditions: 'Dynamic promotion code active in server response.',
    steps: [
      'Resize view viewport to width: 375px (Mobile viewport).',
      'Observe promo banner #promo-banner position and payment fields.'
    ],
    expectedResult: '#promo-banner stacks cleanly above payment inputs without overlaying the input labels.',
    status: 'failed',
    severity: 'HIGH',
    priority: 'P1',
    testType: 'UI Visual Alignment / Responsive',
    platform: 'Web Application',
    module: 'Promotion Visual System',
    tags: ['CSS', 'Responsiveness', 'Banners']
  },
  {
    id: 'TC-103',
    title: 'Validate Account Payload Submission Validation',
    preconditions: 'Required text inputs fields remain empty.',
    steps: [
      'Complete form using placeholder invalid inputs.',
      'Trigger POST submission network routine.'
    ],
    expectedResult: 'Form blocks submission, throws immediate local verification alerts, and refrains from calling remote API.',
    status: 'pending',
    severity: 'CRITICAL',
    priority: 'P0',
    testType: 'Edge Case / Negative Validation',
    platform: 'Web Application',
    module: 'API Validation Shield',
    tags: ['Security', 'API Integration', 'Form Control']
  }
];

const INITIAL_BUG_REPORTS: BugReport[] = [
  {
    id: 'BUG-401',
    title: 'Uncaught ReferenceError: payloadData is not defined in Form Submit Handler',
    description: 'During profile creation, clicking submit throws an unhandled reference exception resulting in client-side application crash.',
    steps: [
      'Navigate to Profile Creation view.',
      'Fill required field configurations.',
      'Click primary submit actions button.'
    ],
    expectedResult: 'Submission is handled gracefully and returns the client state payload to the server database.',
    actualResult: 'Browser console throws Uncaught ReferenceError: payloadData is not defined. Application crashes to a blank white screen.',
    severity: 'CRITICAL',
    priority: 'P0',
    timestamp: '00:28',
    module: 'Form Submit Handlers',
    githubIssueUrl: 'https://github.com/testmind/saas-platform/issues/401',
    rcaText: 'The submittal callback refers to a non-existent parameter variable "payloadData" instead of "validatedPayloadData" which was extracted on line 122 in FormController.ts.',
    suggestedFix: 'Replace reference to payloadData on line 144 of the FormController component with the correct destructured object reference: validatedPayloadData.'
  },
  {
    id: 'BUG-402',
    title: '#promo-banner overlaps input-payment form element on dynamic layout resizing',
    description: 'When rendering promotional elements, the promo container breaks positioning rules and overlays text input controls.',
    steps: [
      'Change browser screen resolution size to 768px wide.',
      'Look at layout segment below onboarding header.'
    ],
    expectedResult: 'Promo container dynamically shrinks or adapts its height using CSS flex-wrap parameters.',
    actualResult: 'Dynamic container absolute margins overlap form field elements directly blocking mouse clicks.',
    severity: 'HIGH',
    priority: 'P1',
    timestamp: '00:14',
    module: 'Layout Components',
    githubIssueUrl: 'https://github.com/testmind/saas-platform/issues/402',
    rcaText: 'Absolute coordinate anchors clash during rendering processes due to missing media queries in CSS layers.',
    suggestedFix: 'Set position to relative inside the media queries layer and specify max-width constraints on the inner wrapper of #promo-banner.'
  }
];

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'testcases' | 'bugs' | 'integrations' | 'schemas' | 'analytics'>('dashboard');

  // Core Data States
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>(INITIAL_TIMELINE_EVENTS);
  const [testCases, setTestCaseData] = useState<TestCase[]>(INITIAL_TEST_CASES);
  const [bugs, setBugReports] = useState<BugReport[]>(INITIAL_BUG_REPORTS);
  const [logInputText, setLogInputText] = useState('');
  const [uploadedVideoFile, setUploadedVideoFile] = useState<File | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState('');
  const [videoUploadMessage, setVideoUploadMessage] = useState('Drag & drop or choose a video file to analyze.');
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);

  // AI Pipeline Custom Input Parameters
  const [customAppDesc, setCustomAppDesc] = useState('An enterprise B2B SaaS e-commerce checkout page with promo codes and credit card processing validations.');
  const [selectedPerspectives, setSelectedPerspectives] = useState<string[]>(['UI/UX', 'Functional', 'Edge Case']);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generationLog, setGenerationLog] = useState<string[]>([]);

  // Simulation Interactive Elements
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(25); // Simulated slider percentage
  const [activeLogMsg, setActiveLogMsg] = useState('');
  const [parsedLogStatus, setParsedLogStatus] = useState<'idle' | 'parsing' | 'success' | 'failed'>('idle');

  // Test Case Executions State
  const [executingTestCase, setExecutingTestCase] = useState<TestCase | null>(null);
  const [executionSteps, setExecutionSteps] = useState<boolean[]>([]);
  const [executionComment, setExecutionComment] = useState('');
  
  // Script Synthesizer state
  const [scriptTargetCase, setScriptTargetCase] = useState<TestCase | null>(null);
  const [selectedScriptType, setSelectedScriptType] = useState<'Playwright' | 'Cypress' | 'Selenium'>('Playwright');
  const [generatedScriptCode, setGeneratedScriptCode] = useState('');

  // RCA Slide-Over and Github OAuth Setup Simulation
  const [rcaTargetBug, setRcaTargetBug] = useState<BugReport | null>(null);
  const [oauthStep, setOauthStep] = useState<'disconnected' | 'authenticating' | 'connected'>('disconnected');
  const [githubUser, setGithubUser] = useState<{name: string, repos: string[]} | null>(null);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [isPushingCode, setIsPushingCode] = useState(false);
  const [gitTerminalLogs, setGitTerminalLogs] = useState<string[]>([]);
  const [pushedSuccess, setPushedSuccess] = useState(false);

  // Search/Filters
  const [testFilterPlatform, setTestFilterPlatform] = useState('All');
  const [testFilterSeverity, setTestFilterSeverity] = useState('All');

  // Automatically cycle mock video playback progress if enabled
  useEffect(() => {
    let interval: any;
    if (isPlayingVideo && !uploadedVideoUrl) {
      interval = setInterval(() => {
        setVideoProgress((prev) => {
          if (prev >= 100) return 0;
          return prev + 1;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlayingVideo, uploadedVideoUrl]);

  useEffect(() => {
    return () => {
      if (uploadedVideoUrl) {
        URL.revokeObjectURL(uploadedVideoUrl);
      }
    };
  }, [uploadedVideoUrl]);

  const handleVideoUpload = (file: File) => {
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
    setIsPlayingVideo(prev => !prev);
  };

  const handleVideoLoadedMetadata = () => {
    if (!videoRef.current) return;
    setVideoDuration(videoRef.current.duration || 0);
    setVideoCurrentTime(videoRef.current.currentTime || 0);
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !videoDuration) return;
    const currentTime = videoRef.current.currentTime;
    setVideoCurrentTime(currentTime);
    setVideoProgress((currentTime / videoDuration) * 100);
  };

  const handleVideoSeek = (newValue: number) => {
    if (!videoRef.current || !videoDuration) return;
    videoRef.current.currentTime = (newValue / 100) * videoDuration;
    setVideoProgress(newValue);
  };

  const navigateToTab = (tab: 'dashboard' | 'upload' | 'testcases' | 'bugs' | 'integrations' | 'schemas' | 'analytics') => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  // Simulate active AI prompts logging to give beautiful visual feedback
  const handleTriggerAITestGeneration = () => {
    if (!customAppDesc.trim()) return;
    setAiGenerating(true);
    setGenerationLog([]);
    
    const logs = [
      "Initializing AI Flow Analyzer Agent...",
      "Analyzing user flows & state transitions based on product specs...",
      "Activating AI Visual Auditor Agent for responsive & alignment rules...",
      "Querying Gemini-3-Flash for negative inputs & edge cases...",
      "Compiling full-perspective test suite...",
      "Injecting generated test cases into Project Library..."
    ];

    logs.forEach((logText, index) => {
      setTimeout(() => {
        setGenerationLog(prev => [...prev, logText]);
        if (index === logs.length - 1) {
          // Add newly generated test cases
          const newTCs: TestCase[] = [
            {
              id: `TC-GEN-${Math.floor(100 + Math.random() * 900)}`,
              title: `Validate Checkout flow with custom dynamic inputs on ${customAppDesc.slice(0, 30)}...`,
              preconditions: 'Database initialized. Dynamic promo system enabled.',
              steps: [
                'Load checkout interface.',
                'Input invalid/unsupported coupon format code into discount field.',
                'Verify structural component response rules.'
              ],
              expectedResult: 'System gracefully catches exceptions, returns clear error response without processing payment request.',
              status: 'pending',
              severity: 'HIGH',
              priority: 'P1',
              testType: 'AI Generated Flow Case',
              platform: 'Cross-Platform App',
              module: 'Core Transaction Engine',
              tags: ['AI-Generated', 'Edge-Case', 'Auto-Scan']
            },
            {
              id: `TC-GEN-${Math.floor(100 + Math.random() * 900)}`,
              title: 'Verify UI Contrast Ratio compliance under dark/light theme toggle',
              preconditions: 'System default theme set to dark dynamic modes.',
              steps: [
                'Toggle application theme switch twice.',
                'Scan text labels on payment buttons against container backgrounds.'
              ],
              expectedResult: 'Contrast standards comply with WCAG AA standard (> 4.5:1 ratio).',
              status: 'pending',
              severity: 'LOW',
              priority: 'P3',
              testType: 'Accessibility (WCAG AA)',
              platform: 'Web Application',
              module: 'Accessibility UI',
              tags: ['AI-Generated', 'Accessibility', 'Contrast']
            }
          ];
          setTestCaseData(prev => [...newTCs, ...prev]);
          setAiGenerating(false);
          setActiveTab('testcases');
        }
      }, (index + 1) * 900);
    });
  };

  const handleParseLogs = () => {
    if (!logInputText.trim()) return;
    setParsedLogStatus('parsing');
    
    setTimeout(() => {
      const isCrashLog = logInputText.toLowerCase().includes('error') || logInputText.toLowerCase().includes('exception') || logInputText.toLowerCase().includes('crash');
      
      const newEvent: TimelineEvent = {
        id: `LOG-EVT-${Date.now()}`,
        time: '00:45',
        event: 'Gemini Log Parser',
        type: isCrashLog ? 'Parsing Detected Exception' : 'Telemetry Event Logged',
        desc: logInputText.length > 80 ? `${logInputText.slice(0, 80)}...` : logInputText,
        status: isCrashLog ? 'critical' : 'warning'
      };

      setTimelineEvents(prev => [...prev, newEvent]);
      setParsedLogStatus('success');
      setLogInputText('');
      
      // Auto toast simulated message
      setActiveLogMsg('Successfully parsed! Added custom telemetry marker onto recording timelines.');
      setTimeout(() => setActiveLogMsg(''), 4000);
    }, 1200);
  };

  const handleGenerateScript = (testCase: TestCase, language: 'Playwright' | 'Cypress' | 'Selenium') => {
    setScriptTargetCase(testCase);
    setSelectedScriptType(language);
    
    let codeTemplate = '';
    const formattedTitle = testCase.title.replace(/'/g, "\\'");
    
    if (language === 'Playwright') {
      codeTemplate = `import { test, expect } from '@playwright/test';

test.describe('${testCase.module}', () => {
  // Preconditions: ${testCase.preconditions}
  test('${formattedTitle}', async ({ page }) => {
    // Step 1: ${testCase.steps[0] || 'Navigate to action area'}
    await page.goto('/target-flow');
    
    ${testCase.steps[1] ? `// Step 2: ${testCase.steps[1]}\n    await page.click('#action-trigger');` : ''}
    ${testCase.steps[2] ? `// Step 3: ${testCase.steps[2]}\n    await page.waitForTimeout(1000);` : ''}

    // Expected Result: ${testCase.expectedResult}
    const stateHeader = page.locator('h1.title');
    await expect(stateHeader).toBeVisible();
  });
});`;
    } else if (language === 'Cypress') {
      codeTemplate = `describe('${testCase.module}', () => {
  beforeEach(() => {
    // Preconditions: ${testCase.preconditions}
    cy.visit('/target-flow');
  });

  it('${formattedTitle}', () => {
    // ${testCase.steps.join(' -> ')}
    cy.get('#action-trigger').click();
    
    // Expected: ${testCase.expectedResult}
    cy.url().should('include', '/profile');
  });
});`;
    } else {
      codeTemplate = `const { Builder, By, until } = require('selenium-webdriver');

// Preconditions: ${testCase.preconditions}
(async function executeTest() {
  let driver = await new Builder().forBrowser('chrome').build();
  try {
    await driver.get('http://localhost:3000/onboarding');
    // Steps: ${testCase.steps.join(', ')}
    await driver.findElement(By.id('action-trigger')).click();
    
    // Expected: ${testCase.expectedResult}
    await driver.wait(until.titleIs('Profile Creation Form'), 1000);
  } finally {
    await driver.quit();
  }
})();`;
    }
    setGeneratedScriptCode(codeTemplate);
  };

  const startTestCaseExecution = (testCase: TestCase) => {
    setExecutingTestCase(testCase);
    setExecutionSteps(new Array(testCase.steps.length).fill(false));
    setExecutionComment('');
  };

  const submitTestExecutionResult = (passed: boolean) => {
    if (!executingTestCase) return;

    // Update status locally
    setTestCaseData(prev => prev.map(tc => {
      if (tc.id === executingTestCase.id) {
        return { 
          ...tc, 
          status: passed ? 'passed' : 'failed',
          actualResult: executionComment || (passed ? 'Verified steps completed without issue' : 'Steps halted due to runtime mismatch')
        };
      }
      return tc;
    }));

    // If test failed, automatically generate a bug report inside the log structure
    if (!passed) {
      const newBug: BugReport = {
        id: `BUG-AUTO-${Math.floor(500 + Math.random() * 499)}`,
        title: `Failure during Test Run: ${executingTestCase.title}`,
        description: `Executed manual automated workflow for module: ${executingTestCase.module}. Execution comment logged: ${executionComment}`,
        steps: executingTestCase.steps,
        expectedResult: executingTestCase.expectedResult,
        actualResult: executionComment || 'Visual execution failed to verify state matches the expectations of this case.',
        severity: executingTestCase.severity,
        priority: executingTestCase.priority,
        timestamp: 'Manual Runtime Execution',
        module: executingTestCase.module,
        rcaText: 'Automated test suite logged user flow interruption during execution cycle.',
        suggestedFix: 'Investigate dynamic components render constraints on the target execution steps.'
      };
      setBugReports(prev => [newBug, ...prev]);
      setActiveLogMsg(`Test Case Failed. Automatic bug tracker file generated: ${newBug.id}!`);
      setTimeout(() => setActiveLogMsg(''), 5000);
    } else {
      setActiveLogMsg(`Test Case Passed! Status indicators updated across Project Metrics.`);
      setTimeout(() => setActiveLogMsg(''), 4000);
    }

    setExecutingTestCase(null);
  };

  const startOAuthGithub = () => {
    setOauthStep('authenticating');
    setTimeout(() => {
      setOauthStep('connected');
      setGithubUser({
        name: 'principal-qa-architect',
        repos: ['testmind-ai-platform', 'e-commerce-visual-suite', 'nextjs-saas-template']
      });
    }, 1500);
  };

  const handleCreateAndPushRepo = () => {
    if (!selectedRepo) return;
    setIsPushingCode(true);
    setGitTerminalLogs([]);
    setPushedSuccess(false);

    const logs = [
      "Initializing fresh local git repository...",
      "Setting up standard remote origin: git@github.com:principal-qa-architect/testmind-ai-platform.git",
      "Staging automatic framework artifacts (Next.js config, Prisma schemas, Docker configurations)...",
      "Generating automated GitHub Actions testing templates (workflow files, environment scripts)...",
      "Creating initial commit block: 'feat(core): setup production code pipelines via TestMind AI Automation'",
      "Pushing assets cleanly up to branch 'main'...",
      "Opening pull request #1 in repository successfully!"
    ];

    logs.forEach((logMessage, index) => {
      setTimeout(() => {
        setGitTerminalLogs(prev => [...prev, `[git-agent] ${logMessage}`]);
        if (index === logs.length - 1) {
          setIsPushingCode(false);
          setPushedSuccess(true);
        }
      }, (index + 1) * 850);
    });
  };

  const filteredTestCases = useMemo(() => {
    return testCases.filter(tc => {
      const matchPlatform = testFilterPlatform === 'All' || tc.platform.toLowerCase().includes(testFilterPlatform.toLowerCase());
      const matchSeverity = testFilterSeverity === 'All' || tc.severity === testFilterSeverity;
      return matchPlatform && matchSeverity;
    });
  }, [testCases, testFilterPlatform, testFilterSeverity]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex overflow-hidden">
      {/* SIDEBAR NAVIGATION */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/75 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transform transition-transform duration-300 md:static md:translate-x-0 md:w-64 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div>
          {/* Logo Brand Panel */}
          <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wide text-white">TestMind AI</h1>
              <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Enterprise Suite</span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="p-4 space-y-1.5">
            <button 
              onClick={() => navigateToTab('dashboard')} 
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'dashboard' ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <LayoutGrid className="w-4.5 h-4.5" />
              <span>Executive Dashboard</span>
            </button>

            <button 
              onClick={() => navigateToTab('upload')} 
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'upload' ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Upload className="w-4.5 h-4.5" />
              <span>Record & Parse Logs</span>
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
                <span>Visual Bug Board</span>
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
              <span>GitHub & Integrations</span>
            </button>

            <button 
              onClick={() => navigateToTab('schemas')} 
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'schemas' ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Database className="w-4.5 h-4.5" />
              <span>System Codebases</span>
            </button>

            <button 
              onClick={() => navigateToTab('analytics')} 
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'analytics' ? 'bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <BarChart2 className="w-4.5 h-4.5" />
              <span>Metrics & SLA</span>
            </button>
          </nav>
        </div>

        {/* User Workspace Info Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-slate-950 font-bold text-xs uppercase">
              QA
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300">Principal Architect</p>
              <p className="text-[10px] text-slate-500">Tier: Enterprise AI Pro</p>
            </div>
          </div>
          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
              <span>Token Usage Daily</span>
              <span>85%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full w-4/5" />
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN SCREEN PANEL AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-y-auto">
        
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
              Active Project: E-Commerce Storefront Visual Pipeline
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => {
                setTestCaseData(INITIAL_TEST_CASES);
                setBugReports(INITIAL_BUG_REPORTS);
                setTimelineEvents(INITIAL_TIMELINE_EVENTS);
                setActiveLogMsg("Workspace restored to default seed values.");
                setTimeout(() => setActiveLogMsg(""), 3000);
              }}
              className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 px-3 py-1.5 rounded border border-slate-700 transition"
              title="Reset Sandbox state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset State</span>
            </button>
            <div className="h-6 w-px bg-slate-800" />
            <span className="text-xs font-semibold text-emerald-400 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block mr-1" />
              AI Agent Nodes Online
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-100 placeholder-slate-600"
                        rows={3}
                      />
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
                    <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Project Code Coverage</span>
                    <h3 className="text-3xl font-bold text-white mt-1">94.2%</h3>
                    <span className="text-emerald-400 text-xs font-semibold flex items-center mt-1">
                      +1.8% from yesterday
                    </span>
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
                    <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">AI Agents Trust Score</span>
                    <h3 className="text-3xl font-bold text-white mt-1">98.4%</h3>
                    <span className="text-slate-400 text-xs mt-1 block">Based on 250 verified runs</span>
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
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-white">Visual Timeline Analysis</h3>
                      <p className="text-xs text-slate-400">Analyze UI recordings side-by-side with OCR events and console dumps</p>
                    </div>
                    <span className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded font-mono font-semibold">
                      MP4 - 1080p @ 60 FPS
                    </span>
                  </div>

                  {/* Mock Video Canvas Frame */}
                  <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden relative aspect-video flex flex-col justify-between">
                    {/* Recording Visual overlay */}
                    <div className="p-4 bg-gradient-to-b from-slate-950 to-transparent flex justify-between items-center z-10">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                        <span className="text-xs text-white uppercase font-bold tracking-wider">Simulated Capture Onboarding_Flow.mp4</span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">Duration: 00:30</span>
                    </div>

                    {/* Simulation graphics / animations on play state */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {isPlayingVideo ? (
                        <div className="text-center space-y-4 relative w-full h-full">
                          {/* Animated pointer cursor mimicking test steps */}
                          <div 
                            className="absolute w-6 h-6 rounded-full bg-indigo-500/40 border-2 border-indigo-400 flex items-center justify-center animate-ping"
                            style={{ 
                              top: `${40 + Math.sin(videoProgress / 5) * 20}%`, 
                              left: `${30 + Math.cos(videoProgress / 5) * 20}%` 
                            }}
                          >
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          </div>

                          <div className="absolute inset-x-0 bottom-16 bg-slate-950/80 p-2 mx-12 rounded border border-slate-800 text-center text-xs">
                            <span className="text-slate-300 font-mono font-bold block">Active OCR State Transition:</span>
                            <span className="text-indigo-400 text-[11px] block mt-0.5">Detecting elements: [ #promo-banner , #input-payment ]</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center space-y-3">
                          <div className="p-4 bg-slate-900/80 rounded-full border border-slate-700">
                            <Play className="w-8 h-8 text-indigo-400 fill-indigo-400 translate-x-0.5" />
                          </div>
                          <p className="text-xs text-slate-400">Click playback trigger control below to simulate runtime analysis</p>
                        </div>
                      )}
                    </div>

                    {/* Bottom controls panel */}
                    <div className="p-4 bg-gradient-to-t from-slate-950 to-transparent flex flex-col space-y-3 z-10">
                      
                      {/* Video progress track line */}
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-slate-400 font-mono">00:00</span>
                        <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden cursor-pointer">
                          <div className="bg-indigo-500 h-full" style={{ width: `${videoProgress}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 font-mono">00:30</span>
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
                              setIsPlayingVideo(false);
                            }}
                            className="text-slate-400 hover:text-white transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>

                        <span className="text-xs font-mono text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-900">
                          Timeline Segment: {Math.floor((30 * videoProgress) / 100)}s
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
                    {uploadedVideoFile && (
                      <p className="text-xs text-slate-300 mt-2">
                        Loaded: {uploadedVideoFile.name} ({(uploadedVideoFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                  {uploadedVideoUrl && (
                    <div className="rounded-xl overflow-hidden border border-slate-800 mt-4">
                      <video
                        ref={videoRef}
                        controls
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        onTimeUpdate={handleVideoTimeUpdate}
                        className="w-full max-h-[360px] bg-black"
                        src={uploadedVideoUrl}
                      />
                    </div>
                  )}
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
                          setUploadedVideoUrl('');
                          setVideoUploadMessage('Drag & drop or choose a video file to analyze.');
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
                        <span>AI Log Parser parsing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Execute Log Injection</span>
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
              
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                
                {/* Left Test Case Library Selection */}
                <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Project Test Case Library</h3>
                      <p className="text-xs text-slate-400">Total verified test cases generated organically & by AI modules</p>
                    </div>

                    {/* Filter controllers */}
                    <div className="flex space-x-3">
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

                  {/* Test Cards List Grid */}
                  <div className="space-y-4">
                    {filteredTestCases.map((tc) => (
                      <div 
                        key={tc.id} 
                        className={`p-5 rounded-xl border transition-all ${
                          executingTestCase?.id === tc.id ? 'border-indigo-500 bg-indigo-950/10' : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold bg-slate-850 px-2 py-0.5 rounded text-indigo-400 border border-slate-800">
                              {tc.id}
                            </span>
                            <span className="text-xs text-slate-500 font-semibold uppercase">{tc.testType}</span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              tc.severity === 'CRITICAL' ? 'bg-rose-950/50 text-rose-400 border border-rose-900/30' :
                              tc.severity === 'HIGH' ? 'bg-amber-950/50 text-amber-400 border border-amber-900/30' : 'bg-slate-900 text-slate-400'
                            }`}>
                              {tc.severity}
                            </span>
                            <span className={`w-2 h-2 rounded-full ${
                              tc.status === 'passed' ? 'bg-emerald-500' :
                              tc.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'
                            }`} />
                            <span className="text-xs text-slate-400 font-semibold capitalize">{tc.status}</span>
                          </div>
                        </div>

                        <h4 className="font-bold text-sm text-white mb-2">{tc.title}</h4>
                        <p className="text-xs text-slate-400 mb-3"><span className="text-slate-500 font-semibold">Preconditions:</span> {tc.preconditions}</p>

                        <div className="bg-slate-900/60 p-3 rounded border border-slate-850 space-y-1 mb-4">
                          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wide block mb-1">Execution Steps:</span>
                          {tc.steps.map((step, sIdx) => (
                            <div key={sIdx} className="text-xs text-slate-300 flex items-start space-x-1.5">
                              <span className="text-indigo-500 font-mono text-[10px]">{sIdx + 1}.</span>
                              <span className="leading-relaxed">{step}</span>
                            </div>
                          ))}
                        </div>

                        <div className="border-t border-slate-900 pt-3 flex flex-wrap gap-2 justify-between items-center">
                          <div className="flex items-center space-x-2 text-xs text-slate-500">
                            <span>Platform: <strong className="text-slate-300">{tc.platform}</strong></span>
                            <span>•</span>
                            <span>Module: <strong className="text-slate-300">{tc.module}</strong></span>
                          </div>

                          <div className="flex space-x-2">
                            <button
                              onClick={() => startTestCaseExecution(tc)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded font-semibold transition flex items-center space-x-1.5"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Run Test</span>
                            </button>
                            <button
                              onClick={() => handleGenerateScript(tc, 'Playwright')}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded font-semibold transition flex items-center space-x-1.5"
                            >
                              <Code className="w-3.5 h-3.5" />
                              <span>Script</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Interactive Execution Control Box */}
                <div className="space-y-6">
                  
                  {/* Test Executor Panel */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-md font-bold text-white mb-2 flex items-center space-x-2">
                      <Hammer className="w-4.5 h-4.5 text-indigo-400" />
                      <span>Interactive Test execution</span>
                    </h3>
                    
                    {executingTestCase ? (
                      <div className="space-y-4">
                        <div className="bg-slate-950 p-3.5 rounded border border-indigo-900/40">
                          <span className="text-[10px] font-bold text-indigo-400 tracking-wider block font-mono">{executingTestCase.id}</span>
                          <h4 className="font-bold text-sm text-slate-200 mt-1">{executingTestCase.title}</h4>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Interactive Checklist:</p>
                          {executingTestCase.steps.map((step, idx) => (
                            <label key={idx} className="flex items-start space-x-2.5 p-2 bg-slate-950 rounded border border-slate-900 cursor-pointer hover:border-slate-800 transition">
                              <input 
                                type="checkbox" 
                                checked={executionSteps[idx] || false}
                                onChange={(e) => {
                                  const updated = [...executionSteps];
                                  updated[idx] = e.target.checked;
                                  setExecutionSteps(updated);
                                }}
                                className="mt-0.5 rounded border-slate-800 bg-slate-900 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                              />
                              <span className="text-xs text-slate-300 leading-relaxed">{step}</span>
                            </label>
                          ))}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">Execution comment / Logs output (Required for Failure):</label>
                          <textarea 
                            value={executionComment}
                            onChange={(e) => setExecutionComment(e.target.value)}
                            placeholder="Type observation metrics..."
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-100 placeholder-slate-750 focus:outline-none"
                            rows={3}
                          />
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={() => submitTestExecutionResult(true)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded text-xs font-semibold transition"
                          >
                            Mark Passed
                          </button>
                          <button
                            onClick={() => submitTestExecutionResult(false)}
                            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2 rounded text-xs font-semibold transition"
                          >
                            Mark Failed
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-950 p-6 rounded-lg text-center border border-slate-800">
                        <CheckSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">Select any manual test case and click "Run Test" to open the interactive controller panel.</p>
                      </div>
                    )}
                  </div>

                  {/* AI QA Script Generator */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-md font-bold text-white mb-2 flex items-center space-x-2">
                      <Code className="w-4.5 h-4.5 text-indigo-400" />
                      <span>Script writer output</span>
                    </h3>

                    {scriptTargetCase ? (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="flex space-x-2 bg-slate-950 p-1 rounded border border-slate-850">
                          {['Playwright', 'Cypress', 'Selenium'].map((lang) => (
                            <button
                              key={lang}
                              onClick={() => handleGenerateScript(scriptTargetCase, lang as any)}
                              className={`flex-1 py-1 text-[10px] font-bold rounded transition ${selectedScriptType === lang ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                              {lang}
                            </button>
                          ))}
                        </div>

                        <div className="relative">
                          <pre className="bg-slate-950 text-[10px] font-mono p-3 rounded-lg border border-slate-800 overflow-x-auto text-slate-300 max-h-64 leading-relaxed">
                            {generatedScriptCode}
                          </pre>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(generatedScriptCode);
                              setActiveLogMsg("Code copied directly to system clipboard.");
                              setTimeout(() => setActiveLogMsg(""), 3000);
                            }}
                            className="absolute right-2 top-2 p-1.5 bg-slate-900 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition"
                            title="Copy Code"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-950 p-6 rounded-lg text-center border border-slate-800">
                        <Code className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">Generates instant Playwright / Cypress / Selenium test components dynamically matching visual definitions.</p>
                      </div>
                    )}
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
                          <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
                            GH
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white">OAuth handshake completed</p>
                            <p className="text-[10px] text-emerald-400 font-semibold font-mono">User: principal-qa-architect (Verified Dev)</p>
                          </div>
                        </div>

                        <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[10px] font-bold px-2 py-0.5 rounded">
                          Connected
                        </span>
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
                            <button
                              onClick={() => {
                                setGithubUser(prev => prev ? { ...prev, repos: [...prev.repos, 'new-automated-testmind-suite'] } : null);
                                setSelectedRepo('new-automated-testmind-suite');
                                setPushedSuccess(false);
                                setActiveLogMsg("Repository slot 'new-automated-testmind-suite' created successfully.");
                                setTimeout(() => setActiveLogMsg(""), 3000);
                              }}
                              className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 py-2 rounded text-xs font-semibold transition"
                            >
                              Initialize New Repository
                            </button>
                          </div>
                        </div>

                        {selectedRepo && (
                          <div className="pt-2 border-t border-slate-900">
                            <button
                              onClick={handleCreateAndPushRepo}
                              disabled={isPushingCode}
                              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs py-2.5 rounded font-semibold transition"
                            >
                              {isPushingCode ? "Pushing files..." : `Push Test Code & CI Pipelines to: ${selectedRepo}`}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Simulated Output Terminal Console */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-md font-bold text-white flex items-center space-x-2">
                      <Terminal className="w-4.5 h-4.5 text-indigo-400" />
                      <span>Git-Agent Deployment Log</span>
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
                      Pull Request opened in GitHub repository: #1 Setup Test Suite!
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* ==================== 6. CODEBASE VIEW ==================== */}
          {activeTab === 'schemas' && (
            <div className="space-y-8 animate-fadeIn">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Platform System Schemas & Configs</h3>
                  <p className="text-xs text-slate-400">Review production configurations, database designs, and pipeline templates used to power TestMind AI</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* Column: Prisma Schema Code */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                      <Database className="w-4 h-4" />
                      <span>Prisma Database Schema</span>
                    </span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(PRISMA_SCHEMA_RAW);
                        setActiveLogMsg("Prisma schema copied successfully!");
                        setTimeout(() => setActiveLogMsg(""), 3000);
                      }}
                      className="p-1 text-slate-400 hover:text-white transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <pre className="bg-slate-950 text-[10px] font-mono p-4 rounded-lg border border-slate-850 overflow-y-auto h-96 text-slate-300 leading-relaxed">
                    {PRISMA_SCHEMA_RAW}
                  </pre>
                </div>

                {/* Column: Docker Config */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                      <Layers className="w-4 h-4" />
                      <span>Dockerfile Orchestration</span>
                    </span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(DOCKER_FILE_RAW);
                        setActiveLogMsg("Dockerfile configuration copied!");
                        setTimeout(() => setActiveLogMsg(""), 3000);
                      }}
                      className="p-1 text-slate-400 hover:text-white transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <pre className="bg-slate-950 text-[10px] font-mono p-4 rounded-lg border border-slate-850 overflow-y-auto h-96 text-slate-300 leading-relaxed">
                    {DOCKER_FILE_RAW}
                  </pre>
                </div>

                {/* Column: GitHub Actions CI Build Config */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                      <GitPullRequest className="w-4 h-4" />
                      <span>GitHub CI Actions Build</span>
                    </span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(GH_ACTION_RAW);
                        setActiveLogMsg("CI Action workflow copied!");
                        setTimeout(() => setActiveLogMsg(""), 3000);
                      }}
                      className="p-1 text-slate-400 hover:text-white transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <pre className="bg-slate-950 text-[10px] font-mono p-4 rounded-lg border border-slate-850 overflow-y-auto h-96 text-slate-300 leading-relaxed">
                    {GH_ACTION_RAW}
                  </pre>
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

              {/* Graphic metrics simulation cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Bug density by platform card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h4 className="font-bold text-sm text-white mb-4">Total Identified Bugs by Platform</h4>
                  
                  <div className="space-y-4">
                    {[
                      { platform: "Web Applications", count: 8, pct: 40, color: "bg-indigo-500" },
                      { platform: "Mobile iOS / Android", count: 6, pct: 30, color: "bg-emerald-500" },
                      { platform: "Video Games (Unity)", count: 4, pct: 20, color: "bg-purple-500" },
                      { platform: "Desktop Core (Windows)", count: 2, pct: 10, color: "bg-pink-500" }
                    ].map((item, idx) => (
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
                    {[
                      { agent: "Flow Analyzer", time: "0.8s avg", pct: 95 },
                      { agent: "UI Visual Auditor", time: "1.2s avg", pct: 90 },
                      { agent: "Accessibility Inspector", time: "1.5s avg", pct: 88 },
                      { agent: "Edge Case Generation", time: "2.1s avg", pct: 85 }
                    ].map((item, idx) => (
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
                      <h3 className="text-3xl font-extrabold text-white mt-1">1,425,850</h3>
                      <p className="text-[11px] text-emerald-400 mt-1">All query requests resolved successfully</p>
                    </div>

                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Monthly API budget used:</span>
                      <span className="text-white font-bold">$244.50 / $1000.00</span>
                    </div>

                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 w-1/4" />
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
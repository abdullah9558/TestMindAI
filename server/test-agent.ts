import { runTestCaseAgent } from './src/services/agentService.js';
import dotenv from 'dotenv';
dotenv.config();

const result = await runTestCaseAgent({
  appDescription: 'Login form with email and password. User can reset password via email.',
  perspectives: ['Functional', 'Security', 'Edge Case'],
  platform: 'Web',
  testCount: 5,
});

console.log(JSON.stringify(result, null, 2));

// OAuth configuration and utility functions

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
import { getFullUrl } from './config';

const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI || getFullUrl();

export const initiateGoogleOAuth = () => {
  console.log('Initiating Google OAuth...');
  console.log('Google Client ID:', GOOGLE_CLIENT_ID ? 'configured' : 'missing');
  console.log('Redirect URI:', REDIRECT_URI);
  
  if (!GOOGLE_CLIENT_ID) {
    console.error('Google Client ID not configured. Please add NEXT_PUBLIC_GOOGLE_CLIENT_ID to your .env.local file');
    alert('Google OAuth is not configured. Please check the console for details.');
    return;
  }

  try {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: `${REDIRECT_URI}/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log('Redirecting to Google OAuth URL:', googleAuthUrl);
    window.location.href = googleAuthUrl;
  } catch (error) {
    console.error('Error initiating Google OAuth:', error);
    alert('Failed to initiate Google OAuth. Please try again.');
  }
};

export const initiateGitHubOAuth = () => {
  console.log('Initiating GitHub OAuth...');
  console.log('GitHub Client ID:', GITHUB_CLIENT_ID ? 'configured' : 'missing');
  console.log('Redirect URI:', REDIRECT_URI);
  
  if (!GITHUB_CLIENT_ID) {
    console.error('GitHub Client ID not configured. Please add NEXT_PUBLIC_GITHUB_CLIENT_ID to your .env.local file');
    alert('GitHub OAuth is not configured. Please check the console for details.');
    return;
  }

  try {
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: `${REDIRECT_URI}/auth/github/callback`,
      response_type: 'code',
      scope: 'read:user user:email',
    });

    const githubAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    console.log('Redirecting to GitHub OAuth URL:', githubAuthUrl);
    window.location.href = githubAuthUrl;
  } catch (error) {
    console.error('Error initiating GitHub OAuth:', error);
    alert('Failed to initiate GitHub OAuth. Please try again.');
  }
};

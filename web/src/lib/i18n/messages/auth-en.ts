import type { ReactNode } from 'react';

/** Auth: a client user's email-link sign-in and a self-hosted install's first admin. */
export const authEn = {
  clientSignIn: {
    invalidEmail: 'Enter a valid email address.',
    sendFailed: 'We could not send a link just now. Please try again.',
    yourAgency: 'your agency',
    checkEmail: 'Check your email',
    sentSubtitle: (email: ReactNode, name: string): ReactNode[] => ['If ', email, ` can sign in to ${name}, a sign-in link is on its way.`],
    trouble: 'Trouble signing in?',
    needAccess: 'Need access?',
    contact: (name: string) => `Contact ${name}`,
    sentBody: (name: string) =>
      `Open the link on this device. It works once and expires in 15 minutes. Nothing arrived? Check your spam folder, or ask ${name} to invite this address.`,
    anotherEmail: 'Use another email',
    signInTo: (name: string) => `Sign in to ${name}`,
    signInDashboard: 'Sign in to your dashboard',
    subtitle: 'Enter your email and we will send you a link to sign in. No password needed.',
    sessionEnded: 'Your session has ended. Sign in again to continue.',
    email: 'Email',
    submit: 'Email me a sign-in link',
  },

  verifyLink: {
    requestNew: 'Request a new link',
    invalidTitle: 'This link is invalid or has expired',
    invalidBody: 'Sign-in links work once and expire after 15 minutes. Request a new one and use it on this device.',
    errorTitle: 'We could not sign you in',
    errorBody: 'Your link has not been used. Try again in a moment.',
    verifyingTitle: 'Signing you in…',
    verifyingBody: 'One moment while we check your link.',
  },

  setup: {
    alreadyTitle: 'Already Set Up',
    alreadyBody: 'This Seentics instance already has an admin account. Please sign in to continue.',
    goToSignIn: 'Go to Sign In',
    nameRequired: 'Name is required',
    emailRequired: 'Email is required',
    invalidEmail: 'Please enter a valid email address',
    passwordRequired: 'Password is required',
    passwordShort: 'Password must be at least 8 characters',
    passwordMismatch: 'Passwords do not match',
    completeTitle: 'Setup complete!',
    completeBody: 'Your admin account has been created.',
    failed: 'Setup failed. Please try again.',
    failedTitle: 'Setup Failed',
    failedBody: 'Could not create admin account.',
    title: 'Set up your instance.',
    subtitle: 'Create an admin account to get started.',
    fullName: 'Full Name',
    namePlaceholder: 'Admin',
    email: 'Email Address',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    submit: 'Initialize Seentics',
    alreadySetUp: 'Already set up?',
    signIn: 'Sign In',
  },
};

export type AuthMessages = typeof authEn;

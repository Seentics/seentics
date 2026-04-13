import { BarChart3, Braces, Shield, Video, Zap } from 'lucide-react';

export const enterpriseAuthMarketing = {
    headline: 'One workspace for traffic, replay, and conversion.',
    signupSubhead:
        'Start free, connect your site in a few minutes. No credit card. See what visitors do and where you lose them.',
    signinSubhead:
        'Your sites, metrics, recordings, and automations — pick up where you left off.',
    footnote: 'Free forever for 1 website · No credit card required',
    mobileTeaser:
        'Live metrics, session replay, heatmaps, funnels, automations, API, and embeddable UI.',
} as const;

export const enterpriseAuthFeatures = [
    {
        icon: BarChart3,
        text: 'Live dashboards: acquisition, geography, device, browser — kept fast.',
    },
    {
        icon: Video,
        text: 'Session replay plus heatmaps: real visits, clicks, and scroll depth.',
    },
    {
        icon: Zap,
        text: 'Goals, funnels, and automations: measure paths and react to behavior.',
    },
    {
        icon: Braces,
        text: 'API and importable components: your data, your surfaces.',
    },
    { icon: Shield, text: 'Privacy-first, GDPR compliant, no cookies' },
] as const;

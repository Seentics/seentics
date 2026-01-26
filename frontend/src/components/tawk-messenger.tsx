'use client';

import { useEffect } from 'react';

/**
 * Tawk.to Global Messenger Integration
 * 
 * Securely injects the support chat script into the application.
 */
export default function TawkMessenger() {
    useEffect(() => {
        const Tawk_API = (window as any).Tawk_API || {};
        // const Tawk_LoadStart = new Date();

        const script = document.createElement("script");
        script.async = true;
        script.src = 'https://embed.tawk.to/69770d1b96601c197de26adb/1jfsgmdtn';
        script.charset = 'UTF-8';
        script.setAttribute('crossorigin', '*');

        const firstScript = document.getElementsByTagName("script")[0];
        if (firstScript && firstScript.parentNode) {
            firstScript.parentNode.insertBefore(script, firstScript);
        } else {
            document.head.appendChild(script);
        }

        return () => {
            // Cleanup script if needed, though Tawk.to usually persists
            script.remove();
        };
    }, []);

    return null;
}

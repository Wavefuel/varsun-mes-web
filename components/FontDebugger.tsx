'use client';

import { useEffect } from 'react';

export default function FontDebugger() {
    useEffect(() => {
        // Wait a bit for fonts to load
        const timer = setTimeout(() => {
            const bodyFn = window.getComputedStyle(document.body).fontFamily;

            // Try to find a header or an element using font-display
            const header = document.querySelector('h1, h2, h3, .font-display');
            const headerFn = header ? window.getComputedStyle(header).fontFamily : 'N/A';

            console.log('%c[Font Debugger]', 'color: #bada55; font-weight: bold; background: #222; padding: 4px;');
            console.log('Body Font Family (Sans):', bodyFn);
            console.log('Header Font Family (Display):', headerFn);

            if (bodyFn.includes('Noto Sans') || bodyFn.includes('__Noto_Sans')) {
                console.log('✅ Noto Sans detected in body.');
            } else {
                console.warn('⚠️ Noto Sans NOT detected in body. Current:', bodyFn);
            }

            if (headerFn.includes('Space Grotesk') || headerFn.includes('__Space_Grotesk')) {
                console.log('✅ Space Grotesk detected in header.');
            } else {
                console.warn('⚠️ Space Grotesk NOT detected in header. Current:', headerFn);
            }

            // Check if variables are defined
            const docStyle = getComputedStyle(document.documentElement);
            console.log('--font-noto variable:', docStyle.getPropertyValue('--font-noto'));
            console.log('--font-space variable:', docStyle.getPropertyValue('--font-space'));

        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    return null; // Render nothing visible
}

'use client';

import React from 'react';

export default function FullScreenVideoSection(): JSX.Element {
  return (
    <div className="h-screen w-full relative">
      <iframe
        src="https://www.loom.com/share/8b96525b09ff421080f5bb3ca8930f6b?sid=7fdbd3bd-6309-488e-bf55-4437cc869562&autoplay=1&muted=1&hide_owner=true&hide_share=true&hide_title=true"
        className="w-full h-full absolute inset-0"
        frameBorder="0"
        allowFullScreen
        allow="autoplay; encrypted-media"
      />
    </div>
  );
}
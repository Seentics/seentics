/**
 * Seentics Funnel Tracker
 * Handles funnel step tracking and conversion monitoring
 * Requires: seentics-core.js
 */

(function(w, d) {
  'use strict';

  const S = w.SEENTICS_CORE;
  if (!S) {
    console.error('[Seentics Funnel] Core not loaded. Include seentics-core.js first.');
    return;
  }

  // Funnel state
  const funnel = {
    activeFunnels: [],
    currentFunnels: new Map(), // funnelId -> { currentStep, completedSteps, startedAt }
    initialized: false
  };

  // Load active funnels
  const loadFunnels = async () => {
    try {
      const response = await S.api.get('funnels/active', {
        website_id: S.config.websiteId
      });
      funnel.activeFunnels = response.funnels || [];
      S.emit('funnel:loaded', { count: funnel.activeFunnels.length });
      
      // Restore funnel progress from session
      const stored = sessionStorage.getItem('seentics_funnel_progress');
      if (stored) {
        const progress = JSON.parse(stored);
        Object.entries(progress).forEach(([id, data]) => {
          funnel.currentFunnels.set(id, data);
        });
      }
    } catch (error) {
      if (S.config.debug) {
        console.error('[Seentics Funnel] Failed to load funnels:', error);
      }
    }
  };

  // Save funnel progress
  const saveFunnelProgress = () => {
    const progress = {};
    funnel.currentFunnels.forEach((data, id) => {
      progress[id] = data;
    });
    sessionStorage.setItem('seentics_funnel_progress', JSON.stringify(progress));
  };

  // Check if step matches current page/event
  const matchesStep = (step, eventData) => {
    // Handle both camelCase and snake_case
    const stepType = (step.stepType || step.step_type || '').toLowerCase();
    const matchType = step.matchType || step.match_type || 'exact';
    
    // Normalize step type checking (handle page_view vs pageView)
    if (stepType === 'page_view' || stepType === 'pageview') {
      const currentPath = w.location.pathname;
      const targetPath = step.pagePath || step.page_path;

      switch (matchType) {
        case 'exact':
          return currentPath === targetPath;
        case 'contains':
          return currentPath.includes(targetPath);
        case 'starts_with':
        case 'startswith':
          return currentPath.startsWith(targetPath);
        case 'regex':
          try {
            return new RegExp(targetPath).test(currentPath);
          } catch (e) {
            return false;
          }
        default:
          return currentPath === targetPath;
      }
    }

    if (stepType === 'event') {
      const targetEventType = step.eventType || step.event_type;
      return eventData.eventName === targetEventType;
    }

    return false;
  };

  // Process funnel step
  const processFunnelStep = (eventType, eventData = {}) => {
    funnel.activeFunnels.forEach(funnelDef => {
      const funnelId = funnelDef.id;
      const steps = funnelDef.steps || [];

      if (steps.length === 0) return;

      // Sort steps by order to ensure correct sequencing
      const sortedSteps = [...steps].sort((a, b) => {
        const aOrder = a.order !== undefined ? a.order : (a.step_order || 0);
        const bOrder = b.order !== undefined ? b.order : (b.step_order || 0);
        return aOrder - bOrder;
      });

      const getOrder = (step) => step.order !== undefined ? step.order : (step.step_order || 0);
      const minOrder = getOrder(sortedSteps[0]);
      const maxOrder = getOrder(sortedSteps[sortedSteps.length - 1]);

      // Get or initialize funnel progress
      let progress = funnel.currentFunnels.get(funnelId);

      if (!progress) {
        // Check if this is the first step (the one with the lowest order value)
        const firstStep = sortedSteps[0];
        if (firstStep && matchesStep(firstStep, eventData)) {
          progress = {
            currentStep: minOrder,
            completedSteps: [minOrder],
            startedAt: new Date().toISOString()
          };
          funnel.currentFunnels.set(funnelId, progress);
          saveFunnelProgress();

          // Track funnel start
          trackFunnelEvent(funnelId, {
            event_type: 'start',
            step_name: firstStep.name,
            current_step: minOrder,
            completed_steps: [minOrder]
          });

          S.emit('funnel:started', { funnelId, step: firstStep });
        }
        return;
      }

      // Find the next step in sequence (the first step whose order > currentStep)
      const nextStep = sortedSteps.find(s => getOrder(s) > progress.currentStep);

      if (nextStep && matchesStep(nextStep, eventData)) {
        const nextOrder = getOrder(nextStep);
        progress.currentStep = nextOrder;
        progress.completedSteps.push(nextOrder);
        saveFunnelProgress();

        // Funnel is complete when the last (max order) step is reached
        const isComplete = nextOrder === maxOrder;

        trackFunnelEvent(funnelId, {
          event_type: isComplete ? 'conversion' : 'progress',
          step_name: nextStep.name,
          current_step: nextOrder,
          completed_steps: progress.completedSteps,
          converted: isComplete
        });

        if (isComplete) {
          S.emit('funnel:completed', { funnelId, steps: progress.completedSteps });
          funnel.currentFunnels.delete(funnelId);
          saveFunnelProgress();
        } else {
          S.emit('funnel:progress', { funnelId, step: nextStep, progress });
        }
      }
    });
  };

  // Track funnel event (buffered)
  const trackFunnelEvent = (funnelId, data) => {
    funnel.buffer.push({
      funnel_id: funnelId,
      website_id: S.config.websiteId,
      visitor_id: S.state.visitorId,
      session_id: S.state.sessionId,
      started_at: funnel.currentFunnels.get(funnelId)?.startedAt || new Date().toISOString(),
      timestamp: new Date().toISOString(),
      ...data
    });
  };

  // Buffer management
  funnel.buffer = [];
  funnel.flushInterval = setInterval(async () => {
      if (funnel.buffer.length === 0) return;

      const batch = [...funnel.buffer];
      funnel.buffer = [];

      try {
          await S.api.send('funnels/batch', {
            website_id: S.config.websiteId,
            events: batch
          });
      } catch (error) {
          if (S.config.debug) {
            console.error('[Seentics Funnel] Failed to track batch, re-queuing:', error);
          }
          // Re-queue failed events for the next flush attempt
          funnel.buffer.unshift(...batch);
      }
  }, 30000); // 30 seconds

  // Setup funnel listeners
  const setupFunnelListeners = () => {
    // Listen to analytics events
    S.on('analytics:pageview', (data) => {
      processFunnelStep('pageview', data);
    });

    S.on('analytics:event', (data) => {
      processFunnelStep('event', data);
    });

    // Track dropoffs and flush buffer on page exit
    const flushFunnelBuffer = () => {
      if (funnel.buffer.length === 0) return;
      const payload = JSON.stringify({
        website_id: S.config.websiteId,
        events: funnel.buffer
      });
      navigator.sendBeacon(
        `${S.config.apiHost}/api/v1/funnels/batch`,
        new Blob([payload], { type: 'application/json' })
      );
      funnel.buffer = [];
    };

    w.addEventListener('beforeunload', () => {
      funnel.currentFunnels.forEach((progress, funnelId) => {
        if (progress.currentStep < funnel.activeFunnels.find(f => f.id === funnelId)?.steps.length - 1) {
          trackFunnelEvent(funnelId, {
            event_type: 'dropoff',
            current_step: progress.currentStep,
            completed_steps: progress.completedSteps
          });
        }
      });
      flushFunnelBuffer();
    });

    d.addEventListener('visibilitychange', () => {
      if (d.visibilityState === 'hidden') flushFunnelBuffer();
    });
  };

  // Initialize
  const init = async () => {
    // Prevent double init
    if (funnel.initialized) return;
    funnel.initialized = true;

    await loadFunnels();
    setupFunnelListeners();
  };

  // Listen for core ready or init if already ready
  if (S.isReady && S.isReady()) {
    init();
  } else {
    S.on('core:ready', init);
  }

  // Public API
  w.seentics = w.seentics || {};
  w.seentics.funnel = {
    getProgress: (funnelId) => funnel.currentFunnels.get(funnelId),
    getAllProgress: () => Object.fromEntries(funnel.currentFunnels),
    reset: (funnelId) => {
      if (funnelId) {
        funnel.currentFunnels.delete(funnelId);
      } else {
        funnel.currentFunnels.clear();
      }
      saveFunnelProgress();
    }
  };

})(window, document);

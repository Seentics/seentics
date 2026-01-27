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
  };

  // Load active funnels
  const loadFunnels = async () => {
    try {
      const response = await S.api.send('funnels/active', {
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
    if (step.step_type === 'page_view') {
      const currentPath = w.location.pathname;
      const targetPath = step.page_path;

      switch (step.match_type) {
        case 'exact':
          return currentPath === targetPath;
        case 'contains':
          return currentPath.includes(targetPath);
        case 'starts_with':
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

    if (step.step_type === 'event') {
      return eventData.eventName === step.event_type;
    }

    return false;
  };

  // Process funnel step
  const processFunnelStep = (eventType, eventData = {}) => {
    funnel.activeFunnels.forEach(funnelDef => {
      const funnelId = funnelDef.id;
      const steps = funnelDef.steps || [];

      if (steps.length === 0) return;

      // Get or initialize funnel progress
      let progress = funnel.currentFunnels.get(funnelId);
      
      if (!progress) {
        // Check if this is the first step
        const firstStep = steps.find(s => s.order === 0);
        if (firstStep && matchesStep(firstStep, eventData)) {
          progress = {
            currentStep: 0,
            completedSteps: [0],
            startedAt: new Date().toISOString()
          };
          funnel.currentFunnels.set(funnelId, progress);
          saveFunnelProgress();

          // Track funnel start
          trackFunnelEvent(funnelId, {
            event_type: 'start',
            step_name: firstStep.name,
            current_step: 0,
            completed_steps: [0]
          });

          S.emit('funnel:started', { funnelId, step: firstStep });
        }
        return;
      }

      // Check for next step
      const nextStepOrder = progress.currentStep + 1;
      const nextStep = steps.find(s => s.order === nextStepOrder);

      if (nextStep && matchesStep(nextStep, eventData)) {
        progress.currentStep = nextStepOrder;
        progress.completedSteps.push(nextStepOrder);
        saveFunnelProgress();

        // Check if funnel is complete
        const isComplete = nextStepOrder === steps.length - 1;

        trackFunnelEvent(funnelId, {
          event_type: isComplete ? 'conversion' : 'progress',
          step_name: nextStep.name,
          current_step: nextStepOrder,
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

  // Track funnel event
  const trackFunnelEvent = async (funnelId, data) => {
    try {
      await S.api.send('funnels/track', {
        funnel_id: funnelId,
        website_id: S.config.websiteId,
        visitor_id: S.state.visitorId,
        session_id: S.state.sessionId,
        started_at: funnel.currentFunnels.get(funnelId)?.startedAt || new Date().toISOString(),
        timestamp: new Date().toISOString(),
        ...data
      });
    } catch (error) {
      if (S.config.debug) {
        console.error('[Seentics Funnel] Failed to track event:', error);
      }
    }
  };

  // Setup funnel listeners
  const setupFunnelListeners = () => {
    // Listen to analytics events
    S.on('analytics:pageview', (data) => {
      processFunnelStep('pageview', data);
    });

    S.on('analytics:event', (data) => {
      processFunnelStep('event', data);
    });

    // Track dropoffs on page exit
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
    });
  };

  // Initialize
  S.on('core:ready', async () => {
    await loadFunnels();
    setupFunnelListeners();
  });

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

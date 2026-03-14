import { useState, useCallback } from 'react';

const STORAGE_KEY = 'derbix_onboarding_v1';

export interface OnboardingState {
  shouldShow: boolean;
  currentStep: number;
  totalSteps: number;
  nextStep: () => void;
  prevStep: () => void;
  skip: () => void;
  complete: () => void;
  startTour: () => void;
  showWelcome: boolean;
}

export const useOnboarding = (hasProfile: boolean): OnboardingState => {
  const isDone = localStorage.getItem(STORAGE_KEY) === 'done';
  const [shouldShow, setShouldShow] = useState(!isDone && hasProfile);
  const [showWelcome, setShowWelcome] = useState(!isDone && hasProfile);
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 4;

  const markDone = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'done');
    setShouldShow(false);
    setShowWelcome(false);
  }, []);

  const startTour = useCallback(() => {
    setShowWelcome(false);
    setCurrentStep(0);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => {
      if (prev >= totalSteps - 1) {
        markDone();
        return prev;
      }
      return prev + 1;
    });
  }, [totalSteps, markDone]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  return {
    shouldShow,
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    skip: markDone,
    complete: markDone,
    startTour,
    showWelcome,
  };
};

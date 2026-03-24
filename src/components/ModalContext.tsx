import React, { createContext, useContext, useState, useCallback } from 'react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
}

type ConfirmationType = 'primary' | 'danger';

interface ConfirmationState {
  isOpen: boolean;
  message: string;
  type: ConfirmationType;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ProgressState {
  isOpen: boolean;
  message: string;
  projectId?: number;
}

interface PromptState {
  isOpen: boolean;
  title?: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
}

interface ModalContextType {
  notify: (message: string, type?: NotificationType) => void;
  alert: (message: string, title?: string) => void;
  confirm: (message: string, onConfirm: () => void, onCancel?: () => void, type?: ConfirmationType) => void;
  prompt: (opts: Omit<PromptState, 'isOpen'>) => void;
  showProgress: (message: string, projectId?: number) => void;
  hideProgress: () => void;
  notifications: Notification[];
  removeNotification: (id: string) => void;
  alertState: AlertState;
  closeAlert: () => void;
  confirmationState: ConfirmationState;
  closeConfirmation: () => void;
  progressState: ProgressState;
  promptState: PromptState;
  closePrompt: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    title: 'Alert',
    message: '',
  });
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    isOpen: false,
    message: '',
    type: 'primary',
    onConfirm: () => {},
  });
  const [progressState, setProgressState] = useState<ProgressState>({
    isOpen: false,
    message: '',
  });

  const [promptState, setPromptState] = useState<PromptState>({
    isOpen: false,
    onConfirm: () => {},
  });

  const notify = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const alert = useCallback((message: string, title: string = 'Alert') => {
    setAlertState({ isOpen: true, title, message });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const confirm = useCallback((message: string, onConfirm: () => void, onCancel?: () => void, type: ConfirmationType = 'primary') => {
    setConfirmationState({
      isOpen: true,
      message,
      type,
      onConfirm: () => {
        onConfirm();
        setConfirmationState((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        if (onCancel) onCancel();
        setConfirmationState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }, []);

  const closeConfirmation = useCallback(() => {
    setConfirmationState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const showProgress = useCallback((message: string, projectId?: number) => {
    setProgressState({ isOpen: true, message, projectId });
  }, []);

  const hideProgress = useCallback(() => {
    setProgressState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const prompt = useCallback((opts: Omit<PromptState, 'isOpen'>) => {
    setPromptState({ ...opts, isOpen: true });
  }, []);

  const closePrompt = useCallback(() => {
    setPromptState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <ModalContext.Provider
      value={{
        notify,
        alert,
        confirm,
        prompt,
        showProgress,
        hideProgress,
        notifications,
        removeNotification,
        alertState,
        closeAlert,
        confirmationState,
        closeConfirmation,
        progressState,
        promptState,
        closePrompt,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

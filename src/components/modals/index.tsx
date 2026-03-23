import React from 'react';
import { NotificationToast } from './NotificationToast';
import { AlertModal } from './AlertModal';
import { ConfirmModal } from './ConfirmModal';
import '../Modals.css';

export { NotificationToast, AlertModal, ConfirmModal };

export const ModalContainer: React.FC = () => {
  return (
    <>
      <NotificationToast />
      <AlertModal />
      <ConfirmModal />
    </>
  );
};

import { NotificationToast } from './NotificationToast';
import { AlertModal } from './AlertModal';
import { ConfirmModal } from './ConfirmModal';
import { PromptModal } from './PromptModal';
import ScanStatusOverlay from './ScanStatusOverlay';
import '../Modals.css';

export { NotificationToast, AlertModal, ConfirmModal, PromptModal, ScanStatusOverlay };

export const ModalContainer: React.FC = () => {
  return (
    <>
      <NotificationToast />
      <AlertModal />
      <ConfirmModal />
      <PromptModal />
      <ScanStatusOverlay />
    </>
  );
};

import './Alert.css'

interface AlertProps {
  message: string;
  isVisible: boolean;
}

export default function Alert({ message, isVisible }: AlertProps) {
  if (!isVisible) return null;

  return (
    <div className="alert-toast">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      {message}
    </div>
  )
}

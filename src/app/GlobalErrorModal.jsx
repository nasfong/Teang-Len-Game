import Modal from '../components/Modal/Modal.jsx'
import Button from '../components/Button/Button.jsx'
import { useAppError } from '../state/appError'

// The one global error popup — a frosted glass card shown whenever the app loses
// its connection or hits an unexpected server fault (fed by the query cache +
// socket, see appError). Mounted once at the app root so it overlays any screen.
export default function GlobalErrorModal() {
  const error = useAppError((s) => s.error)
  const clearError = useAppError((s) => s.clearError)

  return (
    <Modal open={Boolean(error)} variant="glass" size="sm" title={error?.title ?? 'Connection problem'} onClose={clearError}>
      <div className="flex flex-col items-center gap-5 py-1 text-center">
        <span className="text-4xl drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]">📡</span>
        <p className="font-display text-base text-white/90 [--stroke-width:0]">
          {error?.message ?? 'Please check your connection and try again.'}
        </p>
        <Button variant="green" outline="navy" onClick={clearError}>
          OK
        </Button>
      </div>
    </Modal>
  )
}

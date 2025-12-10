import { lazy, Suspense } from 'react'

// Lazy load modals for better performance
export const LazyFileDetailsModal = lazy(() => 
  import('./FileDetailsModal')
)

export const LazyCommentsModal = lazy(() => 
  import('./CommentsModal')
)

export const LazyFormModal = lazy(() => 
  import('./FormModal')
)

export const LazyConfirmationModal = lazy(() => 
  import('./ConfirmationModal')
)

// Loading fallback component
const ModalLoader = () => (
  <div style={{
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 10000
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '4px solid #f3f3f3',
      borderTop: '4px solid #3498db',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
  </div>
)

// Wrapper components with Suspense
export const FileDetailsModal = (props) => (
  <Suspense fallback={<ModalLoader />}>
    <LazyFileDetailsModal {...props} />
  </Suspense>
)

export const CommentsModal = (props) => (
  <Suspense fallback={<ModalLoader />}>
    <LazyCommentsModal {...props} />
  </Suspense>
)

export const FormModal = (props) => (
  <Suspense fallback={<ModalLoader />}>
    <LazyFormModal {...props} />
  </Suspense>
)

export const ConfirmationModal = (props) => (
  <Suspense fallback={<ModalLoader />}>
    <LazyConfirmationModal {...props} />
  </Suspense>
)

// Keep AlertMessage non-lazy since it's small and used frequently
export { default as AlertMessage } from './AlertMessage'

import React, { useState } from 'react'
import { AlertMessage, ConfirmationModal, FormModal } from './modals'

/**
 * Test component to verify modal components work correctly
 * Access this at /modal-test route to test modals independently
 */
const ModalTest = () => {
  const [showAlert, setShowAlert] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [alertType, setAlertType] = useState('success')

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Modal Components Test Page</h1>
      <p>Test all reusable modal components to ensure they work correctly.</p>
      
      <div style={{ marginTop: '2rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem' }}>
          <h3>Alert Messages</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
            <button onClick={() => { setAlertType('success'); setShowAlert(true); }}>
              Show Success Alert
            </button>
            <button onClick={() => { setAlertType('error'); setShowAlert(true); }}>
              Show Error Alert
            </button>
            <button onClick={() => { setAlertType('warning'); setShowAlert(true); }}>
              Show Warning Alert
            </button>
            <button onClick={() => { setAlertType('info'); setShowAlert(true); }}>
              Show Info Alert
            </button>
          </div>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem' }}>
          <h3>Confirmation Modal</h3>
          <button onClick={() => setShowConfirm(true)} style={{ marginTop: '1rem' }}>
            Show Confirmation Modal
          </button>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.5rem' }}>
          <h3>Form Modal</h3>
          <button onClick={() => setShowForm(true)} style={{ marginTop: '1rem' }}>
            Show Form Modal
          </button>
        </div>
      </div>

      {showAlert && (
        <AlertMessage
          type={alertType}
          message={`This is a ${alertType} message!`}
          onClose={() => setShowAlert(false)}
        />
      )}

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          alert('Confirmed!');
          setShowConfirm(false);
        }}
        title="Test Confirmation"
        message="Are you sure you want to proceed?"
        variant="danger"
      >
        <p className="confirmation-description">
          This is additional content inside the confirmation modal.
        </p>
      </ConfirmationModal>

      <FormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={(e) => {
          e.preventDefault();
          alert('Form submitted!');
          setShowForm(false);
        }}
        title="Test Form"
        submitText="Submit"
      >
        <div className="form-group">
          <label>Test Input</label>
          <input type="text" className="form-input" placeholder="Enter something..." />
        </div>
        <div className="form-group">
          <label>Test Select</label>
          <select className="form-select">
            <option>Option 1</option>
            <option>Option 2</option>
          </select>
        </div>
      </FormModal>

      <div style={{ marginTop: '3rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
        <h3>Component Status</h3>
        <ul>
          <li>✅ AlertMessage component loaded</li>
          <li>✅ ConfirmationModal component loaded</li>
          <li>✅ FormModal component loaded</li>
        </ul>
        <p style={{ marginTop: '1rem', color: '#6b7280' }}>
          If you can see this page and interact with the buttons above, the modal components are working correctly.
        </p>
      </div>
    </div>
  )
}

export default ModalTest

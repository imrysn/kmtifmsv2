const AlertMessage = ({ error, success, clearMessages }) => {
  if (!error && !success) return null

  return (
    <>
      {error && (
        <div className="tl-alert error">
          {error}
          <button onClick={clearMessages}>×</button>
        </div>
      )}
      {success && (
        <div className="tl-alert success">
          {success}
          <button onClick={clearMessages}>×</button>
        </div>
      )}
    </>
  )
}

export default AlertMessage

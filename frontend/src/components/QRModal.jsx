
import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./QRModal.css";

export default function QRModal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="qr-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="qr-modal"
        role="dialog"
        aria-modal="true"
        aria-label="ShareBite pickup QR code"
      >
        <button
          type="button"
          className="qr-modal-close"
          onClick={onClose}
          aria-label="Close QR code"
        >
          ×
        </button>

        <div className="qr-modal-heading">
          <span className="qr-modal-icon">▦</span>
          <h2>Pickup QR code</h2>
          <p>
            Show this code to the donor to complete the pickup.
          </p>
        </div>

        <div className="qr-modal-content">
          {children}
        </div>

        <div className="qr-modal-footer">
          <span>
            🔒 Keep this QR code private until handover.
          </span>

          <button
            type="button"
            className="qr-modal-done"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

"use client";

export default function PrintButton() {
  return (
    <button type="button" className="btn btn-sm" onClick={() => window.print()}>
      Print
    </button>
  );
}

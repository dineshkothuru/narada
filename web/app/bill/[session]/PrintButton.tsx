"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-full bg-rose-600 px-5 py-2 text-xs font-bold text-white transition active:scale-95"
    >
      🖨️ Print bill
    </button>
  );
}

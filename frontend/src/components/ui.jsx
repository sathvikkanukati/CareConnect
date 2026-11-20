export const TYPES = { food: "Food", clothes: "Clothes", essentials: "Essentials" };

export function Alert({ kind = "error", children }) {
  if (!children) return null;
  return <div className={`alert ${kind}`}>{children}</div>;
}

export function Badge({ value }) {
  return <span className={`badge ${value}`}>{value}</span>;
}

export const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

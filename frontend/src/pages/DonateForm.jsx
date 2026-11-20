import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, uploadImage } from "../api.js";
import { Alert, TYPES } from "../components/ui.jsx";

const CATEGORIES = {
  food: ["Cooked meal", "Packaged food", "Fruits & vegetables", "Bakery", "Other"],
  clothes: ["Men", "Women", "Kids", "Winter wear", "Other"],
  essentials: ["Blankets", "Toiletries", "Books & stationery", "Utensils", "Other"],
};

export default function DonateForm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const startType = TYPES[params.get("type")] ? params.get("type") : "food";
  const [type, setType] = useState(startType);
  const [f, setF] = useState({
    title: params.get("title") || "", category: "", description: "", quantity: "",
    quantity_unit: "items", condition: "good", size_or_age_group: "", location: "", expiry: "",
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [classifying, setClassifying] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (!image) {
      setImagePreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(image);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [image]);

  async function suggestDonationDetails() {
    if (!image) return;
    setErr("");
    setAiSuggestion(null);
    setClassifying(true);
    try {
      const form = new FormData();
      form.append("image", image);
      form.append("donation_type", type);
      const suggestion = await api("/donations/classify-image/", {
        method: "POST",
        body: form,
      });
      setAiSuggestion(suggestion);
      if (suggestion.is_item) {
        setF((current) => ({
          ...current,
          title: suggestion.item_name || current.title,
          category: suggestion.category || current.category,
        }));
      }
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setClassifying(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const body = {
        donation_type: type,
        title: f.title.trim(),
        category: f.category,
        description: f.description.trim(),
        quantity: Number(f.quantity),
        location: f.location.trim(),
      };
      if (type === "food") {
        body.quantity_unit = "servings";
        body.expiry = f.expiry ? new Date(f.expiry).toISOString() : null;
      } else {
        body.quantity_unit = f.quantity_unit.trim() || "items";
        body.condition = f.condition;
        if (type === "clothes") body.size_or_age_group = f.size_or_age_group.trim();
      }
      if (image) body.image_url = await uploadImage(image);
      await api("/donations/", { method: "POST", body });
      navigate("/donor");
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="workflow-page donate-workflow">
      <header className="workflow-heading">
        <span className="page-kicker">SHARE WITH YOUR COMMUNITY</span>
        <h1>New donation</h1>
        <p>Give nearby organisations the details they need to arrange a safe, easy pickup.</p>
      </header>
      <section className="card workflow-card">
      <div className="tabs">
        {Object.entries(TYPES).map(([k, label]) => (
          <button key={k} type="button" className={`tab ${type === k ? "active" : ""}`} onClick={() => { setType(k); setAiSuggestion(null); }}>{label}</button>
        ))}
      </div>
      <Alert>{err}</Alert>
      <form className="stack" onSubmit={submit}>
        <label>What are you donating?
          <input value={f.title} onChange={set("title")} required
            placeholder={type === "food" ? "e.g. Veg biryani" : type === "clothes" ? "e.g. Winter jackets" : "e.g. Blankets"} />
        </label>
        <div className="two">
          <label>Category
            <select value={f.category} onChange={set("category")}>
              <option value="">Select…</option>
              {CATEGORIES[type].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>{type === "food" ? "Servings" : "Quantity"}
            <input type="number" min="1" value={f.quantity} onChange={set("quantity")} required />
          </label>
        </div>
        {type === "food" ? (
          <label>Best before / expiry
            <input type="datetime-local" value={f.expiry} onChange={set("expiry")} required />
          </label>
        ) : (
          <div className="two">
            <label>Condition
              <select value={f.condition} onChange={set("condition")}>
                <option value="new">New</option>
                <option value="good">Good</option>
                <option value="used">Used</option>
              </select>
            </label>
            <label>Unit
              <input value={f.quantity_unit} onChange={set("quantity_unit")} placeholder="items, pairs, sets…" />
            </label>
          </div>
        )}
        {type === "clothes" && (
          <label>Size / age group<input value={f.size_or_age_group} onChange={set("size_or_age_group")} placeholder="e.g. M, Kids 5-8" /></label>
        )}
        <label>Pickup location<input value={f.location} onChange={set("location")} required /></label>
        <label>Description (optional)<textarea value={f.description} onChange={set("description")} /></label>
        <div className="photo-assist">
          <div className="photo-assist-heading">
            <span className="page-kicker">AI PHOTO ASSIST</span>
            <strong>Suggest donation details from a photo</strong>
            <p>Upload a clear photo to get a suggested name and category for food, clothes, or essentials. Review them before publishing.</p>
          </div>
          <label>Donation photo (optional)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                setImage(e.target.files[0] || null);
                setAiSuggestion(null);
              }}
            />
          </label>
          {imagePreview && (
            <img className="photo-assist-preview" src={imagePreview} alt="Selected donation preview" />
          )}
          <button
            className="btn ghost photo-assist-button"
            type="button"
            disabled={!image || classifying}
            onClick={suggestDonationDetails}
          >
            {classifying ? "Checking photo..." : "Suggest name and category"}
          </button>
          {aiSuggestion?.is_item && (
            <p className="photo-assist-result" role="status">Suggested details added. Please check the name and category above.</p>
          )}
          {aiSuggestion && !aiSuggestion.is_item && (
            <p className="photo-assist-note" role="status">No matching donation item was found. You can enter the details manually.</p>
          )}
        </div>
        <button className="btn" disabled={busy || classifying}>Publish donation</button>
      </form>
      </section>
    </main>
  );
}

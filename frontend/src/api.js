const API =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// ==========================================
// CSRF COOKIE HELPERS
// ==========================================

function getCookie(name) {
  const cookies = document.cookie
    ? document.cookie.split(";")
    : [];

  for (const cookie of cookies) {
    const trimmed = cookie.trim();

    if (trimmed.startsWith(name + "=")) {
      return decodeURIComponent(
        trimmed.substring(name.length + 1)
      );
    }
  }

  return null;
}

// ==========================================
// INITIALIZE CSRF
// ==========================================

let csrfPromise = null;

export async function initializeCsrf() {
  if (!csrfPromise) {
    csrfPromise = fetch(`${API}/auth/csrf/`, {
      method: "GET",
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to initialize CSRF protection.");
        }

        return true;
      })
      .finally(() => {
        csrfPromise = null;
      });
  }

  return csrfPromise;
}

// ==========================================
// REMOVE OLD LOCALSTORAGE TOKENS
// ==========================================

export const getAccess = () => null;

export const setTokens = () => {};

export const clearTokens = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
};

// ==========================================
// API ERROR
// ==========================================

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function errorMessage(data, status) {
  if (!data) {
    return `Request failed (${status}).`;
  }

  if (typeof data === "string") {
    return data;
  }

  if (data.detail) {
    return data.detail;
  }

  if (Array.isArray(data)) {
    return data.join(" ");
  }

  return Object.entries(data)
    .map(([key, value]) => {
      return `${key}: ${
        Array.isArray(value)
          ? value.join(" ")
          : typeof value === "object"
          ? JSON.stringify(value)
          : value
      }`;
    })
    .join(" | ");
}

// ==========================================
// REFRESH ACCESS TOKEN
// ==========================================

let refreshPromise = null;

async function refreshAccess() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        await initializeCsrf();

        const csrfToken = getCookie("csrftoken");

        if (!csrfToken) {
          return false;
        }

        const response = await fetch(`${API}/auth/refresh/`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
          },
        });

        return response.ok;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

// ==========================================
// MAIN API FUNCTION
// ==========================================

export async function api(
  path,
  { method = "GET", body, auth = true } = {}
) {
  const upperMethod = method.toUpperCase();

  const unsafeMethod = ![
    "GET",
    "HEAD",
    "OPTIONS",
    "TRACE",
  ].includes(upperMethod);

  // Initialize CSRF before modifying requests.
  if (unsafeMethod) {
    try {
      await initializeCsrf();
    } catch {
      throw new ApiError(
        "Unable to initialize CSRF protection. Check Django backend.",
        0,
        null
      );
    }
  }

  const send = () => {
    const headers = {};
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

    if (body !== undefined && body !== null && !isFormData) {
      headers["Content-Type"] = "application/json";
    }

    if (unsafeMethod) {
      const csrfToken = getCookie("csrftoken");

      if (csrfToken) {
        headers["X-CSRFToken"] = csrfToken;
      }
    }

    return fetch(`${API}${path}`, {
      method: upperMethod,
      credentials: "include",
      headers,
      body:
        body !== undefined && body !== null
          ? isFormData ? body : JSON.stringify(body)
          : undefined,
    });
  };

  let response;

  try {
    response = await send();

    // Try refreshing an expired access token.
    if (
      response.status === 401 &&
      auth &&
      !path.includes("/auth/refresh/") &&
      (await refreshAccess())
    ) {
      // Retry the original request.
      response = await send();
    }
  } catch {
    throw new ApiError(
      "Cannot reach the server. Is the Django backend running?",
      0,
      null
    );
  }

  const responseText = await response.text();

  let data = null;

  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = responseText || null;
  }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearTokens();

      window.dispatchEvent(
        new Event("auth-expired")
      );
    }

    throw new ApiError(
      errorMessage(data, response.status),
      response.status,
      data
    );
  }

  return data;
}

// ==========================================
// LIST API
// ==========================================

export async function list(path) {
  const data = await api(path);

  return Array.isArray(data)
    ? data
    : data?.results ?? [];
}

// ==========================================
// CLOUDINARY IMAGE UPLOAD
// ==========================================

export async function uploadImage(file) {
  const cloud =
    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

  const preset =
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloud || !preset) {
    throw new Error(
      "Photo upload is not set up. Add the VITE_CLOUDINARY values to .env, or submit without a photo."
    );
  }

  const form = new FormData();

  form.append("file", file);
  form.append("upload_preset", preset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    {
      method: "POST",
      body: form,
    }
  );

  if (!response.ok) {
    throw new Error("Photo upload failed.");
  }

  const data = await response.json();

  return data.secure_url;
}

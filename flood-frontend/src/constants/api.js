export const API_BASE_URL = "http://127.0.0.1:8000";

// Must match OPERATOR_API_KEY in the backend's .env - see
// backend/routes/operator_auth.py for what this guards and why. Shipped
// as a source constant here, matching this file's existing convention
// for API_BASE_URL rather than introducing a separate build-env system
// for one value. Be clear-eyed about what this does and does not
// achieve: it stops shelter data from being writable by anyone who
// simply finds the API, which is the specific gap the supervisor review
// flagged, but a value shipped in frontend source is still visible to
// anyone who inspects the built bundle - it is not a substitute for
// real per-operator authentication in a production deployment.
export const OPERATOR_API_KEY = "REPLACE_WITH_YOUR_OPERATOR_API_KEY";
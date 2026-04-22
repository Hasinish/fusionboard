import axios from "axios";

let apiBase = import.meta.env.VITE_API_URL;
if (!apiBase) {
    const isProd = typeof window !== "undefined" && (window.location.hostname.includes("vercel.app") || window.location.hostname.includes("fusionboard"));
    apiBase = isProd ? "https://fusionboard-backend.onrender.com/api" : "http://localhost:5001/api";
}
export const API_URL = apiBase;

export default axios.create({
  baseURL: API_URL
});
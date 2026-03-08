import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

export default axios.create({
  baseURL: API_URL
});
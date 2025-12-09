import { useState } from "react";
import api from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e) {
    e.preventDefault();
    const res = await api.post("/auth/register", { name, email, password });
    setMsg(res.data.message);
    setTimeout(() => nav("/login"), 1000);
  }

  return (
    <form onSubmit={submit}>
      <h2>Register</h2>
      <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
      <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button>Register</button>
      <p>{msg}</p>
    </form>
  );
}

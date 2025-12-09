// frontend/src/components/NavBar.jsx
import { getUser } from "../lib/auth";
import { useNavigate } from "react-router-dom";

function NavBar() {
  const user = getUser();
  const initial = user?.name?.[0]?.toUpperCase() || "U";
  const navigate = useNavigate();

  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="max-w-6xl mx-auto flex w-full items-center justify-between px-4">
        {/* Left: Logo / Name */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight cursor-pointer" onClick={() => navigate("/dashboard")}>
            Fusion<span className="text-primary">Board</span>
          </span>
        </div>

        {/* Right: Create workspace + profile icon */}
        <div className="flex items-center gap-4">
          <button className="btn btn-primary btn-sm">
            Create workspace
          </button>

          {/* Round human icon (avatar placeholder) */}
          <div
            className="avatar cursor-pointer"
            onClick={() => navigate("/profile")}
            title="Profile"
          >
            <div className="w-10 rounded-full bg-neutral text-neutral-content flex items-center justify-center">
              <span className="text-lg font-semibold">
                {initial}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NavBar;

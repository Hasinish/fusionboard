from pathlib import Path

def classify(path: Path) -> str | None:
    FRONTEND_DIRS = {"frontend", "client", "ui", "web", "src/pages", "src/components", "src/views", "src/app"}
    BACKEND_DIRS  = {"backend", "server", "api", "services", "src/api", "src/server", "src/services"}
    FRONTEND_EXTS = {".jsx", ".tsx", ".vue", ".css", ".scss", ".sass", ".less", ".html"}
    BACKEND_EXTS  = {".py", ".go", ".java", ".rb", ".php", ".rs", ".cs"}
    SHARED_EXTS   = {".ts", ".js", ".json", ".env", ".yaml", ".yml", ".toml", ".md"}

    parts_lower = [p.lower() for p in path.parts]

    # Check directory-based classification first
    for part in parts_lower:
        if part in FRONTEND_DIRS:
            return "frontend"
        if part in BACKEND_DIRS:
            return "backend"

    ext = path.suffix.lower()

    if ext in FRONTEND_EXTS:
        return "frontend"
    if ext in BACKEND_EXTS:
        return "backend"
    if ext in SHARED_EXTS:
        # Use filename/path hints to decide
        name_lower = path.stem.lower()
        if any(k in name_lower for k in ("component", "page", "view", "style", "layout", "hook", "store", "context")):
            return "frontend"
        if any(k in name_lower for k in ("route", "controller", "model", "service", "middleware", "schema", "db", "database", "migration", "seed")):
            return "backend"
        # Fall back to extension default
        return "shared"

    return "other"


def collect_files(root: Path, frontend_out: Path, backend_out: Path):
    SKIP_DIRS  = {"node_modules", ".git", "__pycache__", ".next", "dist", "build", ".venv", "venv"}
    SKIP_FILES = {"package-lock.json", "collect_files.py", "data.json", "all_files.txt", ".env", ".gitignore"}
    SKIP_EXTS  = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot"}

    frontend_files = []
    backend_files  = []
    shared_files   = []

    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if any(part.lower() in SKIP_DIRS for part in path.parts):
            continue
        if path.name.lower() in SKIP_FILES:
            continue

        rel = path.relative_to(root)

        if path.suffix.lower() in SKIP_EXTS:
            entry = (rel, None)  # image
        else:
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except Exception as e:
                text = f"[Could not read file: {e}]"
            entry = (rel, text)

        category = classify(rel)
        if category == "frontend":
            frontend_files.append(entry)
        elif category == "backend":
            backend_files.append(entry)
        else:
            shared_files.append(entry)  # shared/other → goes into both

    def write_entries(out_path: Path, primary: list, shared: list, label: str):
        with out_path.open("w", encoding="utf-8", errors="replace") as out:
            out.write(f"# {label.upper()} FILES\n")
            for rel, text in primary + shared:
                if text is None:
                    out.write(f"\n===== IMAGE FILE: {rel} =====\n")
                else:
                    out.write(f"\n===== FILE: {rel} =====\n")
                    out.write(text)
                    out.write("\n")
        print(f"  {len(primary)} {label} files + {len(shared)} shared -> {out_path}")

    write_entries(frontend_out, frontend_files, shared_files, "frontend")
    write_entries(backend_out,  backend_files,  shared_files, "backend")


if __name__ == "__main__":
    project_root  = Path(".").resolve()
    collect_files(
        project_root,
        frontend_out=Path("frontend_files.txt"),
        backend_out=Path("backend_files.txt"),
    )
    print("Done.")